# Step 2: openai-service

## 읽어야 할 파일

프롬프트 상단에 CLAUDE.md/docs 전문이 주입되어 있다. 추가로 이전 step 산출물을 읽어라:

- `/docs/ARCHITECTURE.md` — `에러 정규화` 섹션
- `src/types/thumbnail.ts` — `ErrorCode`, `THUMBNAIL_SIZE` 등 (이 step에서 재사용)
- `src/lib/buildPrompt.ts` — 입력으로 받는 finalPrompt의 출처(직접 호출하진 않음)
- `vitest.config.ts` — 모킹/환경 설정

## 작업

gpt-image-2를 호출하는 **얇은** service 래퍼와 에러 정규화를 만든다. **TDD: 테스트 먼저.**

먼저 `src/services/openai.test.ts`를 작성한 뒤 `src/services/openai.ts`를 구현하라(TDD Guard).

### `src/services/openai.ts`

export 할 것:
- 에러 클래스: `class AppError extends Error { code: ErrorCode; httpStatus: number }` (생성자에서 code, message, httpStatus 받음)
- 메인 함수:
```ts
export type GenerateThumbnailsInput = {
  finalPrompt: string;
  image?: File;        // 참고 이미지(있으면 edit, 없으면 generate)
  n: number;
  size: string;        // THUMBNAIL_SIZE
};
export async function generateThumbnails(input: GenerateThumbnailsInput): Promise<string[]>
// 반환: "data:image/png;base64,<...>" 형식 data URL 배열
```

**반드시 지킬 핵심 규칙:**
1. **API 키는 함수 호출 시점에 `process.env.OPENAI_API_KEY`로 읽어라.** 없거나 빈 문자열이면 `throw new AppError("MISSING_API_KEY", "서버에 API 키가 설정되지 않았습니다(관리자 설정 필요)", 503)`.
2. **모듈 최상위에서 `new OpenAI()`를 호출하지 마라.** 키 확인 후 함수 내부에서 `new OpenAI({ apiKey })`를 생성하라. 이유: 키 없이 모듈을 import 하기만 해도 throw되어 빌드/테스트가 깨진다.
3. 분기: `image`가 있으면 `client.images.edit({ model: "gpt-image-2", image, prompt: finalPrompt, n, size })`, 없으면 `client.images.generate({ model: "gpt-image-2", prompt: finalPrompt, n, size })`.
4. 응답에서 `response.data[].b64_json`을 꺼내 `data:image/png;base64,${b64}`로 매핑해 배열로 반환. 데이터가 없으면 `throw new AppError("GENERATION_FAILED", "이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요", 502)`.
5. **에러 정규화(catch):**
   - 이미 `AppError`면 그대로 rethrow.
   - 콘텐츠 정책/모더레이션 거부(예: status 400 + code/type에 `moderation`/`safety`/`content_policy` 포함, 또는 메시지가 정책 거부를 가리킴) → `throw new AppError("CONTENT_POLICY", "콘텐츠 정책에 의해 거부됐어요. 프롬프트를 수정해 다시 시도해주세요", 422)`.
   - 그 외 전부(429 레이트리밋, 타임아웃, 네트워크, 5xx, 미상) → `throw new AppError("GENERATION_FAILED", "이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요", 502)`.
   - **OpenAI 원본 에러 메시지/스택을 AppError.message에 넣지 마라.** 이유: 정보 누출 방지(CLAUDE.md CRITICAL). 정규화된 사용자 문구만 사용.

### 테스트(`src/services/openai.test.ts`) — `openai` SDK를 모킹

`vi.mock("openai", ...)`로 가짜 `OpenAI` 클래스를 제공하고 `images.generate`/`images.edit`를 `vi.fn()`으로 둔다. 키는 `vi.stubEnv("OPENAI_API_KEY", "test-key")`로 설정(미설정 테스트에서는 빈 값/제거).

검증 케이스:
- 이미지 없음 → `images.generate`가 `model:"gpt-image-2"`, 올바른 `size`/`n`/`prompt`로 호출되고, `b64_json`이 `data:image/png;base64,...`로 매핑되어 반환된다.
- 이미지 있음 → `images.edit`가 호출된다.
- 키 미설정 → `AppError` (`code:"MISSING_API_KEY"`, `httpStatus:503`) throw.
- 모더레이션 류 에러 → `AppError` (`code:"CONTENT_POLICY"`, `httpStatus:422`) throw.
- 기타 에러 → `AppError` (`code:"GENERATION_FAILED"`, `httpStatus:502`) throw.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 실행.
2. 체크리스트: 모듈 최상위에서 OpenAI 인스턴스화하지 않았는가 / 에러 정규화가 4코드로 매핑되는가 / 원본 에러 노출이 없는가 / 테스트가 실제 API를 호출하지 않고 모킹하는가.
3. `phases/0-mvp/index.json`의 step 2 업데이트(`summary`에 `generateThumbnails`/`AppError` export 및 generate/edit 분기 요약).

## 금지사항

- 실제 OpenAI API를 테스트에서 호출하지 마라. 이유: 비용·키 필요·비결정성. 반드시 모킹.
- 모듈 로드 시점에 `new OpenAI()`를 만들지 마라(위 규칙 2).
- route/UI를 만들지 마라. 이유: 이후 step 담당.
- 기존 테스트를 깨뜨리지 마라.
