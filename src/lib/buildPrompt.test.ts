import { describe, expect, it } from "vitest";
import { buildPrompt } from "@/lib/buildPrompt";

describe("buildPrompt", () => {
  it("사용자 prompt 텍스트를 항상 포함한다", () => {
    const result = buildPrompt({ prompt: "고양이 코딩 영상" });
    expect(result).toContain("고양이 코딩 영상");
  });

  it("비어있지 않은 문자열을 반환한다", () => {
    const result = buildPrompt({ prompt: "테스트" });
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("preset16x9 기본(미지정)일 때 썸네일 최적화 지시를 덧붙인다", () => {
    const result = buildPrompt({ prompt: "주제" });
    expect(result).toContain("16:9");
  });

  it("preset16x9 false면 썸네일 최적화 지시를 넣지 않는다", () => {
    const withPreset = buildPrompt({ prompt: "주제", preset16x9: true });
    const withoutPreset = buildPrompt({ prompt: "주제", preset16x9: false });
    expect(withoutPreset).not.toContain("16:9");
    expect(withPreset).toContain("16:9");
  });

  it("caption 제공 시 caption 텍스트를 포함한다", () => {
    const result = buildPrompt({ prompt: "주제", caption: "충격 실화" });
    expect(result).toContain("충격 실화");
  });

  it("caption 미제공 시 caption 관련 지시를 넣지 않는다", () => {
    const result = buildPrompt({ prompt: "주제" });
    expect(result).not.toContain("정확히");
  });

  it("caption이 공백뿐이면 caption 텍스트/지시를 넣지 않는다", () => {
    const result = buildPrompt({ prompt: "주제", caption: "   " });
    expect(result).not.toContain("정확히");
  });
});
