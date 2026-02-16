"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import readersData from "@/data/readers.json";
import type { DalailPart, Reader, TimingsFile } from "@/lib/types";
import { SWATCHES } from "@/lib/colors";
import { clamp, safeId } from "@/lib/utils";
import { SectionTitle } from "@/components/SectionTitle";
import { Preview916 } from "@/components/Preview916";
import { AudioSegmentPlayer } from "@/components/AudioSegmentPlayer";
import { ExportPanel } from "@/components/ExportPanel";

type TimingsMap = Record<string, { startSec: number; endSec: number }>;

async function fetchPart(part: number): Promise<DalailPart> {
  const res = await fetch(`/api/dalail/part/${part}`, { cache: "no-store" });
  if (!res.ok) throw new Error("فشل جلب نص الحزب من المصدر");
  return res.json();
}

export default function Home() {
  const readers = readersData as Reader[];
  const [part, setPart] = useState<number>(1);
  const [readerId, setReaderId] = useState<string>(readers[0]?.id ?? "reader-1");
  const reader = useMemo(() => readers.find((r) => r.id === readerId) ?? readers[0], [readers, readerId]);

  const [loading, setLoading] = useState(false);
  const [dalail, setDalail] = useState<DalailPart | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [fromIndex, setFromIndex] = useState(1);
  const [toIndex, setToIndex] = useState(3);

  // Background
  const [bgColor, setBgColor] = useState<string>(SWATCHES[1]);
  const [useImageBg, setUseImageBg] = useState(false);
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const [bgImageUrl, setBgImageUrl] = useState<string>("");

  // Text settings
  const [fontSize, setFontSize] = useState(46);
  const [textColor, setTextColor] = useState("#F5D37D");
  const [shadowOn, setShadowOn] = useState(true);
  const [shadowStrength, setShadowStrength] = useState(35);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [position, setPosition] = useState<"top" | "center" | "bottom">("center");
  const [showPartNumber, setShowPartNumber] = useState(true);
  const [showReaderName, setShowReaderName] = useState(true);

  // Translation (auto only)
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLang, setTranslationLang] = useState<"auto">("auto");

  // Timings (for now loaded from localStorage; later you can ship timings JSON files)
  const [timings, setTimings] = useState<TimingsMap | null>(null);

  // load part text
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchPart(part)
      .then((p) => {
        if (cancelled) return;
        setDalail(p);
        // default range based on available sentences
        setFromIndex(1);
        setToIndex(Math.min(3, p.sentences.length || 3));
      })
      .catch((e: any) => !cancelled && setErr(e?.message ?? String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [part]);

  // background image URL
  useEffect(() => {
    if (!bgImageFile) return;
    const url = URL.createObjectURL(bgImageFile);
    setBgImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [bgImageFile]);

  // load timings from localStorage (Admin tool downloads JSON; user can paste it here later)
  useEffect(() => {
    const key = `timings.${readerId}.part.${part}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setTimings(null);
      return;
    }
    try {
      const tf = JSON.parse(raw) as TimingsFile;
      const map: TimingsMap = {};
      for (const it of tf.items ?? []) map[it.sentenceId] = { startSec: it.startSec, endSec: it.endSec };
      setTimings(map);
    } catch {
      setTimings(null);
    }
  }, [readerId, part]);

  const sentences = dalail?.sentences ?? [];
  const maxIdx = Math.max(1, sentences.length);

  const range = useMemo(() => {
    const a = clamp(fromIndex, 1, maxIdx);
    const b = clamp(toIndex, 1, maxIdx);
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }, [fromIndex, toIndex, maxIdx]);

  const selected = useMemo(() => sentences.filter((s) => s.index >= range.from && s.index <= range.to), [sentences, range]);
  const text = useMemo(() => selected.map((s) => s.text).join("\n\n"), [selected]);

  const translation = useMemo(() => {
    if (!showTranslation) return null;
    // Automatic: use translation extracted from source per sentence (if present)
    // Here we join available translations; if missing, it will show fallback inside preview.
    const t = selected.map((s) => s.translation).filter(Boolean) as string[];
    return t.length ? t.join("\n\n") : null;
  }, [selected, showTranslation]);

  const startEnd = useMemo(() => {
    if (!timings || selected.length === 0) return null;
    const firstId = safeId(part, selected[0].index);
    const lastId = safeId(part, selected[selected.length - 1].index);
    const a = timings[firstId];
    const b = timings[lastId];
    if (!a || !b) return null;
    return { startSec: a.startSec, endSec: b.endSec, durationSec: Math.max(0, b.endSec - a.startSec) };
  }, [timings, selected, part]);

  const audioUrl = reader?.audioParts?.[String(part)] || null;
  const canExport = Boolean(audioUrl && startEnd);

  // For export: draw a single frame into a canvas (can be improved to animated frame rendering)
  const renderFrame = (ctx: CanvasRenderingContext2D) => {
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    // background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);
    // overlay gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0.35)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // headers
    ctx.font = "bold 40px Cairo";
    ctx.fillStyle = "rgba(245,211,125,0.95)";
    ctx.textAlign = "right";
    if (showPartNumber) ctx.fillText(`الحزب ${part}`, W - 60, 90);
    ctx.textAlign = "left";
    if (showReaderName) ctx.fillText(reader.name, 60, 90);

    // main text
    ctx.textAlign = "center";
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize * 1.6}px Amiri`;
    const lines = text.split(/\n\n|\n/).filter(Boolean);
    const lh = fontSize * 1.6 * lineHeight;
    let y = H / 2;
    if (position === "top") y = 300;
    if (position === "bottom") y = H - 500;
    const total = lines.length * lh;
    let startY = y - total / 2;

    if (shadowOn) {
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = shadowStrength;
      ctx.shadowOffsetY = Math.max(2, Math.round(shadowStrength / 12));
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }

    for (const line of lines) {
      ctx.fillText(line, W / 2, startY);
      startY += lh;
    }

    // translation
    if (showTranslation && translation) {
      ctx.shadowBlur = 6;
      ctx.shadowColor = "rgba(0,0,0,0.8)";
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.font = "28px Cairo";
      const tlines = translation.split(/\n\n|\n/).slice(0, 6);
      let ty = startY + 40;
      for (const tl of tlines) {
        ctx.fillText(tl, W / 2, ty);
        ty += 40;
      }
    }

    // reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            صانع ريلز <span className="text-gold">دلائل الخيرات</span>
          </h1>
          <p className="text-sm text-zinc-300">
            النص يُجلب تلقائيًا من المصدر، والصوت تُضيفه لاحقًا (روابط mp3) — ثم تُنشئ توقيتات من صفحة الإدارة.
          </p>
          {dalail?.sourceUrl ? (
            <p className="text-xs text-zinc-400">
              مصدر النص: <a className="underline decoration-white/20 hover:decoration-white/40" href={dalail.sourceUrl} target="_blank">{dalail.sourceUrl}</a>
            </p>
          ) : null}
        </div>

        <a
          href="/admin/timings"
          className="rounded-2xl bg-[rgba(245,211,125,0.14)] hover:bg-[rgba(245,211,125,0.18)] border border-[rgba(245,211,125,0.22)] px-4 py-2 text-sm text-zinc-100 w-fit"
        >
          أداة إنشاء التوقيتات (Admin)
        </a>
      </header>

      <div className="my-5 h-px w-full bg-[rgba(245,211,125,0.16)]" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Settings */}
        <section className="lg:col-span-5 space-y-5">
          <div className="rounded-2xl bg-panel border border-[rgba(245,211,125,0.20)] p-5 space-y-4">
            <SectionTitle title="اختيار المحتوى" hint="اختيار متتابع (Range)" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">القارئ</label>
                <select
                  className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm"
                  value={readerId}
                  onChange={(e) => setReaderId(e.target.value)}
                >
                  {readers.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <div className="text-[11px] text-zinc-400">
                  ستضيف روابط mp3 لاحقًا في <code>data/readers.json</code>.
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">الحزب</label>
                <select
                  className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm"
                  value={part}
                  onChange={(e) => setPart(Number(e.target.value))}
                >
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{`الحزب ${n}`}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">من الجملة</label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm"
                  min={1}
                  max={maxIdx}
                  value={fromIndex}
                  onChange={(e) => setFromIndex(Number(e.target.value))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">إلى الجملة</label>
                <input
                  type="number"
                  className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm"
                  min={1}
                  max={maxIdx}
                  value={toIndex}
                  onChange={(e) => setToIndex(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="rounded-xl bg-ink border border-[rgba(245,211,125,0.18)] p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">النص المختار</div>
                <div className="text-xs text-zinc-400">{range.from} → {range.to}</div>
              </div>
              <div className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-sm leading-7" style={{ fontFamily: "Amiri, serif" }}>
                {loading ? "جاري تحميل النص…" : err ? `خطأ: ${err}` : text || "—"}
              </div>
            </div>

            <AudioSegmentPlayer
              audioUrl={audioUrl}
              startSec={startEnd?.startSec ?? null}
              endSec={startEnd?.endSec ?? null}
            />

            {!startEnd ? (
              <div className="text-xs text-amber-200/90">
                لا توجد توقيتات لهذا القارئ/الحزب أو للنطاق المختار بعد. أنشئها من صفحة الإدارة ثم احفظها.
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl bg-panel border border-[rgba(245,211,125,0.20)] p-5 space-y-4">
            <SectionTitle title="الخلفية وإعدادات النص" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-zinc-200">خلفية صورة</label>
                <div className="flex items-center justify-between rounded-xl bg-ink border border-[rgba(245,211,125,0.18)] px-3 py-2">
                  <span className="text-xs text-zinc-300">تفعيل</span>
                  <input type="checkbox" checked={useImageBg} onChange={(e) => setUseImageBg(e.target.checked)} />
                </div>
                <input
                  type="file"
                  accept="image/*"
                  disabled={!useImageBg}
                  className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm disabled:opacity-50"
                  onChange={(e) => setBgImageFile(e.target.files?.[0] ?? null)}
                />
                <div className="text-[11px] text-zinc-400">رفع صورة من جهازك (Mobile/PC).</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">خلفية لون</label>
                <div className="grid grid-cols-6 gap-2">
                  {SWATCHES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setBgColor(c)}
                      className={`h-8 rounded-lg ring-1 ${bgColor === c ? "ring-[rgba(245,211,125,0.9)]" : "ring-white/10"}`}
                      style={{ backgroundColor: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">حجم الخط</label>
                <input type="range" min={26} max={70} step={1} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full" />
                <div className="text-xs text-zinc-400">{fontSize}px</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">لون النص</label>
                <input
                  className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">ظل النص</label>
                <div className="flex items-center justify-between rounded-xl bg-ink border border-[rgba(245,211,125,0.18)] px-3 py-2">
                  <span className="text-xs text-zinc-300">تفعيل</span>
                  <input type="checkbox" checked={shadowOn} onChange={(e) => setShadowOn(e.target.checked)} />
                </div>
                <input
                  type="range"
                  min={0}
                  max={70}
                  step={1}
                  value={shadowStrength}
                  disabled={!shadowOn}
                  onChange={(e) => setShadowStrength(Number(e.target.value))}
                  className="w-full disabled:opacity-50"
                />
                <div className="text-xs text-zinc-400">{shadowStrength}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">تباعد الأسطر</label>
                <input type="range" min={1.1} max={2.1} step={0.05} value={lineHeight} onChange={(e) => setLineHeight(Number(e.target.value))} className="w-full" />
                <div className="text-xs text-zinc-400">{lineHeight.toFixed(2)}</div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">موضع النص</label>
                <select
                  className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm"
                  value={position}
                  onChange={(e) => setPosition(e.target.value as any)}
                >
                  <option value="top">أعلى</option>
                  <option value="center">وسط</option>
                  <option value="bottom">أسفل</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">إظهار داخل الفيديو</label>
                <div className="rounded-xl bg-ink border border-[rgba(245,211,125,0.18)] p-3 space-y-2">
                  <label className="flex items-center justify-between text-sm">
                    <span>رقم الحزب</span>
                    <input type="checkbox" checked={showPartNumber} onChange={(e) => setShowPartNumber(e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    <span>اسم القارئ</span>
                    <input type="checkbox" checked={showReaderName} onChange={(e) => setShowReaderName(e.target.checked)} />
                  </label>
                  <label className="flex items-center justify-between text-sm">
                    <span>ترجمة تلقائية (من المصدر إن وُجدت)</span>
                    <input type="checkbox" checked={showTranslation} onChange={(e) => setShowTranslation(e.target.checked)} />
                  </label>
                </div>
                <div className="text-[11px] text-zinc-400">
                  الترجمة هنا تُستخرج تلقائياً من نفس صفحة المصدر إن كانت موجودة لكل مقطع. لا يُطلب من المستخدم كتابتها.
                </div>
              </div>
            </div>
          </div>

          <ExportPanel
            canExport={canExport}
            audioUrl={audioUrl}
            startSec={startEnd?.startSec ?? null}
            endSec={startEnd?.endSec ?? null}
            durationSec={startEnd?.durationSec ?? null}
            renderFrame={(ctx) => renderFrame(ctx)}
          />
        </section>

        {/* Preview */}
        <section className="lg:col-span-7">
          <div className="rounded-2xl bg-panel border border-[rgba(245,211,125,0.20)] p-5">
            <SectionTitle title="المعاينة الحيّة (9:16)" hint="Desktop + Mobile" />
            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Preview916
                part={part}
                reader={reader}
                text={text}
                translation={translation}
                showTranslation={showTranslation}
                showPartNumber={showPartNumber}
                showReaderName={showReaderName}
                position={position}
                fontSize={fontSize}
                lineHeight={lineHeight}
                textColor={textColor}
                shadowOn={shadowOn}
                shadowStrength={shadowStrength}
                bgColor={bgColor}
                useImageBg={useImageBg}
                bgImageUrl={bgImageUrl}
                durationSec={startEnd?.durationSec ?? null}
              />

              <div className="space-y-3">
                <div className="rounded-xl bg-ink border border-[rgba(245,211,125,0.14)] p-4 space-y-2">
                  <div className="text-sm font-semibold">حالة العناصر</div>
                  <div className="flex items-center justify-between text-sm text-zinc-300">
                    <span>نص الحزب</span>
                    <span className={dalail?.sentences?.length ? "text-emerald-300" : "text-amber-200"}>
                      {dalail?.sentences?.length ? "جاهز" : "غير متوفر"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-300">
                    <span>روابط الصوت</span>
                    <span className={audioUrl ? "text-emerald-300" : "text-amber-200"}>{audioUrl ? "جاهز" : "غير محدد"}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-zinc-300">
                    <span>التوقيتات</span>
                    <span className={startEnd ? "text-emerald-300" : "text-amber-200"}>{startEnd ? "جاهز" : "ناقص"}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-ink border border-[rgba(245,211,125,0.14)] p-4 space-y-2">
                  <div className="text-sm font-semibold">أين تضع ملفات الصوت لاحقاً؟</div>
                  <ol className="list-decimal pr-5 text-sm text-zinc-300 space-y-1">
                    <li>ارفع mp3 إلى CDN (مثل Cloudflare R2 / Bunny / أو حتى Google Drive direct links مع CORS).</li>
                    <li>ضع الروابط في <code>data/readers.json</code> داخل <code>audioParts</code> للحزب 1..8.</li>
                    <li>ادخل إلى صفحة Admin وأنشئ التوقيتات ثم احفظها (سيتم استخدامها تلقائياً).</li>
                  </ol>
                  <div className="text-[11px] text-zinc-400">
                    مهم للتصدير: روابط mp3 يجب أن تسمح بالتحميل عبر المتصفح (CORS).
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
