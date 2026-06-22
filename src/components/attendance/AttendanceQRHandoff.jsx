import MobileQRHandoff from './MobileQRHandoff'

export default function AttendanceQRHandoff(props) {
  return (
    <MobileQRHandoff
      {...props}
      path="/attendance/mobile"
      table="attendance_handoff_tokens"
      description="Scan with your phone camera, log in if asked, then verify face and GPS on your phone."
      completedMessage="Attendance marked from phone!"
      waitingLabel="Waiting for phone verification"
    />
  )
}

export { HANDOFF_TTL_MS } from './MobileQRHandoff'
