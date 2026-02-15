// Vercel Serverless Function: /api/part?part=1
// يجلب HTML من dalailalkhayrat.com ثم يستخرج الجمل العربية وترجمة EN/FR
export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const part = Math.max(1, Math.min(8, parseInt(url.searchParams.get("part") || "1", 10)));

    const remote = `https://www.dalailalkhayrat.com/parts.php?part=${part}`;
    const r = await fetch(remote, {
      headers: {
        "user-agent": "dalail-reels-maker/1.0",
        "accept": "text/html,*/*"
      }
    });

    if (!r.ok) {
      res.statusCode = 502;
      res.setHeader("content-type", "application/json; charset=utf-8");
      res.end(JSON.stringify({ error: "failed_fetch" }));
      return;
    }

    const html = await r.text();

    // 1) Strip scripts/styles
    let s = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<\/(p|div|br|li|h\d)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ");

    // 2) Decode entities minimal
    s = s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // 3) Normalize lines
    const lines = s
      .split("\n")
      .map(x => x.replace(/\s+/g, " ").trim())
      .filter(Boolean);

    // Find title line like: "Part 1 - الحزب الأول"
    const titleAr = lines.find(x => /الحزب\s/.test(x)) || `الحزب ${part}`;

    // The content pattern in text view:
    // [idx ▶︎] then Arabic line then transliteration then translations (including English/French)
    const items = [];
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^(\d+)\s*▶︎?$/);
      if (!m) continue;

      const idx = parseInt(m[1], 10);
      // Arabic is next non-empty line
      const ar = nextNonEmpty(lines, i + 1);
      if (!ar || !hasArabic(ar)) continue;

      // Collect until next idx marker
      const block = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (/^\d+\s*▶︎?$/.test(lines[j])) break;
        block.push(lines[j]);
      }

      // Heuristic: In block, English often appears as a sentence with ASCII letters,
      // French appears often with apostrophes/accents and starts with "Au" / "Et" / "Ô" etc.
      // We'll pick the first reasonable EN line and first FR line.
      const en = pickEnglish(block);
      const fr = pickFrench(block);

      items.push({ idx, ar, tr: { en, fr } });
    }

    res.statusCode = 200;
    res.setHeader("content-type", "application/json; charset=utf-8");
    // cache a bit
    res.setHeader("cache-control", "s-maxage=3600, stale-while-revalidate=86400");
    res.end(JSON.stringify({ part, titleAr, items }));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "server_error" }));
  }
}

function nextNonEmpty(lines, start) {
  for (let k = start; k < lines.length; k++) {
    if (lines[k]) return lines[k];
  }
  return "";
}

function hasArabic(s) {
  return /[\u0600-\u06FF]/.test(s);
}

function pickEnglish(block) {
  // Prefer lines with only Latin letters and common English words, avoid transliteration patterns with lots of diacritics.
  const candidates = block.filter(x =>
    /[A-Za-z]/.test(x) &&
    !/ā|ī|ū|ḥ|ʿ|ṣ|ḍ|ṭ|ẓ|ʾ|ʿ/.test(x) &&
    x.length > 10
  );
  // From the page, English lines often start with "In the Name" or "O Allah" or "Allah’s"
  const preferred = candidates.find(x => /In the Name|O Allah|Allah/i.test(x));
  return preferred || candidates[0] || "";
}

function pickFrench(block) {
  const candidates = block.filter(x =>
    (/[A-Za-zÀ-ÿ]/.test(x)) &&
    (/[\u00C0-\u017F]/.test(x) || /\b(Allah|prie|Et|Au nom|Ô)\b/i.test(x)) &&
    x.length > 10
  );
  const preferred = candidates.find(x => /\bAu nom\b|\bEt\b|\bÔ\b|\bprie\b/i.test(x));
  return preferred || candidates[0] || "";
}
