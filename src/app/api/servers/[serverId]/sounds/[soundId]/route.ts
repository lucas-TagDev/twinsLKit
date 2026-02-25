import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { ensureSameAuthenticatedUser, getApiErrorStatus, requireAuthenticatedUserId } from "@/lib/api-auth";
import { deleteServerSound } from "@/lib/store";

type Params = {
  params: Promise<{ serverId: string; soundId: string }>;
};

const deleteSoundFileByUrl = async (fileUrl: string) => {
  if (!fileUrl.startsWith("/uploads/soundboard/")) {
    return;
  }

  const normalized = path.normalize(fileUrl.replace(/^\/+/, ""));
  if (!normalized.startsWith(path.normalize("uploads/soundboard"))) {
    return;
  }

  const fullPath = path.join(process.cwd(), "public", normalized);
  await unlink(fullPath).catch(() => undefined);
};

export async function DELETE(request: NextRequest, { params }: Params) {
  const { serverId, soundId } = await params;

  try {
    const authenticatedUserId = requireAuthenticatedUserId(request);
    const actorId = request.nextUrl.searchParams.get("actorId");
    if (actorId) {
      ensureSameAuthenticatedUser(authenticatedUserId, actorId);
    }

    const result = await deleteServerSound(serverId, soundId, authenticatedUserId);
    await deleteSoundFileByUrl(result.deletedUrl);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao remover áudio." },
      { status: getApiErrorStatus(error) },
    );
  }
}
