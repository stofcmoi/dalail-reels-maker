import { useMemo } from "react";
import type { Reader } from "@/lib/types";

export function Preview916(props: {
  part: number;
  reader: Reader;
  text: string;
  translation?: string | null;
  showTranslation: boolean;
  showPartNumber: boolean;
  showReaderName: boolean;
  position: "top" | "center" | "bottom";
  fontSize: number;
  lineHeight: number;
  textColor: string;
  shadowOn: boolean;
  shadowStrength: number;
  bgColor: string;
  useImageBg: boolean;
  bgImageUrl: string;
  durationSec?: number | null;
}) {
  const {
    part, reader, text, translation, showTranslation, showPartNumber, showReaderName,
    position, fontSize, lineHeight, textColor, shadowOn, shadowStrength,
    bgColor, useImageBg, bgImageUrl, durationSec
  } = props;

  const posClass = useMemo(() => {
    if (position === "top") return "top-16";
    if (position === "bottom") return "bottom-16";
    return "top-1/2 -translate-y-1/2";
  }, [position]);

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-2xl border border-[rgba(245,211,125,0.22)] bg-black shadow-[0_0_40px_rgba(245,211,125,0.12)]">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: bgColor,
            backgroundImage: useImageBg && bgImageUrl ? `url(${bgImageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45" />

        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          {showPartNumber ? (
            <div className="rounded-xl bg-black/45 px-3 py-1 text-xs ring-1 ring-white/10 text-gold">
              الحزب {part}
            </div>
          ) : <div />}
          {showReaderName ? (
            <div className="rounded-xl bg-black/45 px-3 py-1 text-xs ring-1 ring-white/10 text-gold">
              {reader.name}
            </div>
          ) : <div />}
        </div>

        <div className={`absolute left-6 right-6 ${posClass}`}>
          <div
            className="whitespace-pre-wrap text-center"
            style={{
              fontFamily: "Amiri, serif",
              fontSize,
              lineHeight,
              color: textColor,
              textShadow: shadowOn
                ? `0 0 ${shadowStrength}px rgba(0,0,0,0.85), 0 2px ${Math.max(
                    2,
                    Math.round(shadowStrength / 12)
                  )}px rgba(0,0,0,0.85)`
                : "none",
            }}
          >
            {text || "—"}
          </div>

          {showTranslation ? (
            <div className="mt-6 text-center text-sm text-white/80" style={{ textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}>
              {translation || "الترجمة غير متوفرة تلقائيًا لهذا المقطع في المصدر الحالي."}
            </div>
          ) : null}
        </div>

        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          <div className="rounded-xl bg-black/45 px-3 py-1 text-[11px] ring-1 ring-white/10 text-zinc-200">
            {typeof durationSec === "number" ? `${durationSec.toFixed(1)}s` : "—"}
          </div>
          <div className="rounded-2xl bg-[rgba(245,211,125,0.22)] px-4 py-2 text-xs font-semibold text-zinc-900 ring-1 ring-[rgba(245,211,125,0.28)]">
            معاينة
          </div>
        </div>
      </div>
    </div>
  );
}
