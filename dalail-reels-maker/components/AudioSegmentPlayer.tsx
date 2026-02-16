"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "@/lib/utils";

export function AudioSegmentPlayer(props: {
  audioUrl: string | null;
  startSec: number | null;
  endSec: number | null;
}) {
  const { audioUrl, startSec, endSec } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const duration = useMemo(() => {
    if (startSec == null || endSec == null) return null;
    return Math.max(0, endSec - startSec);
  }, [startSec, endSec]);

  const stop = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    setIsPlaying(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  const tick = () => {
    const a = audioRef.current;
    if (!a || startSec == null || endSec == null) return;
    const dur = Math.max(0.001, endSec - startSec);
    const p = (a.currentTime - startSec) / dur;
    setProgress(Math.max(0, Math.min(1, p)) * 100);

    if (a.currentTime >= endSec - 0.05) {
      stop();
      a.currentTime = startSec;
      setProgress(0);
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const play = async () => {
    if (!audioUrl || startSec == null || endSec == null) return;
    let a = audioRef.current;
    if (!a) {
      a = new Audio();
      a.crossOrigin = "anonymous";
      audioRef.current = a;
    }
    if (a.src !== audioUrl) {
      stop();
      a.src = audioUrl;
      // attempt to prime
      try { await a.play(); } catch {}
      a.pause();
    }
    a.currentTime = startSec;
    try { await a.play(); } catch {}
    setIsPlaying(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    stop();
    setProgress(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, startSec, endSec]);

  return (
    <div className="rounded-xl bg-ink border border-[rgba(245,211,125,0.18)] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold">معاينة الصوت (قص تلقائي)</div>
          <div className="text-xs text-zinc-400">
            {startSec != null && endSec != null
              ? `${formatTime(startSec)} → ${formatTime(endSec)} (${(endSec - startSec).toFixed(1)}s)`
              : "التوقيتات غير متوفرة لهذا الاختيار"}
          </div>
        </div>
        <button
          className="rounded-2xl bg-[rgba(245,211,125,0.22)] px-4 py-2 text-xs font-semibold text-zinc-900 ring-1 ring-[rgba(245,211,125,0.28)] disabled:opacity-50"
          onClick={() => (isPlaying ? stop() : void play())}
          disabled={!audioUrl || startSec == null || endSec == null}
        >
          {isPlaying ? "إيقاف" : "تشغيل"}
        </button>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded bg-black/30">
        <div className="h-full bg-[rgba(245,211,125,0.65)]" style={{ width: `${progress}%` }} />
      </div>
      {!audioUrl ? (
        <div className="mt-2 text-xs text-amber-200/90">
          لا يوجد رابط mp3 لهذا الحزب في بيانات القارئ بعد. أضِفه في <code className="text-amber-100">data/readers.json</code>.
        </div>
      ) : null}
    </div>
  );
}
