import { AuthShell, RegisterForm } from "@/modules/auth";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="Nuevo trader"
      title="Crea tu identidad"
      description="Preparamos el flujo de registro con verificacion email/SMS, referido y wallet inicial para conectarlo luego al backend Supabase."
    >
      <RegisterForm />
    </AuthShell>
  );
}
