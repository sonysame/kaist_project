import { supabaseAdmin } from "@/lib/supabase-server";
import { currentUser, unauthorized } from "@/lib/auth";
import { STARTER_JOB_ID, STARTER_WORDS } from "@/lib/starter-vocab";

/**
 * 처음 단어장을 여는 계정에 기본 단어를 한 번만 넣는다. 넣은 개수를 돌려준다.
 * 넣었다는 표시를 계정(app_metadata)에 남겨서, 다 지운 뒤에도 다시 넣지 않는다.
 */
export async function POST() {
  const user = await currentUser();
  if (!user) return unauthorized();
  if (!STARTER_WORDS.length || user.app_metadata?.starter_vocab) return Response.json({ inserted: 0 });

  const db = supabaseAdmin();
  const { count } = await db.from("vocab").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  let inserted = 0;
  if (!count) {
    // 예문이 나온 녹음은 누구나 볼 수 있는 샘플이라, 아직 있으면 "들으러 가기" 링크를 붙인다
    const { data: job } = await db.from("jobs").select("id").eq("id", STARTER_JOB_ID).maybeSingle();
    const link = !!job;
    const { error } = await db.from("vocab").upsert(
      STARTER_WORDS.map((w) => ({
        ...w,
        user_id: user.id,
        job_id: link ? STARTER_JOB_ID : null,
        start_sec: link ? w.start_sec : null,
      })),
      { onConflict: "user_id,lemma", ignoreDuplicates: true },
    );
    if (error) return Response.json({ error: error.message }, { status: 500 });
    inserted = STARTER_WORDS.length;
  }
  await db.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, starter_vocab: true } });
  return Response.json({ inserted });
}
