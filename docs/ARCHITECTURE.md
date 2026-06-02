# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Server Component 셸 → <ThumbnailGenerator/> 렌더만
│   └── api/generate/route.ts    # POST: formData 파싱·검증·service 호출·에러→HTTP 매핑
├── components/
│   └── ThumbnailGenerator.tsx   # "use client" — UI 전체(폼+상태머신+결과+에러) 단일 컴포넌트
├── lib/
│   └── buildPrompt.ts           # 순수 함수(썸네일 최적화·문구 주입), TDD
├── services/
│   └── openai.ts                # gpt-image-2 얇은 래퍼 + 에러 정규화, TDD(SDK 모킹)
└── types/
    └── thumbnail.ts             # 라우트·컴포넌트 공유 타입(요청/응답/에러코드)
```

레이어를 5개로 둔 이유:
- `route.ts` — API 키를 서버에만 두기 위한 경계. 클라이언트의 OpenAI 직접 호출 금지를 강제한다.
- `services/openai.ts` — 단위 테스트 seam. SDK만 모킹하면 검증되는 얇은 함수(generate/edit 분기 + 에러 변환만).
- `lib/buildPrompt.ts` — 평범한 프롬프트를 썸네일용으로 보강 + 문구 주입하는 핵심 가치. 순수 함수라 TDD에 최적.
- `components/ThumbnailGenerator.tsx` — 단일 페이지 인터랙티브 도구라 컴포넌트를 더 쪼개지 않고 한 컴포넌트의 `useState`로 관리.
- `types/thumbnail.ts` — 라우트↔컴포넌트 계약 드리프트 방지.

## 패턴
- Server Component 기본. 인터랙션이 필요한 페이지 본문만 단일 Client 컴포넌트(`ThumbnailGenerator`)로 분리.
- 조각 컴포넌트(ResultGrid/ErrorBanner 등)는 만들지 않는다 — 이득 없는 분할 회피.

## 데이터 흐름
```
사용자 입력(프롬프트/문구/이미지/후보 수)
  → ThumbnailGenerator (클라 검증)
  → POST /api/generate (multipart/form-data)
  → route: 검증·키 체크 → buildPrompt() → services/openai.generateThumbnails()
  → gpt-image-2 (images.generate | images.edit)
  → base64[] 응답 → { images: ["data:image/png;base64,..."] } JSON
  → UI 결과 그리드 / 다운로드
실패 시: services가 AppError 정규화 → route가 HTTP + { error:{code,message} } → UI 배너
```

## 상태 관리
- 클라이언트 상태는 `ThumbnailGenerator` 내부 `useState`: 입력값 + 상태머신(`idle | loading | success | error`) + 결과/에러.
- 서버 상태 영속화 없음(이미지 base64를 응답으로 바로 반환, 저장 안 함).

## 에러 정규화
`services/openai.ts`가 OpenAI 예외를 `AppError { code, message, httpStatus }`(코드: `INVALID_INPUT`·`MISSING_API_KEY`·`CONTENT_POLICY`·`GENERATION_FAILED`)로 변환 → `route.ts`가 동일 HTTP 상태와 `{ error:{code,message} }`로 반환 → 컴포넌트가 `code`로 문구/재시도 분기. 응답에 OpenAI 원본 에러/스택은 노출하지 않는다.
