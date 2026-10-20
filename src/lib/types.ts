// 전사 모델이 돌려준 단어. 시간은 원본 오디오 기준(초), speaker는 구간 안에서만 의미 있는 라벨(spk_1 등).
export type Word = { text: string; start: number; end: number; speaker: string };

/** 화면에서 클릭하고 강조하려고 발화마다 저장하는 단어 (t: 글자, s/e: 시작·끝 초) */
export type UtteranceWord = { t: string; s: number; e: number };

export type Utterance = {
  id: number;
  chunk_idx: number;
  speaker: string; // 전체 녹음 기준 화자 ID (S1, S2 ...)
  start_sec: number;
  end_sec: number;
  text_en: string;
  text_ko: string | null;
  words: UtteranceWord[];
  is_ad: boolean;
};

export type VocabEntry = {
  id: number;
  word: string;
  lemma: string;
  part_of_speech: string | null;
  meaning_ko: string;
  sentence_en: string;
  sentence_ko: string | null;
  job_id: string | null;
  start_sec: number | null;
  created_at: string;
};

export type Definition = { lemma: string; part_of_speech: string; meaning_ko: string };

export type JobStatus = "uploading" | "processing" | "done" | "error";
export type ChunkStatus = "pending" | "transcribed" | "translated";

export type Job = {
  id: string;
  filename: string;
  duration_sec: number;
  chunk_count: number;
  status: JobStatus;
  error: string | null;
  speaker_names: Record<string, string>;
  created_at: string;
};

export type JobDetail = Job & {
  chunks: { idx: number; status: ChunkStatus; error: string | null }[];
  utterances: Utterance[];
  audio_url: string | null;
};
