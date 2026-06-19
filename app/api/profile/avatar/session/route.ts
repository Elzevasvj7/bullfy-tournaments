import { NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import { createAvaturnSession } from "@/modules/profile/services/avatar.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const session = await createAvaturnSession(user.id);

    return NextResponse.json({ ok: true, ...session });
  } catch (error) {
    console.log(error, "ERROR");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo crear la sesion de avatar.",
      },
      { status: 500 },
    );
  }
}
