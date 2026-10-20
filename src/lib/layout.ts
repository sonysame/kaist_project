// 오디오를 나누는 규칙. 서버와 브라우저가 같은 규칙을 써야 해서 한 곳에 둔다.
// gemini-3.5-transcribe는 화자 분리를 켜면 한 번에 30분까지만 처리하므로 20분 + 겹침 30초로 자른다.
export const CHUNK_SEC = 20 * 60;
export const OVERLAP_SEC = 30;

export type ChunkRange = { idx: number; start: number; end: number };

export function chunkLayout(durationSec: number): ChunkRange[] {
  const chunks: ChunkRange[] = [];
  for (let idx = 0, start = 0; start < durationSec; idx++, start += CHUNK_SEC) {
    const end = Math.min(durationSec, start + CHUNK_SEC + OVERLAP_SEC);
    chunks.push({ idx, start, end });
    if (end >= durationSec) break;
  }
  return chunks;
}

export const audioPath = (jobId: string) => `${jobId}/full.mp3`;
export const chunkPath = (jobId: string, idx: number) =>
  `${jobId}/chunk_${String(idx).padStart(3, "0")}.mp3`;
