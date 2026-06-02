import OpenAI from "openai";
import type { ErrorCode } from "@/types/thumbnail";

// gpt-image-2 얇은 래퍼 + 에러 정규화.
// 클라이언트가 아닌 서버(라우트 핸들러)에서만 호출된다.

export class AppError extends Error {
  code: ErrorCode;
  httpStatus: number;

  constructor(code: ErrorCode, message: string, httpStatus: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export type GenerateThumbnailsInput = {
  finalPrompt: string;
  image?: File; // 참고 이미지(있으면 edit, 없으면 generate)
  n: number;
  size: string; // THUMBNAIL_SIZE
};

// 콘텐츠 정책/모더레이션 거부 식별. 원본 메시지는 노출하지 않고 분기 판단에만 사용.
function isContentPolicyError(err: unknown): boolean {
  const keywords = ["moderation", "safety", "content_policy", "content policy"];
  const e = err as Record<string, unknown> | null;
  if (!e) return false;
  const fields = [e.code, e.type, e.param, e.message]
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.toLowerCase());
  return fields.some((f) => keywords.some((k) => f.includes(k)));
}

export async function generateThumbnails(
  input: GenerateThumbnailsInput,
): Promise<string[]> {
  // 키는 호출 시점에 읽는다(최상위 인스턴스화 금지 — 키 없이 import만 해도 깨지는 것 방지).
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "MISSING_API_KEY",
      "서버에 API 키가 설정되지 않았습니다(관리자 설정 필요)",
      503,
    );
  }

  const client = new OpenAI({ apiKey });
  const { finalPrompt, image, n, size } = input;

  try {
    const response = image
      ? await client.images.edit({
          model: "gpt-image-2",
          image,
          prompt: finalPrompt,
          n,
          size,
        })
      : await client.images.generate({
          model: "gpt-image-2",
          prompt: finalPrompt,
          n,
          size,
        });

    const images =
      response.data
        ?.map((item) => item.b64_json)
        .filter((b64): b64 is string => typeof b64 === "string")
        .map((b64) => `data:image/png;base64,${b64}`) ?? [];

    if (images.length === 0) {
      throw new AppError(
        "GENERATION_FAILED",
        "이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요",
        502,
      );
    }

    return images;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (isContentPolicyError(err)) {
      throw new AppError(
        "CONTENT_POLICY",
        "콘텐츠 정책에 의해 거부됐어요. 프롬프트를 수정해 다시 시도해주세요",
        422,
      );
    }
    // 429/타임아웃/네트워크/5xx/미상 전부 — 원본 에러는 노출하지 않는다.
    throw new AppError(
      "GENERATION_FAILED",
      "이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요",
      502,
    );
  }
}
