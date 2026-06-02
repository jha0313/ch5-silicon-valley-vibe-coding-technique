# 프로젝트: 유튜브 썸네일 생성기

프롬프트(+옵션 이미지/문구)로 OpenAI `gpt-image-2`를 호출해 16:9 유튜브 썸네일 후보를 생성·다운로드하는 단일 페이지 웹 도구.

## 기술 스택
- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS
- OpenAI `gpt-image-2` (이미지 생성/편집) — `openai` npm SDK
- Vitest (테스트)

## 아키텍처 규칙
- CRITICAL: OpenAI 등 외부 API 호출은 `app/api/` 라우트 핸들러 + `src/services/` 래퍼에서만 한다. 클라이언트 컴포넌트에서 외부 API를 직접 호출하지 말 것.
- CRITICAL: `OPENAI_API_KEY`는 서버에서만 읽고 클라이언트로 절대 노출하지 말 것. API 응답에 OpenAI 원본 에러 메시지/스택을 그대로 노출하지 말 것 — 정규화된 에러 코드/문구만 반환한다.
- 디렉토리 분리: 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 로직은 `src/lib/`, 외부 API 래퍼는 `src/services/`.
- 인터랙티브 단일 페이지 도구이므로 페이지는 Server Component 셸 + 단일 Client 컴포넌트로 구성한다. 이득 없는 조각 컴포넌트로 쪼개지 말 것.

## 개발 프로세스
- CRITICAL: 새 기능(`lib/`, `services/`, `app/api/` 로직)은 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD). UI 컴포넌트(`components/`, 페이지)는 TDD 예외.
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
