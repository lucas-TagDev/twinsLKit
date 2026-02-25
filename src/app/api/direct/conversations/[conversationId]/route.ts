import { NextRequest, NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { ensureSameAuthenticatedUser, getApiErrorStatus, requireAuthenticatedUserId } from "@/lib/api-auth";
import { clearDirectConversationMessages, deleteDirectConversationById } from "@/lib/store";

type Params = {
  params: Promise<{ conversationId: string }>;
};

const deleteDirectConversationSchema = z.object({
  actorId: z.string().trim().min(2),
  mode: z.enum(["deleteConversation", "clearMessages"]).default("deleteConversation"),
});

const deleteUploadFile = async (fileUrl: string) => {
  if (!fileUrl.startsWith("/uploads/direct/")) {
    return;
  }

  const normalized = path.normalize(fileUrl.replace(/^\/+/, ""));
  if (!normalized.startsWith("uploads")) {
    return;
  }

  const fullPath = path.join(process.cwd(), "public", normalized.replace(/^uploads[\\/]/, "uploads/"));
  await unlink(fullPath).catch(() => undefined);
};

export async function DELETE(request: NextRequest, { params }: Params) {
  const { conversationId } = await params;

  try {
    const authenticatedUserId = requireAuthenticatedUserId(request);
    const body = deleteDirectConversationSchema.parse(await request.json());
    ensureSameAuthenticatedUser(authenticatedUserId, body.actorId);

    const result =
      body.mode === "clearMessages"
        ? await clearDirectConversationMessages(conversationId, authenticatedUserId)
        : await deleteDirectConversationById(conversationId, authenticatedUserId);

    await Promise.all(result.removedAttachmentUrls.map((url) => deleteUploadFile(url)));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao excluir conversa direta." },
      { status: getApiErrorStatus(error) },
    );
  }
}
