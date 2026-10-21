# ListenUp · 진짜 영어로 듣기 공부

영어 오디오(팟캐스트, 강의, 인터뷰)를 올리면 **화자별 영어 대본**과 **한국어 해석**을 만들어 주는 영어 학습 웹앱이에요.

## 주요 기능

- **화자 분리 대본**: 누가 말했는지 나눠서 받아 적고, 자기소개 등으로 화자 이름을 자동으로 넣어요.
- **KOR 버튼으로 해석**: 문장 옆 KOR 버튼을 누르면 한국어 해석이 펼쳐져요. 항상 보기로 바꿀 수도 있어요.
- **학습용 플레이어**: 재생 속도(0.75~1.25배), 5초 앞뒤 이동, 문장 반복, "이 문장만 듣기", 재생 중인 단어 강조
- **단어장**: 단어를 누르면 문맥에 맞는 뜻과 발음이 나오고 저장돼요. 목록, 카드로 외우기, 퀴즈(뜻 고르기 / 단어 고르기 / 빈칸 채우기)로 복습해요.
- **광고 숨기기**: 광고 구간을 자동으로 찾아 숨기고, 재생할 때도 건너뛰어요.
- **고유명사 교정**: 음성 인식이 잘못 들은 이름을 문맥으로 고쳐요. (예: "10 Cent" → "Tencent")
- **캐릭터로 보기**: 화자마다 오리지널 캐릭터가 말하는 장면을 오디오에 맞춰 화면에서 보여 줘요.
- **내보내기**: 대본 TXT, 자막 SRT, 단어장 CSV

로그인 없이 쓰는 앱이에요. 단어장은 브라우저마다 따로 저장돼요.

## 기술 구성

| 부분 | 사용한 것 |
|---|---|
| 웹 | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| 오디오 압축·분할 | 브라우저 안의 ffmpeg.wasm (16kHz 모노 MP3, 20분 구간 + 30초 겹침) |
| 전사·화자 분리 | Gemini `gemini-3.5-transcribe` (무료 등급) |
| 번역·단어 뜻·광고 찾기 | Gemini `gemini-3.5-flash-lite` |
| 고유명사 교정 | Gemini `gemini-3.5-flash` |
| DB·파일 저장 | Supabase (Postgres, Storage) |
| 배포 | Vercel |

처리 흐름과 결정 사항은 [docs/PRD.md](docs/PRD.md)에 정리돼 있어요.

## 로컬에서 실행하기

### 1. 준비물
- Node.js 20 이상
- [Google AI Studio](https://aistudio.google.com/apikey) API 키 (무료)
- [Supabase](https://supabase.com) 프로젝트 (무료 플랜)

### 2. Supabase 설정
Supabase 대시보드 → **SQL Editor**에서 아래 파일을 순서대로 실행해요.
1. [supabase/schema.sql](supabase/schema.sql): 테이블, 보안 설정(RLS), 오디오 저장 버킷
2. [supabase/migrations/002_ads_and_names.sql](supabase/migrations/002_ads_and_names.sql): 광고 표시, 분석 완료 칸 (schema.sql을 새로 실행했다면 이미 들어 있어서 건너뛰어도 돼요)

### 3. 환경 변수
`.env.example`을 `.env.local`로 복사하고 값을 채워요.

```bash
cp .env.example .env.local
```

| 이름 | 어디서 |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys (절대 공개하지 마세요) |

### 4. 실행

```bash
npm install
```

```bash
npm run dev
```

http://localhost:3000 을 열어요. `npm run dev`와 `npm run build`는 시작할 때 ffmpeg 파일을 `public/ffmpeg`로 복사해요.

## Vercel에 배포하기

1. 이 저장소를 Vercel에서 Import 해요.
2. Environment Variables에 위 4개 값을 넣어요.
3. Deploy 해요. 처리 API는 Vercel Hobby 플랜 최대 시간(300초) 안에서 한 단계씩 나눠 실행돼요.

## 알아 둘 점

- Gemini 무료 등급에 보낸 데이터는 Google이 제품 개선에 쓸 수 있어요.
- 무료 등급은 하루 요청 수 제한이 있어요. 한도에 걸리면 앱이 기다렸다가 이어서 처리해요.
- 로그인이 없어서 배포 주소를 아는 사람은 누구나 작업 목록을 보고 업로드할 수 있어요.
- 파일당 최대 약 3시간 20분(압축 후 50MB, Supabase 무료 플랜 한도)까지 올릴 수 있어요.
