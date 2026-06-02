// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ThumbnailGenerator from "./ThumbnailGenerator";

describe("ThumbnailGenerator", () => {
  it("프롬프트 입력 필드와 '썸네일 생성' 버튼을 렌더한다", () => {
    render(<ThumbnailGenerator />);

    expect(
      screen.getByPlaceholderText(/예: 빨간 배경/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /썸네일 생성/ }),
    ).toBeInTheDocument();
  });

  it("프롬프트가 비어있으면 생성 버튼이 비활성이다", () => {
    render(<ThumbnailGenerator />);

    expect(
      screen.getByRole("button", { name: /썸네일 생성/ }),
    ).toBeDisabled();
  });
});
