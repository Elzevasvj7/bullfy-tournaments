import { NextRequest, NextResponse } from "next/server";
import { getCurrentSessionUser } from "@/modules/auth/services/session-user";
import {
  getAvatarProfile,
  saveAvatarExport,
} from "@/modules/profile/services/avatar.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const profile = await getAvatarProfile(user.id);

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo cargar el avatar.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentSessionUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const profile = await saveAvatarExport(user.id, {
      avatarId: body.avatarId,
      bodyId: body.bodyId,
      gender: body.gender,
      rawPayload: body.rawPayload,
      sessionId: body.sessionId,
      url: body.url,
      urlType: body.urlType,
    });

    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    console.log(error, "ERROR");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el avatar.",
      },
      { status: 500 },
    );
  }
}
