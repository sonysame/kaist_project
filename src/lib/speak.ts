"use client";

/** 브라우저에 들어 있는 영어 음성으로 단어를 읽어 준다 (무료, 서버 호출 없음) */
export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.9;
    const voice = synth.getVoices().find((v) => v.lang === "en-US") ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    // 음성 합성을 지원하지 않는 브라우저면 조용히 넘어간다
  }
}
