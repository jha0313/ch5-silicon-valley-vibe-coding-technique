// 라우트·컴포넌트 공유 계약(요청/응답/에러코드) 및 클라이언트·서버 공유 상수.

export type ErrorCode =
  | "INVALID_INPUT"
  | "MISSING_API_KEY"
  | "CONTENT_POLICY"
  | "GENERATION_FAILED";

// 응답 계약
export type GenerateSuccess = { images: string[] }; // base64 data URL 배열
export type GenerateErrorBody = { error: { code: ErrorCode; message: string } };
export type GenerateResponse = GenerateSuccess | GenerateErrorBody;

// buildPrompt 입력
export type BuildPromptInput = {
  prompt: string;
  caption?: string;
  preset16x9?: boolean;
};

// 공유 상수
export const THUMBNAIL_SIZE = "1280x720"; // 정확한 16:9, gpt-image-2 제약 충족
export const ALLOWED_N = [2, 3, 4] as const;
export const DEFAULT_N = 2;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
