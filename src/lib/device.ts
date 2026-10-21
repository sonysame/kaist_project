"use client";

const KEY = "device-id";
let memory: string | null = null;

/**
 * 로그인 기능 전에 쓰던 브라우저별 익명 ID. 지금은 로그인한 뒤 이 브라우저에서 저장해 둔 옛 단어를
 * 계정으로 옮길 때만 쓴다 (/api/vocab GET). 저장소를 못 쓰는 환경이면 이번 탭에서만 유지된다.
 */
export function getDeviceId() {
  if (memory) return memory;
  try {
    memory = localStorage.getItem(KEY);
    if (!memory) {
      memory = crypto.randomUUID();
      localStorage.setItem(KEY, memory);
    }
  } catch {
    memory ??= crypto.randomUUID();
  }
  return memory;
}

export function vocabFetch(input: string, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", "x-device-id": getDeviceId(), ...init.headers },
  });
}
