import type { BuildPromptInput } from "@/types/thumbnail";

// 평범한 프롬프트를 유튜브 썸네일용으로 보강하고 문구를 주입하는 순수 함수.
// 부작용 없음 — process.env / 네트워크 / IO 접근 금지.

const PRESET_16X9 =
  "이것을 유튜브 썸네일로 만들어라: 16:9 가로 구도, 고대비 색상, " +
  "강한 시선 집중 주제를 중앙에 배치, 텍스트가 들어갈 여백 확보, " +
  "선명하고 클릭을 부르는 스타일.";

export function buildPrompt(input: BuildPromptInput): string {
  const { prompt, caption, preset16x9 = true } = input;

  const parts: string[] = [prompt];

  if (preset16x9) {
    parts.push(PRESET_16X9);
  }

  const trimmedCaption = caption?.trim();
  if (trimmedCaption) {
    parts.push(
      `다음 문구를 이미지 안에 정확히, 또렷하게 렌더링하라: "${trimmedCaption}"`,
    );
  }

  return parts.join("\n\n");
}
