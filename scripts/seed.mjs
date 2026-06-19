#!/usr/bin/env node
/**
 * Run: npm run seed
 * Requires: SUPABASE_SERVICE_ROLE_KEY in .env (never expose in frontend!)
 */

import { createClient } from '@supabase/supabase-js'
import { WebSocket } from 'ws'

globalThis.WebSocket = WebSocket
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { SEED_DEPARTMENTS, SEED_COURSES, SEED_USERS, SEED_CLASSES } from '../supabase/seed.config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnv() {
  const envPath = resolve(root, '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

const url = process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('\n❌ Missing environment variables.\n')
  console.error('Add to .env:')
  console.error('  VITE_SUPABASE_URL=https://xxx.supabase.co')
  console.error('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  console.error('\nRun schema.sql → schema-roles.sql → schema-dept-course.sql first.\n')
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket },
})

const log = {
  ok: (msg) => console.log(`  ✓ ${msg}`),
  skip: (msg) => console.log(`  ○ ${msg}`),
  err: (msg) => console.error(`  ✗ ${msg}`),
  section: (msg) => console.log(`\n▸ ${msg}`),
}

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email === email) ?? null
}

async function seedDepartments() {
  log.section('Seeding departments')
  const deptMap = {}

  for (const dept of SEED_DEPARTMENTS) {
    const { data: existing } = await supabase.from('departments').select('id').eq('code', dept.code).maybeSingle()
    if (existing) {
      deptMap[dept.code] = existing.id
      log.skip(`Department exists: ${dept.code}`)
    } else {
      const { data, error } = await supabase.from('departments').insert(dept).select('id').single()
      if (error) { log.err(`Department ${dept.code}: ${error.message}`); continue }
      deptMap[dept.code] = data.id
      log.ok(`Created department: ${dept.name}`)
    }
  }

  return deptMap
}

async function seedCourses(deptMap) {
  log.section('Seeding courses')
  const courseMap = {}

  for (const course of SEED_COURSES) {
    const departmentId = deptMap[course.departmentCode]
    if (!departmentId) {
      log.err(`Department not found for course: ${course.code}`)
      continue
    }

    const { data: existing } = await supabase
      .from('courses')
      .select('id')
      .eq('department_id', departmentId)
      .eq('code', course.code)
      .maybeSingle()

    if (existing) {
      courseMap[course.code] = existing.id
      log.skip(`Course exists: ${course.code}`)
    } else {
      const { data, error } = await supabase.from('courses').insert({
        department_id: departmentId,
        name: course.name,
        code: course.code,
        duration_years: course.duration_years,
      }).select('id').single()
      if (error) { log.err(`Course ${course.code}: ${error.message}`); continue }
      courseMap[course.code] = data.id
      log.ok(`Created course: ${course.code} (${course.departmentCode})`)
    }
  }

  return courseMap
}

async function upsertUser(user, deptMap, courseMap) {
  const { email, password, name, role, roll_number, department, departmentCode, courseCode } = user
  let authUser = await findUserByEmail(email)

  if (authUser) {
    log.skip(`User exists: ${email}`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    })
    if (error) {
      log.err(`Create failed ${email}: ${error.message}`)
      return null
    }
    authUser = data.user
    log.ok(`Created user: ${email}`)
  }

  const department_id = departmentCode ? deptMap[departmentCode] ?? null : null
  const course_id = courseCode ? courseMap[courseCode] ?? null : null
  const deptLabel = departmentCode || department || null

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      id: authUser.id,
      name,
      email,
      role,
      roll_number: roll_number ?? null,
      department: deptLabel,
      department_id,
      course_id,
    },
    { onConflict: 'id' }
  )

  if (profileError) {
    log.err(`Profile update failed ${email}: ${profileError.message}`)
    return null
  }

  log.ok(`Profile set (${role}): ${name}`)
  return authUser
}

async function seedUsers(deptMap, courseMap) {
  log.section('Seeding users')
  const userMap = {}

  userMap[SEED_USERS.admin.email] = await upsertUser(SEED_USERS.admin, deptMap, courseMap)

  for (const t of SEED_USERS.teachers) {
    userMap[t.email] = await upsertUser(t, deptMap, courseMap)
  }
  for (const s of SEED_USERS.students) {
    userMap[s.email] = await upsertUser(s, deptMap, courseMap)
  }

  return userMap
}

async function seedClasses(userMap, courseMap) {
  log.section('Seeding classes & enrollments')

  for (const cls of SEED_CLASSES) {
    const teacher = userMap[cls.teacherEmail]
    const courseId = courseMap[cls.courseCode]
    if (!teacher) {
      log.err(`Teacher not found: ${cls.teacherEmail}`)
      continue
    }
    if (!courseId) {
      log.err(`Course not found: ${cls.courseCode}`)
      continue
    }

    const { data: existing } = await supabase.from('classes').select('id').eq('code', cls.code).maybeSingle()

    let classId = existing?.id
    if (classId) {
      log.skip(`Class exists: ${cls.code}`)
      await supabase.from('classes').update({
        teacher_id: teacher.id,
        name: cls.name,
        course_id: courseId,
      }).eq('id', classId)
    } else {
      const { data, error } = await supabase.from('classes').insert({
        name: cls.name,
        code: cls.code,
        course_id: courseId,
        teacher_id: teacher.id,
      }).select('id').single()
      if (error) { log.err(`Class ${cls.code}: ${error.message}`); continue }
      classId = data.id
      log.ok(`Created class: ${cls.name}`)
    }

    for (const studentEmail of cls.studentEmails) {
      const student = userMap[studentEmail]
      if (!student) { log.err(`Student not found: ${studentEmail}`); continue }

      const { error } = await supabase.from('class_enrollments').upsert(
        { class_id: classId, student_id: student.id },
        { onConflict: 'class_id,student_id', ignoreDuplicates: true }
      )
      if (error) log.err(`Enroll ${studentEmail}: ${error.message}`)
      else log.ok(`Enrolled ${studentEmail} → ${cls.code}`)
    }
  }
}

