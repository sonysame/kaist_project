import "server-only";
import { supabaseAdmin } from "./supabase-server";

/** 앱이 Gemini를 쓰는 세 가지 역할 */
export type ModelRole = "transcribe" | "text" | "correct";

export const ROLE_INFO: Record<ModelRole, { label: string; what: string; env: string; fallback: string }> = {
  transcribe: {
    label: "받아 적기",
    what: "화자 분리 + 단어별 시간 (20분 구간마다 1번)",
    env: "GEMINI_TRANSCRIBE_MODEL",
    fallback: "gemini-3.5-transcribe",
  },
  text: {
    label: "번역·단어 뜻·광고 찾기",
    what: "한국어 번역(80문장씩), 단어 뜻, 광고·화자 이름 찾기",
    env: "GEMINI_TRANSLATE_MODEL",
    fallback: "gemini-3.5-flash-lite",
  },
  correct: {
    label: "고유명사 교정",
    what: "잘못 들은 이름 고치기 (파일마다 1번)",
    env: "GEMINI_CORRECTION_MODEL",
    fallback: "gemini-3.5-flash",
  },
};

const ROLES = Object.keys(ROLE_INFO) as ModelRole[];
const settingKey = (role: ModelRole) => `model.${role}`;

// 매 호출마다 DB를 읽지 않도록 잠깐 기억해 둔다 (관리자가 바꾸면 길어도 30초 안에 반영)
let cache: { at: number; value: Record<ModelRole, string> } | null = null;
const CACHE_MS = 30_000;

/** 지금 쓸 모델: 관리자 페이지 설정(DB) → 환경 변수 → 코드 기본값 순서 */
export async function getModels(): Promise<Record<ModelRole, string>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;
  const fromEnv = Object.fromEntries(
    ROLES.map((r) => [r, process.env[ROLE_INFO[r].env] || ROLE_INFO[r].fallback]),
  ) as Record<ModelRole, string>;
  const { data, error } = await supabaseAdmin()
    .from("app_settings")
    .select("key, value")
    .in("key", ROLES.map(settingKey));
  // 설정 표가 아직 없으면(SQL 실행 전) 환경 변수·기본값으로 동작한다
  const value = { ...fromEnv };
  if (!error) for (const row of data ?? []) value[row.key.replace("model.", "") as ModelRole] = row.value;
  cache = { at: Date.now(), value };
  return value;
}

export async function getModel(role: ModelRole) {
  return (await getModels())[role];
}

export async function setModel(role: ModelRole, model: string) {
  const { error } = await supabaseAdmin()
    .from("app_settings")
    .upsert({ key: settingKey(role), value: model, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  cache = null;
}

/** 관리자 화면에서 고를 수 있는 모델: Gemini가 실제로 제공하는 목록에서 역할에 맞는 것만 (10분 동안 기억) */
let optionsCache: { at: number; value: Record<ModelRole, string[]> } | null = null;
export async function modelOptions(): Promise<Record<ModelRole, string[]>> {
  if (optionsCache && Date.now() - optionsCache.at < 600_000) return optionsCache.value;
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", {
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
  });
  const names: string[] = res.ok
    ? ((await res.json()).models ?? []).map((m: { name: string }) => m.name.replace(/^models\//, ""))
    : [];
  const textLike = names.filter(
    (n) => /^gemini-.*(flash|pro)/.test(n) && !/(tts|image|live|audio|embedding|robotics|transcribe)/.test(n),
  );
  const value: Record<ModelRole, string[]> = {
    transcribe: names.filter((n) => n.includes("transcribe") && !n.includes("live")),
    text: textLike,
    correct: textLike,
  };
  // 목록을 못 받아 와도 기본값은 고를 수 있게
  for (const r of ROLES) if (!value[r].includes(ROLE_INFO[r].fallback)) value[r].unshift(ROLE_INFO[r].fallback);
  optionsCache = { at: Date.now(), value };
  return value;
}
