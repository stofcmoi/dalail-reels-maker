"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import readersData from "@/data/readers.json";
import type { Reader, TimingsFile } from "@/lib/types";
import { safeId } from "@/lib/utils";

export default function AdminTimings() {
  const readers = readersData as Reader[];
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [readerId, setReaderId] = useState<string>(readers[0]?.id ?? "reader-1");
  const [part, setPart] = useState<number>(1);

  const reader = useMemo(() => readers.find((r) => r.id === readerId) ?? readers[0], [readers, readerId]);
  const [dalail, setDalail] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const [audioUrl, setAudioUrl] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number>(1);
  const selectedId = useMemo(() => safeId(part, selectedIndex), [part, selectedIndex]);

  const [timings, setTimings] = useState<Record<string, { startSec?: number; endSec?: number }>>({});

  const key = useMemo(() => `timings.${readerId}.part.${part}`, [readerId, part]);

  useEffect(() => {
    // Load part sentences
    fetch(`/api/dalail/part/${part}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((p) => setDalail(p))
      .catch((e) => setErr(e?.message ?? String(e)));
  }, [part]);

  useEffect(() => {
    // Load any saved timings
    const raw = localStorage.getItem(key);
    if (!raw) { setTimings({}); return; }
    try {
      const tf = JSON.parse(raw) as TimingsFile;
      const map: Record<string, { startSec?: number; endSec?: number }> = {};
      for (const it of tf.items ?? []) map[it.sentenceId] = { startSec: it.startSec, endSec: it.endSec };
      setTimings(map);
    } catch {
      setTimings({});
    }
  }, [key]);

  const sentences = dalail?.sentences ?? [];
  const maxIdx = Math.max(1, sentences.length);

  useEffect(() => {
    // Prefill audio URL from reader when possible
    const u = reader?.audioParts?.[String(part)] || "";
    setAudioUrl(u);
  }, [readerId, part]);

  const ensureAudio = () => {
    if (!audioRef.current) {
      const a = new Audio();
      a.crossOrigin = "anonymous";
      audioRef.current = a;
    }
    if (audioUrl && audioRef.current.src !== audioUrl) audioRef.current.src = audioUrl;
    return audioRef.current;
  };

  const setStart = () => {
    if (!audioUrl) return alert("ضع رابط mp3 أولاً.");
    const a = ensureAudio();
    const t = Number(a.currentTime.toFixed(3));
    setTimings((p) => ({ ...p, [selectedId]: { ...p[selectedId], startSec: t } }));
  };

  const setEnd = () => {
    if (!audioUrl) return alert("ضع رابط mp3 أولاً.");
    const a = ensureAudio();
    const t = Number(a.currentTime.toFixed(3));
    setTimings((p) => ({ ...p, [selectedId]: { ...p[selectedId], endSec: t } }));
  };

  const autoStartFromPrevEnd = () => {
    if (selectedIndex <= 1) return;
    const prevId = safeId(part, selectedIndex - 1);
    const prevEnd = timings[prevId]?.endSec;
    if (typeof prevEnd !== "number") return;
    setTimings((p) => ({ ...p, [selectedId]: { ...p[selectedId], startSec: prevEnd } }));
  };

  const saveLocal = () => {
    const items = Object.entries(timings)
      .filter(([, v]) => typeof v.startSec === "number" && typeof v.endSec === "number")
      .map(([sentenceId, v]) => ({ sentenceId, startSec: v.startSec!, endSec: v.endSec! }))
      .sort((a, b) => a.sentenceId.localeCompare(b.sentenceId));

    const payload: TimingsFile = {
      readerId,
      part,
      items,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem(key, JSON.stringify(payload));
    alert("تم الحفظ في المتصفح (localStorage).");
  };

  const downloadJson = () => {
    const items = Object.entries(timings)
      .filter(([, v]) => typeof v.startSec === "number" && typeof v.endSec === "number")
      .map(([sentenceId, v]) => ({ sentenceId, startSec: v.startSec!, endSec: v.endSec! }))
      .sort((a, b) => a.sentenceId.localeCompare(b.sentenceId));

    const payload: TimingsFile = {
      readerId,
      part,
      items,
      version: 1,
      createdAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timings_${readerId}_part-${part}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const validate = () => {
    const errs: string[] = [];
    for (let i = 1; i <= maxIdx; i++) {
      const id = safeId(part, i);
      const r = timings[id];
      if (!r) continue;
      if (typeof r.startSec !== "number" || typeof r.endSec !== "number") errs.push(`الجملة ${i}: البداية أو النهاية ناقصة`);
      else if (r.startSec >= r.endSec) errs.push(`الجملة ${i}: البداية يجب أن تكون أصغر من النهاية`);
      const prev = timings[safeId(part, i - 1)];
      if (prev?.endSec != null && r.startSec != null && r.startSec < prev.endSec) errs.push(`تداخل بين ${i-1} و ${i}`);
    }
    if (errs.length) alert(errs.join("\n"));
    else alert("✓ التوقيتات تبدو صحيحة (تحقق أساسي).");
  };

  // shortcuts
  useEffect(() => {
    if (!unlocked) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " "){ e.preventDefault(); const a = ensureAudio(); if (a.paused) void a.play(); else a.pause(); }
      if (e.key.toLowerCase() === "s") setStart();
      if (e.key.toLowerCase() === "e") setEnd();
      if (e.key.toLowerCase() === "j") setSelectedIndex((x) => Math.max(1, x - 1));
      if (e.key.toLowerCase() === "k") setSelectedIndex((x) => Math.min(maxIdx, x + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, audioUrl, selectedIndex, maxIdx, timings]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight">
            أداة إنشاء <span className="text-gold">توقيتات</span> دلائل الخيرات
          </h1>
          <p className="text-sm text-zinc-300">ارفع/ضع رابط mp3 للحزب، ثم حدّد بداية ونهاية كل جملة، ثم احفظ JSON.</p>
          <a className="text-xs underline decoration-white/20 hover:decoration-white/40 text-zinc-400" href="/">العودة لصانع الفيديو</a>
        </div>
      </header>

      <div className="my-5 h-px w-full bg-[rgba(245,211,125,0.16)]" />

      {!unlocked ? (
        <section className="max-w-md rounded-2xl bg-panel border border-[rgba(245,211,125,0.20)] p-5 space-y-3">
          <div className="text-sm font-semibold">دخول (MVP)</div>
          <div className="text-xs text-zinc-400">في النسخة الاحترافية: استعمل ENV ADMIN_PASSWORD. هنا أي كلمة مرور تفتح الصفحة.</div>
          <input
            type="password"
            className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة المرور"
          />
          <button
            className="w-full rounded-2xl bg-[rgba(245,211,125,0.20)] hover:bg-[rgba(245,211,125,0.26)] px-4 py-2 text-sm font-semibold text-zinc-900"
            onClick={() => (password.trim() ? setUnlocked(true) : alert("أدخل كلمة المرور"))}
          >
            دخول
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <section className="lg:col-span-4 space-y-5">
            <div className="rounded-2xl bg-panel border border-[rgba(245,211,125,0.20)] p-5 space-y-4">
              <div className="text-sm font-semibold">الإعدادات</div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">القارئ</label>
                <select className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" value={readerId} onChange={(e) => setReaderId(e.target.value)}>
                  {readers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">الحزب</label>
                <select className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" value={part} onChange={(e) => setPart(Number(e.target.value))}>
                  {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{`الحزب ${n}`}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-zinc-200">رابط mp3 للحزب</label>
                <input className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" value={audioUrl} onChange={(e) => setAudioUrl(e.target.value)} placeholder="https://.../part-1.mp3" />
                <div className="text-[11px] text-zinc-400">يمكنك لصق الرابط هنا أو حفظه في data/readers.json ليظهر تلقائياً.</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" onClick={() => { const a = ensureAudio(); void a.play(); }}>تشغيل</button>
                <button className="rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" onClick={() => { const a = ensureAudio(); a.pause(); }}>إيقاف</button>
                <button className="rounded-xl bg-[rgba(245,211,125,0.20)] hover:bg-[rgba(245,211,125,0.26)] px-3 py-2 text-sm font-semibold text-zinc-900" onClick={setStart}>Start (S)</button>
                <button className="rounded-xl bg-[rgba(245,211,125,0.20)] hover:bg-[rgba(245,211,125,0.26)] px-3 py-2 text-sm font-semibold text-zinc-900" onClick={setEnd}>End (E)</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" onClick={autoStartFromPrevEnd}>Start=PrevEnd</button>
                <button className="rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" onClick={() => setSelectedIndex((x) => Math.max(1, x - 1))}>السابق (J)</button>
                <button className="rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" onClick={() => setSelectedIndex((x) => Math.min(maxIdx, x + 1))}>التالي (K)</button>
                <button className="rounded-xl bg-ink border border-[rgba(245,211,125,0.22)] px-3 py-2 text-sm" onClick={validate}>تحقق</button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button className="rounded-xl bg-[rgba(245,211,125,0.20)] hover:bg-[rgba(245,211,125,0.26)] px-3 py-2 text-sm font-semibold text-zinc-900" onClick={saveLocal}>حفظ (local)</button>
                <button className="rounded-xl bg-[rgba(245,211,125,0.20)] hover:bg-[rgba(245,211,125,0.26)] px-3 py-2 text-sm font-semibold text-zinc-900" onClick={downloadJson}>تنزيل JSON</button>
              </div>

              <div className="text-[11px] text-zinc-400">اختصارات: Space تشغيل/إيقاف — S بداية — E نهاية — J السابق — K التالي</div>
            </div>
          </section>

          <section className="lg:col-span-8">
            <div className="rounded-2xl bg-panel border border-[rgba(245,211,125,0.20)] p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">الجمل</div>
                <div className="text-xs text-zinc-400">اختر جملة ثم اضبط البداية والنهاية</div>
              </div>

              {err ? <div className="text-sm text-amber-200">{err}</div> : null}

              <div className="rounded-xl bg-ink border border-[rgba(245,211,125,0.16)] p-3 text-sm text-zinc-300" style={{ fontFamily: "Amiri, serif" }}>
                <div className="text-xs text-zinc-400 mb-2">الجملة الحالية ({selectedIndex})</div>
                {sentences.find((s: any) => s.index === selectedIndex)?.text ?? "—"}
              </div>

              <div className="max-h-[520px] overflow-auto rounded-2xl border border-[rgba(245,211,125,0.16)]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-ink">
                    <tr className="text-right">
                      <th className="p-3 w-16">#</th>
                      <th className="p-3">النص</th>
                      <th className="p-3 w-28">Start</th>
                      <th className="p-3 w-28">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sentences.map((s: any) => {
                      const id = safeId(part, s.index);
                      const row = timings[id] || {};
                      const active = s.index === selectedIndex;
                      return (
                        <tr key={id} className={`border-t border-white/5 cursor-pointer ${active ? "bg-[rgba(245,211,125,0.08)]" : "bg-transparent"}`} onClick={() => setSelectedIndex(s.index)}>
                          <td className="p-3 text-zinc-300">{s.index}</td>
                          <td className="p-3">
                            <div className="line-clamp-2 text-zinc-200" style={{ fontFamily: "Amiri, serif" }}>{s.text}</div>
                          </td>
                          <td className="p-3">
                            <input
                              className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.18)] px-2 py-1"
                              value={typeof row.startSec === "number" ? row.startSec : ""}
                              onChange={(e) => setTimings((p) => ({ ...p, [id]: { ...p[id], startSec: e.target.value === "" ? undefined : Number(e.target.value) } }))}
                              placeholder="—"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              className="w-full rounded-xl bg-ink border border-[rgba(245,211,125,0.18)] px-2 py-1"
                              value={typeof row.endSec === "number" ? row.endSec : ""}
                              onChange={(e) => setTimings((p) => ({ ...p, [id]: { ...p[id], endSec: e.target.value === "" ? undefined : Number(e.target.value) } }))}
                              placeholder="—"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-zinc-400">
                الحفظ يتم داخل المتصفح (localStorage) ليستعمله صانع الفيديو تلقائياً. ويمكنك أيضاً تنزيل JSON للاحتفاظ به.
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