async function seedSampleContent(userMap) {
  log.section('Seeding sample assignments & exams')

  const teacher = userMap['teacher@college.edu']
  const students = [userMap['student@college.edu'], userMap['student2@college.edu']].filter(Boolean)

  const { data: bcaClass } = await supabase.from('classes').select('id').eq('code', 'BCA3-A').maybeSingle()
  if (!teacher || !bcaClass) return

  const dueDate = new Date()
  dueDate.setDate(dueDate.getDate() + 14)
  const examDate = new Date()
  examDate.setDate(examDate.getDate() + 30)

  const { data: existingAsn } = await supabase.from('assignments').select('id').eq('title', 'Normalization Assignment').eq('class_id', bcaClass.id).maybeSingle()

  if (!existingAsn) {
    const { data: asn, error } = await supabase.from('assignments').insert({
      user_id: teacher.id,
      created_by: teacher.id,
      class_id: bcaClass.id,
      subject: 'DBMS',
      title: 'Normalization Assignment',
      description: 'Normalize the given tables to 3NF and submit ER diagram.',
      due_date: dueDate.toISOString().split('T')[0],
      priority: 'high',
      status: 'pending',
    }).select('id').single()

    if (error) log.err(`Assignment: ${error.message}`)
    else {
      log.ok('Created sample assignment: Normalization Assignment')
      for (const s of students) {
        await supabase.from('assignment_submissions').upsert(
          { assignment_id: asn.id, student_id: s.id, status: 'pending' },
          { onConflict: 'assignment_id,student_id' }
        )
        await supabase.from('notifications').insert({
          user_id: s.id,
          title: 'New Assignment',
          message: `Normalization Assignment — due ${dueDate.toISOString().split('T')[0]}`,
          type: 'assignment',
          link: '/assignments',
        })
      }
      log.ok('Notified enrolled students')
    }
  } else {
    log.skip('Sample assignment already exists')
  }

  const { data: existingExam } = await supabase.from('exams').select('id').eq('exam_name', 'DBMS Final Exam').eq('class_id', bcaClass.id).maybeSingle()

  if (!existingExam) {
    const { error } = await supabase.from('exams').insert({
      user_id: teacher.id,
      created_by: teacher.id,
      class_id: bcaClass.id,
      exam_name: 'DBMS Final Exam',
      subject: 'DBMS',
      exam_date: examDate.toISOString().split('T')[0],
      notes: 'Chapters 1–8, bring hall ticket',
    })
    if (error) log.err(`Exam: ${error.message}`)
    else {
      log.ok('Created sample exam: DBMS Final Exam')
      for (const s of students) {
        await supabase.from('notifications').insert({
          user_id: s.id,
          title: 'New Exam Scheduled',
          message: `DBMS Final Exam on ${examDate.toISOString().split('T')[0]}`,
          type: 'exam',
          link: '/exams',
        })
      }
    }
  } else {
    log.skip('Sample exam already exists')
  }

  for (const s of students) {
    await supabase.from('class_attendance').upsert(
      {
        class_id: bcaClass.id,
        student_id: s.id,
        total_classes: 40,
        attended_classes: 32,
        updated_by: teacher.id,
      },
      { onConflict: 'class_id,student_id' }
    )
  }
  log.ok('Seeded class attendance records')
}

function printCredentials() {
  console.log('\n╔══════════════════════════════════════════════════════════╗')
  console.log('║              SEED COMPLETE — Login Credentials           ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log('║  ADMIN    admin@college.edu      / Admin@123456          ║')
  console.log('║  TEACHER  teacher@college.edu    / Teacher@123456        ║')
  console.log('║  TEACHER  teacher2@college.edu   / Teacher@123456       ║')
  console.log('║  STUDENT  student@college.edu    / Student@123456        ║')
  console.log('║  STUDENT  student2@college.edu   / Student@123456       ║')
  console.log('║  STUDENT  student3@college.edu   / Student@123456       ║')
  console.log('╠══════════════════════════════════════════════════════════╣')
  console.log('║  ⚠  Change all passwords before production deployment!   ║')
  console.log('╚══════════════════════════════════════════════════════════╝\n')
}

async function main() {
  console.log('\n🌱 Student Companion — Database Seeder\n')

  try {
    const deptMap = await seedDepartments()
    const courseMap = await seedCourses(deptMap)
    const userMap = await seedUsers(deptMap, courseMap)
    await seedClasses(userMap, courseMap)
    await seedSampleContent(userMap)
    printCredentials()
  } catch (err) {
    console.error('\n❌ Seed failed:', err.message)
    process.exit(1)
  }
}

main()
