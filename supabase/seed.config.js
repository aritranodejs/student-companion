/**
 * Student Companion — Database Seeder
 *
 * Run order in Supabase SQL Editor:
 *   1. schema.sql
 *   2. schema-roles.sql
 *   3. schema-dept-course.sql
 *
 * Then: npm run seed
 */

export const SEED_DEPARTMENTS = [
  {
    name: 'Computer Applications',
    code: 'CA',
    description: 'Department of Computer Applications — BCA, MCA programs',
  },
  {
    name: 'Engineering',
    code: 'ENG',
    description: 'Department of Engineering — BTech, MTech programs',
  },
]

export const SEED_COURSES = [
  { departmentCode: 'CA', name: 'Bachelor of Computer Applications', code: 'BCA', duration_years: 3 },
  { departmentCode: 'CA', name: 'Master of Computer Applications', code: 'MCA', duration_years: 2 },
  { departmentCode: 'ENG', name: 'Bachelor of Technology', code: 'BTECH', duration_years: 4 },
  { departmentCode: 'ENG', name: 'Master of Technology', code: 'MTECH', duration_years: 2 },
]

export const SEED_USERS = {
  admin: {
    email: 'admin@college.edu',
    password: 'Admin@123456',
    name: 'System Admin',
    role: 'admin',
    department: 'Administration',
  },
  teachers: [
    {
      email: 'teacher@college.edu',
      password: 'Teacher@123456',
      name: 'Dr. Priya Sharma',
      role: 'teacher',
      departmentCode: 'CA',
    },
    {
      email: 'teacher2@college.edu',
      password: 'Teacher@123456',
      name: 'Prof. Rahul Mehta',
      role: 'teacher',
      departmentCode: 'ENG',
    },
  ],
  students: [
    {
      email: 'student@college.edu',
      password: 'Student@123456',
      name: 'Aritra Das',
      role: 'student',
      roll_number: 'BCA2024001',
      courseCode: 'BCA',
      departmentCode: 'CA',
    },
    {
      email: 'student2@college.edu',
      password: 'Student@123456',
      name: 'Sneha Patel',
      role: 'student',
      roll_number: 'BCA2024002',
      courseCode: 'BCA',
      departmentCode: 'CA',
    },
    {
      email: 'student3@college.edu',
      password: 'Student@123456',
      name: 'Vikram Singh',
      role: 'student',
      roll_number: 'MCA2024001',
      courseCode: 'MCA',
      departmentCode: 'CA',
    },
  ],
}

export const SEED_CLASSES = [
  {
    name: 'BCA 3rd Year — Section A',
    code: 'BCA3-A',
    courseCode: 'BCA',
    teacherEmail: 'teacher@college.edu',
    studentEmails: ['student@college.edu', 'student2@college.edu'],
  },
  {
    name: 'MCA 1st Year — Section A',
    code: 'MCA1-A',
    courseCode: 'MCA',
    teacherEmail: 'teacher@college.edu',
    studentEmails: ['student3@college.edu'],
  },
]
