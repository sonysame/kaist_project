import { requireAdmin } from "@/lib/auth";
import { MAX_UPLOAD_LIMIT, getUploadLimit, setUploadLimit } from "@/lib/quota";

/** 하루 업로드 한도 바꾸기: { limit } */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { limit } = (await request.json()) as { limit?: number };
  if (!Number.isInteger(limit) || limit! < 0 || limit! > MAX_UPLOAD_LIMIT) {
    return Response.json({ error: `0에서 ${MAX_UPLOAD_LIMIT} 사이의 정수로 정해 주세요.` }, { status: 400 });
  }
  try {
    await setUploadLimit(limit!);
  } catch (err) {
    return Response.json(
      { error: `저장하지 못했어요. migrations/004_gemini_log.sql을 실행했는지 확인해 주세요. (${(err as Error).message})` },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, limit: await getUploadLimit() });
}
