import { requireAdmin } from "@/lib/auth";
import { ROLE_INFO, getModels, modelOptions, setModel, type ModelRole } from "@/lib/models";

/** 지금 쓰는 모델과 고를 수 있는 모델 목록 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const [current, options] = await Promise.all([getModels(), modelOptions()]);
  return Response.json({ roles: ROLE_INFO, current, options });
}

/** 모델 바꾸기: { role, model } */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { role, model } = (await request.json()) as { role?: ModelRole; model?: string };
  if (!role || !(role in ROLE_INFO) || !model) return Response.json({ error: "역할과 모델이 필요해요." }, { status: 400 });
  // Gemini가 실제로 제공하는, 그 역할에 맞는 모델만 허용
  const options = await modelOptions();
  if (!options[role].includes(model)) return Response.json({ error: "고를 수 없는 모델이에요." }, { status: 400 });
  try {
    await setModel(role, model);
  } catch (err) {
    return Response.json(
      { error: `저장하지 못했어요. migrations/004_gemini_log.sql을 실행했는지 확인해 주세요. (${(err as Error).message})` },
      { status: 500 },
    );
  }
  return Response.json({ ok: true, current: await getModels() });
}
