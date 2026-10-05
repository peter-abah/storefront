import Link from "next/link";
import { MotifMark } from "./Editorial";

/**
 * Phase 3 rescue block — one voice for cart-empty, orders-empty,
 * search no-results and 404. Motif + folio + clear next step.
 * Pure presentational; all data/redirect logic stays in callers.
 */
export function EmptyState({
  eyebrow,
  title,
  body,
  primary,
  secondary = [],
}: {
  eyebrow: string;
  title: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string }[];
}) {
  return (
    <div className="px-6 py-14 text-center">
      <span className="inline-flex items-center justify-center text-bronze">
        <MotifMark className="h-7 w-7" />
      </span>
      <p className="mt-4 text-[11px] tracking-[0.28em] uppercase text-bronze">{eyebrow}</p>
      <h2 className="font-display mx-auto mt-3 max-w-md text-2xl leading-tight tracking-tight text-ink md:text-3xl">
        {title}
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">{body}</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link
          href={primary.href}
          className="rounded-pill bg-ink px-6 py-2.5 text-sm text-cream transition-transform duration-200 hover:-translate-y-0.5"
        >
          {primary.label}
        </Link>
        {secondary.map((s) => (
          <Link
            key={s.href + s.label}
            href={s.href}
            className="rounded-pill border border-ink/15 px-5 py-2.5 text-sm text-ink hover:border-bronze hover:text-bronze-deep"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
