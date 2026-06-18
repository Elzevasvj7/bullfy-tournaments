import { AuthShell, LoginForm } from "@/modules/auth";

type LoginPageProps = {
  searchParams: Promise<{
    next?: string;
  }>;
};

function normalizeRedirectPath(next?: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return "/";
  }

  return next;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  return (
    <AuthShell
      eyebrow="Bullfy Tournament"
      title="Vuelve al lobby"
      description="Entra con tu cuenta de torneos para continuar con wallet, clanes, versus y perfil competitivo."
    >
      <LoginForm redirectTo={normalizeRedirectPath(next)} />
    </AuthShell>
  );
}
