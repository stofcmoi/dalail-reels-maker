"use client";

import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { toBlobURL } from "@ffmpeg/util";

/**
 * Professional export path (client-side):
 * 1) Render frames from a canvas at 30fps
 * 2) Use ffmpeg.wasm to:
 *    - build video from frames
 *    - trim audio between start/end
 *    - mux audio + video into mp4
 *
 * Notes:
 * - This is heavy on mobile. Consider adding server-side rendering later.
 * - CORS: audioUrl must allow cross-origin fetch for ffmpeg to read it.
 */

export async function exportMp4(opts: {
  canvas: HTMLCanvasElement;
  fps: number;
  durationSec: number;
  audioUrl: string;
  startSec: number;
  endSec: number;
  onProgress?: (p: number) => void;
}) {
  const { canvas, fps, durationSec, audioUrl, startSec, endSec, onProgress } = opts;

  const ffmpeg = createFFmpeg({ log: false });

  // Load core from unpkg via blob URLs (works on Vercel).
  if (!ffmpeg.isLoaded()) {
    const coreBase = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    ffmpeg.setProgress(({ ratio }) => onProgress?.(Math.round(ratio * 100)));
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm"),
    });
  }

  const totalFrames = Math.max(1, Math.round(durationSec * fps));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas context");

  // Render & write frames
  for (let i = 0; i < totalFrames; i++) {
    // Assume caller already draws the current frame into canvas.
    // We just read pixels as PNG and write it.
    const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const name = `frame_${String(i).padStart(5, "0")}.png`;
    ffmpeg.FS("writeFile", name, bytes);
    onProgress?.(Math.round((i / totalFrames) * 40)); // 0..40
  }

  // Fetch audio
  const audioData = await fetchFile(audioUrl);
  ffmpeg.FS("writeFile", "full.mp3", audioData);

  // Build silent video from frames
  await ffmpeg.run(
    "-framerate", String(fps),
    "-i", "frame_%05d.png",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-r", String(fps),
    "video.mp4"
  );
  onProgress?.(60);

  // Trim audio
  const segDur = Math.max(0.01, endSec - startSec);
  await ffmpeg.run(
    "-ss", String(startSec),
    "-t", String(segDur),
    "-i", "full.mp3",
    "-c:a", "aac",
    "-b:a", "192k",
    "audio.m4a"
  );
  onProgress?.(80);

  // Mux
  await ffmpeg.run(
    "-i", "video.mp4",
    "-i", "audio.m4a",
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    "out.mp4"
  );
  onProgress?.(95);

  const out = ffmpeg.FS("readFile", "out.mp4");
  const outBlob = new Blob([out.buffer], { type: "video/mp4" });

  // cleanup (best-effort)
  try {
    for (let i = 0; i < totalFrames; i++) ffmpeg.FS("unlink", `frame_${String(i).padStart(5, "0")}.png`);
    ffmpeg.FS("unlink", "full.mp3");
    ffmpeg.FS("unlink", "video.mp4");
    ffmpeg.FS("unlink", "audio.m4a");
    ffmpeg.FS("unlink", "out.mp4");
  } catch {}

  onProgress?.(100);
  return outBlob;
}
