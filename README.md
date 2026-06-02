# 유튜브 썸네일 생성기

프롬프트(+옵션 이미지/문구)로 OpenAI `gpt-image-2`를 호출해 16:9 유튜브 썸네일
후보를 생성·다운로드하는 단일 페이지 웹 도구입니다.

## 기술 스택
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS
- OpenAI `gpt-image-2`
- Vitest

## 개발
```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
```

## 환경 변수
`.env.local`에 `OPENAI_API_KEY`를 설정하세요. 키는 서버에서만 사용되며
클라이언트로 노출되지 않습니다.

## CI
PR을 올리면 GitHub Actions가 OpenAI 모델로 diff를 분석해 Risk Score와
요약 리뷰를 코멘트로 남깁니다. (`.github/workflows/gpt-pr-review.yml`)
