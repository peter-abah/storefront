/**
 * Phase 3 editorial system — motif + folio.
 * Single source for ornaments so Hero, rails, grids and rituals rhyme.
 * No gradients, no glow, no gradient text. Ink / bronze on paper only.
 */

export function MotifMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* Four-point editorial star — hairline bronze */}
      <path
        d="M12 1v22M1 12h22M4.2 4.2l15.6 15.6M19.8 4.2L4.2 19.8"
        stroke="currentColor"
        strokeWidth="1"
      />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
    </svg>
  );
}

export function Folio({
  index,
  label,
  align = "left",
  className = "",
}: {
  index?: string;
  label: string;
  align?: "left" | "right" | "between";
  className?: string;
}) {
  const justify =
    align === "right"
      ? "justify-end"
      : align === "between"
        ? "justify-between"
        : "justify-start";
  return (
    <p
      className={`flex items-center gap-3 text-[11px] tracking-[0.28em] uppercase text-bronze ${justify} ${className}`}
    >
      {index ? <span className="text-ink-mute">N° {index}</span> : null}
      {index ? <span aria-hidden className="h-px w-8 bg-bronze/50" /> : null}
      <span>{label}</span>
    </p>
  );
}

export function ChapterHeading({
  index,
  eyebrow,
  title,
  className = "",
}: {
  index: string;
  eyebrow: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Folio index={index} label={eyebrow} />
      <h2 className="font-display mt-3 text-2xl leading-tight tracking-tight text-ink md:text-4xl">
        {title}
      </h2>
      <div aria-hidden className="mt-4 h-px w-full bg-ink/10">
        <div className="h-px w-16 bg-bronze" />
      </div>
    </div>
  );
}

export function CatalogInterlude({
  index,
  line,
  sub,
}: {
  index: string;
  line: string;
  sub: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 border-y border-ink/10 py-8 md:flex-row md:items-center md:gap-8">
      <span className="flex items-center gap-3 text-bronze">
        <MotifMark className="h-6 w-6" />
        <span className="text-[11px] tracking-[0.28em] uppercase">N° {index} — Interlude</span>
      </span>
      <p className="font-display max-w-2xl text-xl leading-snug text-ink italic md:text-2xl">
        “{line}”
      </p>
      <p className="text-sm text-ink-mute md:ml-auto md:max-w-xs md:text-right">{sub}</p>
    </div>
  );
}
