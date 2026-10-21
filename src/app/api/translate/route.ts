import { RateLimitError, translatePhrase } from "@/lib/gemini";
import { currentUser, unauthorized } from "@/lib/auth";

/** 대본에서 드래그한 부분 해석 */
export async function POST(request: Request) {
  if (!(await currentUser())) return unauthorized();
  const { text, context } = (await request.json()) as { text?: string; context?: string };
  if (!text?.trim() || text.length > 600 || (context?.length ?? 0) > 3000) {
    return Response.json({ error: "해석할 부분을 600자 안으로 골라 주세요." }, { status: 400 });
  }
  try {
    return Response.json({ ko: await translatePhrase(text.trim(), context || text) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: err instanceof RateLimitError ? 429 : 500 });
  }
}
