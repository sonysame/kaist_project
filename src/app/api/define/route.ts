import { RateLimitError, defineWord } from "@/lib/gemini";
import { currentUser, unauthorized } from "@/lib/auth";

export async function POST(request: Request) {
  if (!(await currentUser())) return unauthorized();
  const { word, sentence } = (await request.json()) as { word?: string; sentence?: string };
  if (!word || !sentence || word.length > 60 || sentence.length > 2000) {
    return Response.json({ error: "단어와 문장이 필요해요." }, { status: 400 });
  }
  try {
    return Response.json(await defineWord(word, sentence));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: err instanceof RateLimitError ? 429 : 500 });
  }
}
