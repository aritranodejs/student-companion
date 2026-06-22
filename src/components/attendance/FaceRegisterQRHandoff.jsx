import MobileQRHandoff from './MobileQRHandoff'

export default function FaceRegisterQRHandoff(props) {
  return (
    <MobileQRHandoff
      {...props}
      path="/face-register/mobile"
      table="face_registration_handoff_tokens"
      title="Register face from your phone"
      description="Scan with your phone camera, log in if asked, then capture your face on your phone. This is a one-time setup."
      completedMessage="Face registered from phone!"
      completedHint="You can now mark attendance on this PC using QR."
      waitingLabel="Waiting for face registration"
    />
  )
}
