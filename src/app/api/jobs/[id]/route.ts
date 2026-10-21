import { BUCKET, supabaseAdmin } from "@/lib/supabase-server";
import { mergeSpeakers } from "@/lib/speakers";
import { requireJobOwner, requireJobReader } from "@/lib/auth";
import { isSampleJob } from "@/lib/sample";

export async function GET(_request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  // 보기는 주인 또는 샘플이면 된다 (샘플은 로그인하지 않아도)
  const auth = await requireJobReader(id);
  if ("error" in auth) return auth.error;
  const db = supabaseAdmin();
  const [job, chunks, utterances] = await Promise.all([
    db.from("jobs").select("*").eq("id", id).maybeSingle(),
    db.from("chunks").select("idx, status, error").eq("job_id", id).order("idx"),
    db
      .from("utterances")
      .select("id, chunk_idx, speaker, start_sec, end_sec, text_en, text_ko, words, is_ad")
      .eq("job_id", id)
      .order("start_sec"),
  ]);
  if (job.error || chunks.error || utterances.error) {
    return Response.json({ error: (job.error ?? chunks.error ?? utterances.error)!.message }, { status: 500 });
  }
  if (!job.data) return Response.json({ error: "작업을 찾을 수 없어요." }, { status: 404 });

  let audio_url: string | null = null;
  if (job.data.status !== "uploading") {
    const { data } = await db.storage.from(BUCKET).createSignedUrl(`${id}/full.mp3`, 60 * 60 * 6);
    audio_url = data?.signedUrl ?? null;
  }
  // 주인의 사용자 ID는 화면에 보내지 않는다
  const publicJob = { ...job.data };
  delete publicJob.user_id;
  return Response.json({
    ...publicJob,
    chunks: chunks.data,
    utterances: utterances.data,
    audio_url,
    is_sample: isSampleJob(id),
    can_edit: auth.canEdit,
  });
}

/** 업로드 완료 표시, 화자 이름 변경, 화자 합치기 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireJobOwner(id);
  if ("error" in auth) return auth.error;
  const body = (await request.json()) as {
    uploaded?: boolean;
    speakerNames?: Record<string, string>;
    merge?: { from: string; into: string };
  };
  if (body.merge) {
    const { from, into } = body.merge;
    if (!/^S\d+$/.test(from) || !/^S\d+$/.test(into) || from === into) {
      return Response.json({ error: "합칠 화자가 올바르지 않아요." }, { status: 400 });
    }
    try {
      await mergeSpeakers(supabaseAdmin(), id, from, into);
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
    return Response.json({ ok: true });
  }
  const update: Record<string, unknown> = {};
  if (body.uploaded) update.status = "processing";
  if (body.speakerNames) {
    const clean = Object.fromEntries(
      Object.entries(body.speakerNames)
        .filter(([k, v]) => /^S\d+$/.test(k) && typeof v === "string")
        .map(([k, v]) => [k, v.trim().slice(0, 40)]),
    );
    update.speaker_names = clean;
  }
  const { error } = await supabaseAdmin().from("jobs").update(update).eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireJobOwner(id);
  if ("error" in auth) return auth.error;
  const db = supabaseAdmin();
  const storage = db.storage.from(BUCKET);
  const { data: files } = await storage.list(id);
  if (files?.length) await storage.remove(files.map((f) => `${id}/${f.name}`));
  const { error } = await db.from("jobs").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
