import { buildPrompt } from "@/lib/buildPrompt";
import { AppError, generateThumbnails } from "@/services/openai";
import {
  ACCEPTED_IMAGE_TYPES,
  ALLOWED_N,
  DEFAULT_N,
  MAX_IMAGE_BYTES,
  THUMBNAIL_SIZE,
} from "@/types/thumbnail";

export const runtime = "nodejs"; // openai SDK/Buffer 사용
export const maxDuration = 60; // 이미지 생성 지연 대비

function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();

  const promptRaw = form.get("prompt");
  const prompt = typeof promptRaw === "string" ? promptRaw : "";

  const captionRaw = form.get("caption");
  const caption = typeof captionRaw === "string" ? captionRaw : undefined;

  const nRaw = form.get("n");
  const nParsed = typeof nRaw === "string" ? Number.parseInt(nRaw, 10) : NaN;
  const n = (ALLOWED_N as readonly number[]).includes(nParsed)
    ? nParsed
    : DEFAULT_N;

  const imageField = form.get("image");
  const image =
    imageField instanceof File && imageField.size > 0 ? imageField : undefined;

  // 검증(라우트 인라인)
  if (prompt.trim() === "") {
    return errorResponse("INVALID_INPUT", "프롬프트를 입력해주세요", 400);
  }
  if (
    image &&
    (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(image.type) ||
      image.size > MAX_IMAGE_BYTES)
  ) {
    return errorResponse(
      "INVALID_INPUT",
      "PNG·JPG·WebP, 10MB 이하만 가능해요",
      400,
    );
  }

  try {
    const finalPrompt = buildPrompt({ prompt, caption, preset16x9: true });
    const images = await generateThumbnails({
      finalPrompt,
      image: image ?? undefined,
      n,
      size: THUMBNAIL_SIZE,
    });
    return Response.json({ images }, { status: 200 });
  } catch (err) {
    // 원본 에러/스택은 응답 본문에 노출하지 않는다(CLAUDE.md CRITICAL).
    if (err instanceof AppError) {
      return errorResponse(err.code, err.message, err.httpStatus);
    }
    return errorResponse(
      "GENERATION_FAILED",
      "이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요",
      502,
    );
  }
}
