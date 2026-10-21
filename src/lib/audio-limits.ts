// 브라우저(압축)와 서버(길이 확인)가 같이 쓰는 오디오 크기 기준

// Supabase 무료 플랜의 파일당 한도(50MB)보다 조금 작게
const MAX_FILE_BYTES = 48 * 1024 * 1024;
// 받아 적기용 구간은 늘 32kbps. 재생용 전체 파일은 길면 50MB 안에 들어가도록 음질을 낮춘다.
export const TRANSCRIBE_KBPS = 32;
const PLAYBACK_KBPS = [32, 24, 16];

/** 이 길이의 오디오를 담을 수 있는 재생용 음질 (너무 길면 null) */
export function playbackKbps(durationSec: number) {
  return PLAYBACK_KBPS.find((k) => (durationSec * k * 1000) / 8 <= MAX_FILE_BYTES) ?? null;
}

/** 올릴 수 있는 가장 긴 오디오 (16kbps로 약 6시간 59분) */
export const MAX_DURATION_SEC = Math.floor((MAX_FILE_BYTES * 8) / (PLAYBACK_KBPS.at(-1)! * 1000));

export const maxDurationText = () =>
  `${Math.floor(MAX_DURATION_SEC / 3600)}시간 ${Math.floor((MAX_DURATION_SEC % 3600) / 60)}분`;
