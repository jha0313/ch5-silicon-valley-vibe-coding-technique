// GPT 기반 PR 리뷰 스크립트.
// PR diff를 OpenAI 모델에 보내 5축 Risk Score 채점 + 한국어 요약 리뷰를 받고,
// 결과를 PR에 단일 코멘트로 작성(있으면 업데이트)한다.

import OpenAI from "openai";

const {
  OPENAI_API_KEY,
  OPENAI_MODEL = "gpt-5",
  GITHUB_TOKEN,
  REPO,
  PR_NUMBER,
} = process.env;

// diff가 너무 길면 토큰/비용이 폭증하므로 상한을 둔다(문자 기준).
const MAX_DIFF_CHARS = 60_000;

// 코멘트를 다시 찾기 위한 숨김 마커.
const MARKER = "<!-- gpt-pr-review -->";

// 각 축의 만점. Risk Score = 높을수록 위험.
const MAX_SCORE = {
  security: 30,
  scope: 20,
  breaking: 20,
  tests: 15,
  migration: 15,
};

// 총점 → 위험 등급. max는 해당 등급의 상한(이하)을 뜻한다.
const RISK_LEVELS = [
  {
    max: 15,
    label: "risk:low",
    emoji: "🟢",
    action: "AI 코멘트만. 1명 승인으로 auto-merge 후보.",
  },
  {
    max: 35,
    label: "risk:medium",
    emoji: "🟡",
    action: "사람 리뷰어 1명 필수 지정. Auto-merge 비활성.",
  },
  {
    max: 60,
    label: "risk:high",
    emoji: "🟠",
    action: "시니어 1명 지정 + Security/Architecture 리뷰 추가 호출.",
  },
  {
    max: 100,
    label: "risk:critical",
    emoji: "🔴",
    action: "즉시 사람 호출(Slack 알림). RFC/ADR 링크 요구. Merge 차단.",
  },
];
const RISK_LABELS = RISK_LEVELS.map((l) => l.label);

const GITHUB_API = "https://api.github.com";

function assertEnv() {
  const missing = ["OPENAI_API_KEY", "GITHUB_TOKEN", "REPO", "PR_NUMBER"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    console.error(`필수 환경변수 누락: ${missing.join(", ")}`);
    process.exit(1);
  }
}

async function gh(path, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText}: ${path}`);
  }
  return res;
}

async function getPr() {
  const res = await gh(`/repos/${REPO}/pulls/${PR_NUMBER}`);
  return res.json();
}

async function getFiles() {
  const files = [];
  for (let page = 1; ; page++) {
    const res = await gh(
      `/repos/${REPO}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`,
    );
    const batch = await res.json();
    files.push(...batch);
    if (batch.length < 100) break;
  }
  return files;
}

// 파일별 patch를 이어붙여 리뷰용 diff 텍스트를 만든다. 상한을 넘으면 잘라낸다.
function buildDiff(files) {
  let diff = "";
  let truncated = false;
  for (const f of files) {
    const header = `\n### ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n`;
    const patch = f.patch ?? "(binary 또는 patch 없음)";
    if (diff.length + header.length + patch.length > MAX_DIFF_CHARS) {
      truncated = true;
      break;
    }
    diff += `${header}${patch}\n`;
  }
  return { diff, truncated };
}

const SYSTEM_PROMPT = `당신은 시니어 코드 리뷰어입니다. 주어진 GitHub Pull Request의 diff를 검토해
(1) 머지 위험도를 아래 5개 축으로 채점하고 (2) 한국어로 간결한 리뷰를 작성합니다.
diff에 실제로 존재하는 근거만 사용하고, 추측하거나 지어내지 마세요.

## Risk Score Rubric (총 100점, 높을수록 위험)

1. 보안 (security) — 0~30점
   - 0점: 보안 표면에 영향 없음
   - 만점: auth·permission·secret·암호화 관련 변경, 미검증 사용자 입력 등 새 외부 입력 경로, 알려진 CVE가 있는 의존성 추가
   - 보안은 한 번 뚫리면 복구가 어려워 가중치가 가장 높습니다.

2. 스코프 (scope) — 0~20점
   - 변경 파일 수·라인 수·영향 모듈 수에 비례
   - 약 5파일/100줄 = 낮음, 30파일/2000줄 이상 = 만점에 근접
   - 큰 PR은 사람 리뷰가 필수입니다.

3. breaking change — 0~20점
   - public API 시그니처 변경, DB 스키마 변경, 환경 변수 추가/제거, deprecated 마킹
   - backward compatibility를 깨는 변경일수록 높게

4. 테스트 커버리지 (tests) — 0~15점 (신뢰도가 낮을수록 높은 점수)
   - 새 코드에 대응하는 테스트 부재, 기존 테스트 삭제, 커버리지 하락 시 높게
   - 테스트가 충실하면 0점에 가깝게

5. 마이그레이션 (migration) — 0~15점
   - DB 마이그레이션, 데이터 백필, 환경 설정 변경 동반 여부
   - 롤백이 어려운 변경일수록 높게

각 축은 정수로 채점하고 상한을 넘기지 마세요.
findings에는 코드 근거가 있는 항목만 넣으세요.`;

