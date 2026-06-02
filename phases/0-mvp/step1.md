# Step 1: domain

## 읽어야 할 파일

프롬프트 상단에 CLAUDE.md/docs 전문이 주입되어 있다. 추가로 이전 step 산출물을 읽어라:

- `/docs/ARCHITECTURE.md` — `에러 정규화` 섹션, 데이터 흐름
- `/docs/PRD.md` — 에러 4버킷, 유저 저니
- `package.json`, `vitest.config.ts`, `tsconfig.json` — 테스트/alias 설정 확인

## 작업

공유 타입·상수와 순수 함수 `buildPrompt`를 만든다. **TDD: 테스트를 먼저 작성하라.**

### 1. 공유 타입/상수 — `src/types/thumbnail.ts`

(types/ 폴더는 TDD Guard 면제) 아래를 export 하라:

- `ErrorCode = "INVALID_INPUT" | "MISSING_API_KEY" | "CONTENT_POLICY" | "GENERATION_FAILED"`
- 응답 계약:
  - `GenerateSuccess = { images: string[] }`  // base64 data URL 배열
  - `GenerateErrorBody = { error: { code: ErrorCode; message: string } }`
  - `GenerateResponse = GenerateSuccess | GenerateErrorBody`
- `BuildPromptInput = { prompt: string; caption?: string; preset16x9?: boolean }`
- 상수(클라이언트·서버 공유):
  - `THUMBNAIL_SIZE = "1280x720"` (정확한 16:9, gpt-image-2 제약 충족)
  - `ALLOWED_N = [2, 3, 4]`, `DEFAULT_N = 2`
  - `MAX_IMAGE_BYTES = 10 * 1024 * 1024`
  - `ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"]`

### 2. 프롬프트 빌더 — `src/lib/buildPrompt.ts` (+ 테스트 먼저)

먼저 `src/lib/buildPrompt.test.ts`를 작성한 뒤 구현하라(TDD Guard가 테스트 없는 구현을 차단함).

시그니처:
```ts
export function buildPrompt(input: BuildPromptInput): string
```

요구 동작(구현 문구/세부는 재량, 단 아래 규칙은 반드시 만족):
- 항상 사용자의 `prompt` 내용을 결과에 포함한다.
- `preset16x9`가 true(기본값 true로 취급)일 때 유튜브 썸네일 최적화 지시를 덧붙인다: 고대비, 강한 시선 집중 주제, 텍스트가 들어갈 여백 확보, 16:9 가로 구도, 선명하고 클릭을 부르는 스타일.
- `caption`이 비어있지 않으면 "다음 문구를 이미지 안에 정확히, 또렷하게 렌더링하라: <caption>" 취지의 지시를 포함한다. `caption`이 없거나 공백이면 문구 관련 지시를 넣지 않는다.
- 순수 함수: 부작용 없음, `process.env` 접근 금지, 네트워크/IO 금지.

테스트가 검증할 것(예):
- 결과에 사용자 prompt 텍스트가 포함된다.
- caption 제공 시 결과에 caption 텍스트가 포함된다.
- caption 미제공/공백 시 caption 텍스트가 포함되지 않는다.
- 반환값은 비어있지 않은 문자열이다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트: ARCHITECTURE.md 디렉토리(`src/types`, `src/lib`) 준수 / TS strict 통과 / `buildPrompt`가 순수 함수인가.
3. `phases/0-mvp/index.json`의 step 1 업데이트(성공 시 `summary`에 생성 파일·export 목록 요약).

## 금지사항

- OpenAI 호출/SDK import를 하지 마라. 이유: 이 step은 순수 도메인 레이어다.
- service/route/UI 파일을 만들지 마라. 이유: 이후 step 담당.
- `buildPrompt`에서 `process.env`를 읽지 마라. 이유: 순수성 유지 + 테스트 용이성.
- 기존 테스트(sanity 포함)를 깨뜨리지 마라.
