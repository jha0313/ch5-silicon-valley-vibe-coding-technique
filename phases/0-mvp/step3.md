# Step 3: api-route

## 읽어야 할 파일

프롬프트 상단에 CLAUDE.md/docs 전문이 주입되어 있다. 추가로 이전 step 산출물을 읽어라:

- `/docs/ARCHITECTURE.md` — 데이터 흐름, 에러 정규화
- `src/types/thumbnail.ts` — `ErrorCode`, `THUMBNAIL_SIZE`, `ALLOWED_N`, `DEFAULT_N`, `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES`, 응답 타입
- `src/lib/buildPrompt.ts` — `buildPrompt` 재사용
- `src/services/openai.ts` — `generateThumbnails`, `AppError` 재사용

## 작업

`POST /api/generate` 라우트 핸들러를 만든다. **TDD: 테스트 먼저.**

먼저 `src/app/api/generate/route.test.ts`를 작성한 뒤 `src/app/api/generate/route.ts`를 구현하라(TDD Guard). 테스트에서는 `src/services/openai`의 `generateThumbnails`를 모킹한다.

### `src/app/api/generate/route.ts`

- `export const runtime = "nodejs";`  (openai SDK/Buffer 사용)
- `export const maxDuration = 60;`    (이미지 생성 지연 대비)
- `export async function POST(req: Request): Promise<Response>`:
  1. `const form = await req.formData();`
  2. 필드 추출: `prompt`(string), `caption`(string|undefined), `n`(정수 파싱; `ALLOWED_N`에 없으면 `DEFAULT_N`), `image`(`form.get("image")`가 `File`이고 size>0이면 사용, 아니면 없음).
  3. **검증**(여기서 직접, 별도 모듈 만들지 말 것):
     - `prompt`가 공백이면 → `400` + `{ error: { code: "INVALID_INPUT", message: "프롬프트를 입력해주세요" } }`.
     - `image`가 있으면 타입이 `ACCEPTED_IMAGE_TYPES`에 없거나 size > `MAX_IMAGE_BYTES` → `400` + `{ error: { code: "INVALID_INPUT", message: "PNG·JPG·WebP, 10MB 이하만 가능해요" } }`.
  4. `const finalPrompt = buildPrompt({ prompt, caption, preset16x9: true });`
  5. `const images = await generateThumbnails({ finalPrompt, image: image ?? undefined, n, size: THUMBNAIL_SIZE });`
  6. 성공 → `Response.json({ images }, { status: 200 })` (`{ images: string[] }`).
  7. **에러 처리(try/catch):**
     - `AppError`면 → `Response.json({ error: { code: err.code, message: err.message } }, { status: err.httpStatus })`.
     - 그 외 예외 → `Response.json({ error: { code: "GENERATION_FAILED", message: "이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요" } }, { status: 502 })`.
     - **원본 에러/스택을 응답 본문에 넣지 마라**(CLAUDE.md CRITICAL).

### 테스트(`src/app/api/generate/route.test.ts`)

`vi.mock("@/services/openai")` 또는 상대경로로 `generateThumbnails`를 모킹(필요 시 `AppError`는 실제 구현 사용). `Request` + `FormData`로 요청을 구성해 `POST(req)` 호출 후 status/JSON 검증.

케이스:
- 정상(프롬프트만) → 200, body에 `images` 배열.
- 프롬프트 공백 → 400, `code:"INVALID_INPUT"` (service 미호출 확인).
- service가 `CONTENT_POLICY` throw → 422.
- service가 `MISSING_API_KEY` throw → 503.
- service가 `GENERATION_FAILED` throw → 502.
- 잘못된 이미지 타입/대용량 → 400, `INVALID_INPUT`.

> 참고: `next build`가 app/ 하위 비라우트 테스트 파일을 문제 삼으면 테스트를 `src/app/api/generate/__tests__/route.test.ts`로 옮겨도 된다(TDD Guard가 `__tests__/`도 인식).

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 실행.
2. 체크리스트: 외부 API를 service 통해서만 호출하는가(라우트에서 직접 OpenAI SDK 호출 금지) / 키를 라우트에서 직접 읽지 않는가 / 에러가 올바른 HTTP로 매핑되는가 / 원본 에러 비노출.
3. `phases/0-mvp/index.json`의 step 3 업데이트(`summary`에 라우트 경로·검증·에러 매핑 요약).

## 금지사항

- 라우트에서 OpenAI SDK를 직접 호출하지 마라. 이유: service 경유가 CLAUDE.md CRITICAL이자 테스트 seam.
- 별도 `validation.ts` 모듈을 만들지 마라. 이유: 검증은 라우트 인라인으로 충분(오버엔지니어링 회피).
- 테스트에서 실제 OpenAI를 호출하지 마라(service 모킹).
- 기존 테스트를 깨뜨리지 마라.
