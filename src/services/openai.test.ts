import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { THUMBNAIL_SIZE } from "@/types/thumbnail";

// openai SDK를 모킹 — 실제 API를 호출하지 않는다(비용·키·비결정성 회피).
const { generateMock, editMock } = vi.hoisted(() => ({
  generateMock: vi.fn(),
  editMock: vi.fn(),
}));

vi.mock("openai", () => {
  class OpenAI {
    // 함수 내부에서 new OpenAI({ apiKey })로 생성된다(최상위 인스턴스화 금지).
    images = { generate: generateMock, edit: editMock };
  }
  return { default: OpenAI };
});

import { AppError, generateThumbnails } from "@/services/openai";

beforeEach(() => {
  generateMock.mockReset();
  editMock.mockReset();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("generateThumbnails", () => {
  it("이미지 없으면 images.generate를 올바른 인자로 호출하고 b64를 data URL로 매핑한다", async () => {
    generateMock.mockResolvedValue({
      data: [{ b64_json: "AAAA" }, { b64_json: "BBBB" }],
    });

    const result = await generateThumbnails({
      finalPrompt: "썸네일 프롬프트",
      n: 2,
      size: THUMBNAIL_SIZE,
    });

    expect(editMock).not.toHaveBeenCalled();
    expect(generateMock).toHaveBeenCalledTimes(1);
    expect(generateMock).toHaveBeenCalledWith({
      model: "gpt-image-2",
      prompt: "썸네일 프롬프트",
      n: 2,
      size: THUMBNAIL_SIZE,
    });
    expect(result).toEqual([
      "data:image/png;base64,AAAA",
      "data:image/png;base64,BBBB",
    ]);
  });

  it("이미지 있으면 images.edit를 호출한다(generate 미호출)", async () => {
    editMock.mockResolvedValue({ data: [{ b64_json: "CCCC" }] });
    const image = new File(["ref"], "ref.png", { type: "image/png" });

    const result = await generateThumbnails({
      finalPrompt: "편집 프롬프트",
      image,
      n: 1,
      size: THUMBNAIL_SIZE,
    });

    expect(generateMock).not.toHaveBeenCalled();
    expect(editMock).toHaveBeenCalledTimes(1);
    expect(editMock).toHaveBeenCalledWith({
      model: "gpt-image-2",
      image,
      prompt: "편집 프롬프트",
      n: 1,
      size: THUMBNAIL_SIZE,
    });
    expect(result).toEqual(["data:image/png;base64,CCCC"]);
  });

  it("API 키 미설정이면 MISSING_API_KEY(503) AppError를 던진다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await expect(
      generateThumbnails({ finalPrompt: "x", n: 2, size: THUMBNAIL_SIZE }),
    ).rejects.toMatchObject({ code: "MISSING_API_KEY", httpStatus: 503 });
    expect(generateMock).not.toHaveBeenCalled();
  });

  it("응답에 이미지 데이터가 없으면 GENERATION_FAILED(502)를 던진다", async () => {
    generateMock.mockResolvedValue({ data: [] });

    await expect(
      generateThumbnails({ finalPrompt: "x", n: 2, size: THUMBNAIL_SIZE }),
    ).rejects.toMatchObject({ code: "GENERATION_FAILED", httpStatus: 502 });
  });

  it("모더레이션/정책 거부는 CONTENT_POLICY(422)로 정규화한다", async () => {
    const moderationErr = Object.assign(new Error("request was blocked"), {
      status: 400,
      code: "moderation_blocked",
    });
    generateMock.mockRejectedValue(moderationErr);

    const promise = generateThumbnails({
      finalPrompt: "x",
      n: 2,
      size: THUMBNAIL_SIZE,
    });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: "CONTENT_POLICY",
      httpStatus: 422,
    });
    // 원본 OpenAI 메시지를 노출하지 않는다.
    await expect(promise).rejects.not.toMatchObject({
      message: "request was blocked",
    });
  });

  it("그 외 에러(레이트리밋 등)는 GENERATION_FAILED(502)로 정규화한다", async () => {
    const rateLimitErr = Object.assign(new Error("rate limit exceeded"), {
      status: 429,
    });
    generateMock.mockRejectedValue(rateLimitErr);

    const promise = generateThumbnails({
      finalPrompt: "x",
      n: 2,
      size: THUMBNAIL_SIZE,
    });

    await expect(promise).rejects.toBeInstanceOf(AppError);
    await expect(promise).rejects.toMatchObject({
      code: "GENERATION_FAILED",
      httpStatus: 502,
    });
    await expect(promise).rejects.not.toMatchObject({
      message: "rate limit exceeded",
    });
  });
});
