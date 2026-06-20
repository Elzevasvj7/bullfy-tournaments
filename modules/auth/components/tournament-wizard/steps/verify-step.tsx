import { useTournamentWizard } from "../context";
import { OtpPanel } from "../components/otp-panel";

export function VerifyStep() {
  const {
    actions: { handleOtp, handleVerify, updateForm },
    state: { emailVerified, form, pendingAction, smsVerified },
  } = useTournamentWizard();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <OtpPanel
        channel="email"
        code={form.emailCode}
        disabled={!form.email}
        isPending={
          pendingAction === "request-email" || pendingAction === "verify-email"
        }
        isVerified={emailVerified}
        label="Email"
        target={form.email || "sin email"}
        onCodeChange={(value) => updateForm("emailCode", value)}
        onRequest={() => handleOtp("email")}
        onVerify={() => handleVerify("email")}
      />
      <OtpPanel
        channel="sms"
        code={form.smsCode}
        disabled={!form.phone}
        isPending={
          pendingAction === "request-sms" || pendingAction === "verify-sms"
        }
        isVerified={smsVerified}
        label="SMS"
        target={form.phone || "sin telefono"}
        onCodeChange={(value) => updateForm("smsCode", value)}
        onRequest={() => handleOtp("sms")}
        onVerify={() => handleVerify("sms")}
      />
    </div>
  );
}
