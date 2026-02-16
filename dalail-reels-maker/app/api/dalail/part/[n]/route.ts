import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { safeId } from "@/lib/utils";
import type { DalailPart, DalailSentence } from "@/lib/types";

// Source page used (requested by user).
const SOURCE_BASE = "https://www.dalailalkhayrat.com/parts.php?part=";

// Heuristic: lines that are mostly Arabic letters/diacritics/spaces/punct.
function isMostlyArabic(s: string) {
  const t = s.trim();
  if (!t) return false;
  // Arabic block + Arabic diacritics
  const ar = t.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g)?.length ?? 0;
  const letters = t.match(/[A-Za-z\u0600-\u06FF]/g)?.length ?? 0;
  return letters > 0 && ar / letters > 0.7;
}

function isLikelyFrench(s: string) {
  const t = s.trim();
  return /^Ô\s|^O\sAllah\b|\bprie\b|\bServiteur\b/i.test(t);
}
function isLikelyEnglish(s: string) {
  const t = s.trim();
  return /^O\sAllah\b|\bbless\b|\bMessenger\b/i.test(t);
}

export async function GET(_: Request, { params }: { params: { n: string } }) {
  const n = Number(params.n);
  if (!Number.isFinite(n) || n < 1 || n > 8) {
    return NextResponse.json({ error: "Invalid part number" }, { status: 400 });
  }

  const sourceUrl = `${SOURCE_BASE}${n}`;
  const res = await fetch(sourceUrl, {
    headers: {
      // Some hosts require a UA; keep it simple.
      "User-Agent": "Mozilla/5.0 (compatible; DalailReelsMaker/1.0)",
      "Accept": "text/html",
    },
    // Ensure we can fetch on Vercel/Node runtime.
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch source", status: res.status }, { status: 502 });
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Pull visible text lines in reading order.
  const rawText = $("body").text();
  const lines = rawText
    .split(/\r?\n/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // The page includes many languages; we build blocks keyed by item numbers.
  // We'll detect item separators as: "<number> ▶︎" or a standalone number.
  const blocks: { num: number; lines: string[] }[] = [];
  let current: { num: number; lines: string[] } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    const m = L.match(/^(\d+)\s*▶︎$/) || L.match(/^(\d+)\s*▶/);
    if (m) {
      const num = Number(m[1]);
      if (current) blocks.push(current);
      current = { num, lines: [] };
      continue;
    }
    if (!current) continue;
    current.lines.push(L);
  }
  if (current) blocks.push(current);

  // For each block, pick Arabic text (first mostly-arabic long line).
  // Also optionally pick translation (French or English) if present.
  const sentences: DalailSentence[] = [];
  let idx = 1;

  for (const b of blocks) {
    // pick Arabic candidates
    const arabicCandidates = b.lines.filter(isMostlyArabic);
    // Most blocks have Arabic as 1st candidate; some may include multiple Arabic lines.
    // We'll take the longest Arabic candidate as the primary text.
    const text = arabicCandidates.sort((a, c) => c.length - a.length)[0];
    if (!text) continue;

    // translation: choose French first if exists, else English. (Automatic; user doesn't type anything.)
    const fr = b.lines.find(isLikelyFrench) ?? null;
    const en = b.lines.find(isLikelyEnglish) ?? null;
    const translation = fr ?? en;

    sentences.push({ id: safeId(n, idx), index: idx, text, translation });
    idx++;
  }

  const payload: DalailPart = {
    part: n,
    title: `الحزب ${n}`,
    sentences,
    sourceUrl,
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
