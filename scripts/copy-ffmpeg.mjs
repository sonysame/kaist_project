// @ffmpeg/ffmpeg는 내부에서 new Worker(new URL(...))를 써서 Turbopack 번들에 넣을 수 없다.
// 그래서 dev/build 전에 public/ffmpeg 로 복사해 두고 브라우저에서 그대로 불러온다.
import { cpSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const from = `${root}node_modules/@ffmpeg/ffmpeg/dist/esm`;
const to = `${root}public/ffmpeg`;

rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true, filter: (p) => !p.endsWith(".d.ts") });
console.log("copied @ffmpeg/ffmpeg →", to);
