# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라(프롬프트 상단에 CLAUDE.md/docs 전문이 이미 주입되어 있다):

- `/docs/ARCHITECTURE.md` — 디렉토리 구조와 레이어 의도
- `/docs/ADR.md` — 기술 스택 결정(Next.js App Router, Vitest 등)

## 작업

이 레포는 greenfield이며 `CLAUDE.md`, `docs/`, `scripts/`, `.claude/`, `phases/`, `.gitignore` 만 존재한다. 여기에 Next.js 15 앱을 scaffolding 한다.

### 1. Next.js scaffolding (비어있지 않은 디렉토리 주의)

`create-next-app .`은 디렉토리가 비어있지 않아 거부된다. 따라서 **임시 디렉토리에 생성 후 복사**한다:

```bash
npx --yes create-next-app@latest /tmp/tn-scaffold \
  --ts --tailwind --app --src-dir --eslint --use-npm --import-alias "@/*" --yes
```

생성된 결과에서 아래를 **프로젝트 루트로 복사**하라(존재하는 파일은 덮어쓰지 말 것):
- `src/`, `public/`
- `package.json`, `tsconfig.json`, `next.config.*`, `postcss.config.*`, `next-env.d.ts`, eslint 설정 파일(`eslint.config.mjs` 또는 `.eslintrc.json`), `.prettier*`(있으면)

**금지:** 기존 `.gitignore`를 scaffold 것으로 덮어쓰지 마라. 이유: 기존 `.gitignore`에는 `phases/**/step*-output.json` 등 Harness 전용 무시 규칙이 있다. 만약 scaffold의 `.gitignore`에 `node_modules/`·`.next/`가 없다면 기존 파일에 **추가**만 하라(현재는 이미 있음).

복사 후 `/tmp/tn-scaffold`는 삭제해도 된다.

### 2. 의존성 설치

루트에서:
```bash
npm install
npm install openai
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

### 3. Vitest 설정

루트에 `vitest.config.ts` 생성. 요구사항:
- `@vitejs/plugin-react` 사용(컴포넌트 .tsx 테스트 대비)
- 기본 `environment: "node"` (컴포넌트 테스트는 파일 상단 `// @vitest-environment jsdom` 도크블록으로 개별 지정)
- `globals: true`
- alias `@` → `./src` (tsconfig의 `@/*`와 일치)

`package.json` scripts에 추가: `"test": "vitest run"`, `"test:watch": "vitest"`.

### 4. 환경변수 예시 파일

루트에 `.env.local.example` 생성:
```
OPENAI_API_KEY=
```
**실제 `.env.local` 파일이나 실제 키를 만들지 마라.**

### 5. 툴체인 검증용 sanity 테스트

`src/sanity.test.ts` 생성 — vitest 동작 확인용 최소 테스트(`expect(1 + 1).toBe(2)` 수준). vitest는 import 명시 권장: `import { describe, it, expect } from "vitest"`.

## Acceptance Criteria

```bash
npm run build   # Next.js 빌드 + 타입체크 통과
npm test        # vitest 통과(sanity 테스트)
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 체크리스트:
   - `src/app/`, `src/`(컴포넌트/타입/lib/services는 이후 step에서 생성) 구조가 ARCHITECTURE.md와 호환되는가?
   - `tsconfig.json`의 `strict`가 `true`인가?
   - `.gitignore`, `CLAUDE.md`, `docs/`, `scripts/`, `phases/`를 훼손하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 0을 업데이트:
   - 성공 → `"status": "completed"`, `"summary"`에 산출물 한 줄 요약(예: "Next.js15+TS+Tailwind+Vitest scaffolding 완료, alias @→src, .env.local.example 생성")
   - 3회 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"`

## 금지사항

- 앱 기능(폼/API/이미지 생성)을 만들지 마라. 이유: 이 step은 scaffolding 전용이다. 기능은 step 1~4에서 만든다.
- `next/font/google` 사용이 빌드 시 네트워크 의존으로 실패하면 `src/app/layout.tsx`에서 폰트를 시스템 폰트로 교체하라. 이유: 오프라인 빌드 실패 방지.
- `node_modules`를 커밋하지 마라(.gitignore가 처리).
- 기존 테스트를 깨뜨리지 마라.
