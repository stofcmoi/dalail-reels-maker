export function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
      {hint ? <span className="text-xs text-zinc-400">{hint}</span> : null}
    </div>
  );
}
