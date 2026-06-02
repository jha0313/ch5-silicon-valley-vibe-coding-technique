# Step 4: ui

## 읽어야 할 파일

프롬프트 상단에 CLAUDE.md/docs 전문이 주입되어 있다. 추가로 이전 step 산출물을 읽어라:

- `/docs/PRD.md` — 유저 저니(상태머신), 에러 4버킷, 디자인(다크·미니멀)
- `/docs/ARCHITECTURE.md` — 패턴(Server 셸 + 단일 Client 컴포넌트), 상태 관리
- `src/types/thumbnail.ts` — `ErrorCode`, 상수(`ALLOWED_N`, `DEFAULT_N`, `MAX_IMAGE_BYTES`, `ACCEPTED_IMAGE_TYPES`), 응답 타입
- `src/app/api/generate/route.ts` — 요청/응답 계약(`multipart/form-data` 필드명, 응답 `{ images }` / `{ error:{code,message} }`)
- `src/app/page.tsx`, `src/app/layout.tsx` — 기존 스캐폴드(교체/연결 대상)

## 작업

UI 전체를 담는 **단일 Client 컴포넌트**와 페이지 연결을 만든다. **TDD Guard가 컴포넌트 .tsx에도 테스트를 요구하므로 스모크 테스트를 먼저 작성하라.**

### 1. 스모크 테스트 먼저 — `src/components/ThumbnailGenerator.test.tsx`

파일 상단에 `// @vitest-environment jsdom`. `@testing-library/react`로 렌더 후 최소 검증:
- 프롬프트 입력 필드와 "썸네일 생성" 버튼이 렌더된다.
- 프롬프트가 비어있을 때 생성 버튼이 비활성(disabled)이다.

(fetch 호출까지 테스트할 필요 없음 — 렌더/검증 수준의 스모크면 충분.)

### 2. `src/components/ThumbnailGenerator.tsx` (`"use client"`)

상태(`useState`): `prompt`, `caption`, `imageFile`(File|null), `n`(기본 `DEFAULT_N`), `status`(`"idle"|"loading"|"success"|"error"`), `images`(string[]), `error`({code,message}|null), `inlineError`(string|null).

폼(와이어프레임은 PRD 참고):
- 프롬프트 textarea(필수, 예시 placeholder).
- 썸네일 문구 text input(옵션).
- 참고 이미지 `<input type="file" accept="image/png,image/jpeg,image/webp">` + 선택 시 미리보기 + 제거(x) 버튼.
- 후보 수: `ALLOWED_N`(2/3/4) 라디오/세그먼트, 기본 `DEFAULT_N`.
- "썸네일 생성" 버튼: `prompt`가 공백이거나 `status==="loading"`이면 disabled.

클라이언트 검증:
- 파일 선택 시 타입이 `ACCEPTED_IMAGE_TYPES`에 없거나 size > `MAX_IMAGE_BYTES` → `inlineError` 설정 후 선택 취소("PNG·JPG·WebP, 10MB 이하만 가능해요").

제출(`onSubmit`):
- `FormData`에 `prompt`,`caption`,`n`,`image`(있으면) 추가.
- `AbortController`로 ~70s 타임아웃을 건 `fetch("/api/generate", { method:"POST", body: formData, signal })`.
- `status="loading"`로 전환, 폼 비활성.
- `res.ok` → `{ images }` 파싱 → `status="success"`.
- `!res.ok` → `{ error }` 파싱 → `status="error"`, `error` 저장.
- abort/네트워크 예외 → `status="error"`, `error={code:"GENERATION_FAILED", message:"이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요"}`.

렌더 상태:
- **loading**: 스피너 + "생성 중… (최대 1분 소요)", 폼 비활성.
- **success**: "결과 (N장)" + [다시 생성](같은 입력 재제출). 16:9 카드 그리드, 각 카드 이미지 미리보기 + 다운로드 링크 `<a href={dataUrl} download={`thumbnail-${i+1}.png`}>`.
- **error**: 폼 상단 배너에 `error.message`. `error.code === "GENERATION_FAILED"`일 때만 [재시도] 버튼(같은 입력 재제출). 입력값은 유지.

디자인: 다크모드 고정, 미니멀, 무채색 + 포인트 1색. Tailwind 사용.

### 3. `src/app/page.tsx` — Server Component 셸

기존 스캐폴드 내용을 교체. 타이틀("🎬 유튜브 썸네일 생성기")·한 줄 설명과 함께 `<ThumbnailGenerator />`를 렌더한다. (page.tsx는 TDD Guard 면제.)

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. 위 AC 실행.
2. 체크리스트: 컴포넌트가 `/api/generate`만 호출하고 OpenAI를 직접 부르지 않는가 / 4상태 전이가 구현됐는가 / 다운로드가 data URL로 동작하는가 / 단일 컴포넌트로 유지(조각 컴포넌트 분리 안 함).
3. `phases/0-mvp/index.json`의 step 4 업데이트(`summary`에 컴포넌트·페이지 연결·상태머신 요약).

## 금지사항

- 컴포넌트에서 OpenAI를 직접 호출하지 마라. 이유: 키 보호(CLAUDE.md CRITICAL), 반드시 `/api/generate` 경유.
- `ResultGrid`/`ErrorBanner` 등 조각 컴포넌트로 분리하지 마라. 이유: 단일 페이지 도구라 이득 없음(오버엔지니어링 회피).
- 로그인/결제/생성 히스토리/이미지 저장을 추가하지 마라. 이유: MVP 범위 밖.
- 기존 테스트를 깨뜨리지 마라.
