import { beforeEach, describe, expect, it, vi } from "vitest";

// service의 generateThumbnails만 모킹(실제 OpenAI 미호출). AppError는 실제 구현을 써야
// 라우트의 `err instanceof AppError` 분기가 동작한다.
const { generateThumbnailsMock } = vi.hoisted(() => ({
  generateThumbnailsMock: vi.fn(),
}));

vi.mock("@/services/openai", async (importActual) => {
  const actual = await importActual<typeof import("@/services/openai")>();
  return { ...actual, generateThumbnails: generateThumbnailsMock };
});

import { AppError } from "@/services/openai";
import { POST } from "./route";

function makeRequest(fields: {
  prompt?: string;
  caption?: string;
  n?: string;
  image?: File;
}): Request {
  const form = new FormData();
  if (fields.prompt !== undefined) form.append("prompt", fields.prompt);
  if (fields.caption !== undefined) form.append("caption", fields.caption);
  if (fields.n !== undefined) form.append("n", fields.n);
  if (fields.image !== undefined) form.append("image", fields.image);
  return new Request("http://localhost/api/generate", {
    method: "POST",
    body: form,
  });
}

beforeEach(() => {
  generateThumbnailsMock.mockReset();
});

describe("POST /api/generate", () => {
  it("프롬프트만 정상 → 200, body.images 배열", async () => {
    generateThumbnailsMock.mockResolvedValue([
      "data:image/png;base64,AAAA",
      "data:image/png;base64,BBBB",
    ]);

    const res = await POST(makeRequest({ prompt: "고양이 유튜버 썸네일" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      images: ["data:image/png;base64,AAAA", "data:image/png;base64,BBBB"],
    });
    expect(generateThumbnailsMock).toHaveBeenCalledTimes(1);
  });

  it("프롬프트 공백 → 400 INVALID_INPUT, service 미호출", async () => {
    const res = await POST(makeRequest({ prompt: "   " }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(generateThumbnailsMock).not.toHaveBeenCalled();
  });

  it("프롬프트 누락 → 400 INVALID_INPUT, service 미호출", async () => {
    const res = await POST(makeRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(generateThumbnailsMock).not.toHaveBeenCalled();
  });

  it("잘못된 이미지 타입 → 400 INVALID_INPUT, service 미호출", async () => {
    const image = new File(["gif-bytes"], "ref.gif", { type: "image/gif" });
    const res = await POST(makeRequest({ prompt: "유효한 프롬프트", image }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(generateThumbnailsMock).not.toHaveBeenCalled();
  });

  it("service가 CONTENT_POLICY throw → 422", async () => {
    generateThumbnailsMock.mockRejectedValue(
      new AppError("CONTENT_POLICY", "콘텐츠 정책에 의해 거부됐어요", 422),
    );

    const res = await POST(makeRequest({ prompt: "프롬프트" }));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("CONTENT_POLICY");
  });

  it("service가 MISSING_API_KEY throw → 503", async () => {
    generateThumbnailsMock.mockRejectedValue(
      new AppError("MISSING_API_KEY", "서버에 API 키가 설정되지 않았습니다", 503),
    );

    const res = await POST(makeRequest({ prompt: "프롬프트" }));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("MISSING_API_KEY");
  });

  it("service가 GENERATION_FAILED throw → 502", async () => {
    generateThumbnailsMock.mockRejectedValue(
      new AppError("GENERATION_FAILED", "이미지 생성에 실패했어요", 502),
    );

    const res = await POST(makeRequest({ prompt: "프롬프트" }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe("GENERATION_FAILED");
  });

  it("AppError가 아닌 예외 → 502 GENERATION_FAILED, 원본 에러 비노출", async () => {
    generateThumbnailsMock.mockRejectedValue(new Error("내부 스택 노출 금지"));

    const res = await POST(makeRequest({ prompt: "프롬프트" }));
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error.code).toBe("GENERATION_FAILED");
    expect(JSON.stringify(body)).not.toContain("내부 스택 노출 금지");
  });
});
