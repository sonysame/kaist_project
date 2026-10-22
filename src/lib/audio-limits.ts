// 브라우저(압축)와 서버(길이 확인)가 같이 쓰는 오디오 크기 기준

// Supabase 무료 플랜의 파일당 한도(50MB)보다 조금 작게
const MAX_FILE_BYTES = 48 * 1024 * 1024;
/** 재생·받아 적기 모두 이 음질 (16kHz 모노 MP3) */
export const AUDIO_KBPS = 32;

/** 학습 자료 하나에 담을 수 있는 가장 긴 오디오 (32kbps로 약 3시간 29분) */
export const MAX_PART_SEC = Math.floor((MAX_FILE_BYTES * 8) / (AUDIO_KBPS * 1000));
/** 이보다 긴 파일은 1부·2부로 나눈다. 둘을 넘게 나누지는 않는다. */
export const MAX_PARTS = 2;
export const MAX_DURATION_SEC = MAX_PART_SEC * MAX_PARTS;

export const partCount = (durationSec: number) => Math.ceil(durationSec / MAX_PART_SEC);

export const durationText = (sec: number) => `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분`;
