"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACCEPTED_IMAGE_TYPES,
  ALLOWED_N,
  DEFAULT_N,
  type ErrorCode,
  MAX_IMAGE_BYTES,
} from "@/types/thumbnail";

const REQUEST_TIMEOUT_MS = 70_000; // 서버 maxDuration(60s) + 여유

type Status = "idle" | "loading" | "success" | "error";
type AppErrorBody = { code: ErrorCode; message: string };

export default function ThumbnailGenerator() {
  const [prompt, setPrompt] = useState("");
  const [caption, setCaption] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [n, setN] = useState<number>(DEFAULT_N);
  const [status, setStatus] = useState<Status>("idle");
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<AppErrorBody | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 선택 이미지 미리보기용 object URL 생성/해제.
  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const isLoading = status === "loading";
  const canSubmit = prompt.trim() !== "" && !isLoading;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (
      !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type) ||
      file.size > MAX_IMAGE_BYTES
    ) {
      setInlineError("PNG·JPG·WebP, 10MB 이하만 가능해요");
      e.target.value = ""; // 선택 취소
      return;
    }
    setInlineError(null);
    setImageFile(file);
  }

  function clearImage() {
    setImageFile(null);
    setInlineError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function runGenerate() {
    setStatus("loading");
    setError(null);

    const form = new FormData();
    form.append("prompt", prompt);
    form.append("caption", caption);
    form.append("n", String(n));
    if (imageFile) form.append("image", imageFile);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });

      if (res.ok) {
        const data = (await res.json()) as { images: string[] };
        setImages(data.images);
        setStatus("success");
      } else {
        const data = (await res.json()) as { error: AppErrorBody };
        setError(data.error);
        setStatus("error");
      }
    } catch {
      // abort/네트워크 예외는 재시도 가능한 GENERATION_FAILED로 귀결.
      setError({
        code: "GENERATION_FAILED",
        message: "이미지 생성에 실패했어요. 잠시 후 다시 시도해주세요",
      });
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    runGenerate();
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-100">
          🎬 유튜브 썸네일 생성기
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          프롬프트만 입력하면 클릭을 부르는 16:9 썸네일 후보를 만들어드려요.
        </p>
      </header>

      {status === "error" && error && (
        <div className="mb-6 rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <p>{error.message}</p>
          {error.code === "GENERATION_FAILED" && (
            <button
              type="button"
              onClick={runGenerate}
              className="mt-2 rounded-md border border-red-800 px-3 py-1 text-xs font-medium text-red-100 transition-colors hover:bg-red-900/40"
            >
              재시도
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <fieldset disabled={isLoading} className="space-y-5">
          <div>
            <label
              htmlFor="prompt"
              className="mb-1.5 block text-sm font-medium text-neutral-200"
            >
              프롬프트 <span className="text-red-500">*</span>
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="예: 빨간 배경 앞에서 놀란 표정을 짓는 게이머, 굵은 글씨 강조"
              className="w-full resize-none rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="caption"
              className="mb-1.5 block text-sm font-medium text-neutral-200"
            >
              썸네일 문구{" "}
              <span className="text-neutral-500">(선택)</span>
            </label>
            <input
              id="caption"
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="예: 충격 결말"
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-600 focus:outline-none"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-neutral-200">
              참고 이미지{" "}
              <span className="text-neutral-500">(선택)</span>
            </span>
            {previewUrl ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="참고 이미지 미리보기"
                  className="h-28 w-auto rounded-lg border border-neutral-800 object-cover"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="이미지 제거"
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-700 bg-neutral-900 text-neutral-300 transition-colors hover:bg-neutral-800"
                >
                  ×
                </button>
              </div>
            ) : (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="block w-full text-sm text-neutral-400 file:mr-3 file:rounded-md file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-200 hover:file:bg-neutral-700"
              />
            )}
            {inlineError && (
              <p className="mt-1.5 text-xs text-red-400">{inlineError}</p>
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-neutral-200">
              후보 수
            </span>
            <div className="inline-flex overflow-hidden rounded-lg border border-neutral-800">
              {ALLOWED_N.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setN(value)}
                  aria-pressed={n === value}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    n === value
                      ? "bg-red-600 text-white"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                생성 중…
              </>
            ) : (
              "썸네일 생성"
            )}
          </button>
        </fieldset>
      </form>

      {isLoading && (
        <p className="mt-4 text-center text-sm text-neutral-400">
          생성 중… (최대 1분 소요)
        </p>
      )}

      {status === "success" && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-100">
              결과 ({images.length}장)
            </h2>
            <button
              type="button"
              onClick={runGenerate}
              className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
            >
              다시 생성
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {images.map((src, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`썸네일 후보 ${i + 1}`}
                  className="aspect-video w-full object-cover"
                />
                <a
                  href={src}
                  download={`thumbnail-${i + 1}.png`}
                  className="block border-t border-neutral-800 px-3 py-2 text-center text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-800"
                >
                  다운로드
                </a>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
