export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function formatTime(sec: number) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function safeId(part: number, idx: number) {
  return `p${part}s${String(idx).padStart(3, "0")}`;
}