const RESPONSE_SCHEMA = {
  name: "pr_review",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      scores: {
        type: "object",
        additionalProperties: false,
        properties: {
          security: { type: "integer" },
          scope: { type: "integer" },
          breaking: { type: "integer" },
          tests: { type: "integer" },
          migration: { type: "integer" },
        },
        required: ["security", "scope", "breaking", "tests", "migration"],
      },
      summary: { type: "string" },
      findings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            severity: { type: "string", enum: ["low", "medium", "high"] },
            detail: { type: "string" },
          },
          required: ["title", "severity", "detail"],
        },
      },
      recommendation: { type: "string" },
    },
    required: ["scores", "summary", "findings", "recommendation"],
  },
};

async function review({ pr, stats, diff, truncated }) {
  const client = new OpenAI({ apiKey: OPENAI_API_KEY });
  const userContent = [
    `저장소: ${REPO}`,
    `PR #${PR_NUMBER}: ${pr.title}`,
    "",
    "설명:",
    pr.body || "(없음)",
    "",
    `변경 통계: ${stats.changedFiles} files, +${stats.additions} / -${stats.deletions}`,
    truncated ? "주의: diff가 길어 일부만 포함되었습니다." : "",
    "",
    "=== DIFF ===",
    diff,
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_schema", json_schema: RESPONSE_SCHEMA },
  });

  return JSON.parse(completion.choices[0].message.content);
}

// 모델이 범위를 벗어난 점수를 줄 수 있으므로 0~만점으로 보정.
function clampScores(raw) {
  const out = {};
  for (const key of Object.keys(MAX_SCORE)) {
    const v = Math.round(raw?.[key] ?? 0);
    out[key] = Math.max(0, Math.min(MAX_SCORE[key], v));
  }
  return out;
}

function riskLevel(total) {
  return RISK_LEVELS.find((l) => total <= l.max) ?? RISK_LEVELS.at(-1);
}

function renderComment({ data, scores, total, level, stats, truncated }) {
  const sevEmoji = { high: "🔴", medium: "🟡", low: "🟢" };
  const findings = data.findings?.length
    ? data.findings
        .map((f) => `- ${sevEmoji[f.severity] ?? "•"} **${f.title}** — ${f.detail}`)
        .join("\n")
    : "_특이사항 없음_";

  return [
    MARKER,
    "## 🤖 GPT PR 리뷰",
    "",
    `### Risk Score: ${total} / 100 — ${level.emoji} \`${level.label}\``,
    "",
    "| 축 | 점수 | 만점 |",
    "|---|---:|---:|",
    `| 🔐 보안 | ${scores.security} | 30 |`,
    `| 📦 스코프 | ${scores.scope} | 20 |`,
    `| 💥 Breaking change | ${scores.breaking} | 20 |`,
    `| 🧪 테스트 커버리지 | ${scores.tests} | 15 |`,
    `| 🗄️ 마이그레이션 | ${scores.migration} | 15 |`,
    "",
    `> **권장 처리:** ${level.action}`,
    "",
    "### 요약",
    data.summary,
    "",
    "### 주요 발견",
    findings,
    "",
    "### 권장 사항",
    data.recommendation,
    "",
    "---",
    `<sub>model: ${OPENAI_MODEL} · ${stats.changedFiles} files, +${stats.additions}/-${stats.deletions}${truncated ? " · diff truncated" : ""}</sub>`,
  ].join("\n");
}

// risk:* 라벨을 PR에 부착한다. 다른 risk:* 라벨은 제거해 항상 1개만 유지.
// (없는 라벨명은 POST 시 GitHub가 기본 색으로 자동 생성한다.)
async function applyRiskLabel(pr, level) {
  const current = (pr.labels ?? []).map((l) => l.name);
  for (const name of current) {
    if (RISK_LABELS.includes(name) && name !== level.label) {
      await gh(
        `/repos/${REPO}/issues/${PR_NUMBER}/labels/${encodeURIComponent(name)}`,
        { method: "DELETE" },
      );
    }
  }
  if (!current.includes(level.label)) {
    await gh(`/repos/${REPO}/issues/${PR_NUMBER}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels: [level.label] }),
    });
  }
}

async function upsertComment(body) {
  const res = await gh(
    `/repos/${REPO}/issues/${PR_NUMBER}/comments?per_page=100`,
  );
  const comments = await res.json();
  const existing = comments.find((c) => c.body?.includes(MARKER));
  if (existing) {
    await gh(`/repos/${REPO}/issues/comments/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify({ body }),
    });
  } else {
    await gh(`/repos/${REPO}/issues/${PR_NUMBER}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
  }
}

async function main() {
  assertEnv();
  const pr = await getPr();
  const files = await getFiles();
  const { diff, truncated } = buildDiff(files);
  const stats = {
    changedFiles: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
  };

  const data = await review({ pr, stats, diff, truncated });
  const scores = clampScores(data.scores);
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  const level = riskLevel(total);
  const body = renderComment({ data, scores, total, level, stats, truncated });
  await upsertComment(body);
  await applyRiskLabel(pr, level);

  console.log(`리뷰 코멘트 작성 완료. Risk Score ${total}/100 (${level.label}).`);
}

main().catch((err) => {
  // 정규화된 메시지만 로그로 남기고 종료(원본 스택/시크릿 노출 방지).
  console.error(`리뷰 실패: ${err.message}`);
  process.exit(1);
});
