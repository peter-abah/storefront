import Link from "next/link";
import { Folio, MotifMark } from "./Editorial";

type RoomRailProps = {
  rooms: string[];
};

const LABELS: Record<string, string> = {
  living: "Living Room",
  bedroom: "Bedroom",
  dining: "Dining",
  bath: "Bath",
  decor: "Décor",
  outdoor: "Outdoor",
};

function label(room: string): string {
  return LABELS[room] ?? room[0]!.toUpperCase() + room.slice(1);
}

/**
 * Phase 3 RoomRail — an editorial index, not a pill row.
 * Numbered serif entries with hairline dividers and an arrow that
 * nudges on hover (transform only). Horizontally scrollable on mobile.
 */
export function RoomRail({ rooms }: RoomRailProps) {
  if (rooms.length === 0) return null;
  return (
    <nav aria-label="Shop by room" className="border-b border-ink/10">
      <div className="editorial-grid py-6 md:py-8">
        <div className="col-span-12 flex items-center justify-between gap-4">
          <Folio index="02" label={`Index — Shop by room · ${rooms.length}`} />
          <span aria-hidden className="hidden text-bronze sm:block">
            <MotifMark className="h-4 w-4" />
          </span>
        </div>
        <ol className="col-span-12 mt-4 flex gap-0 overflow-x-auto">
          {rooms.map((room, i) => (
            <li key={room} className="group shrink-0">
              <Link
                href={`/shop?room=${encodeURIComponent(room)}`}
                className="flex items-baseline gap-3 border-l border-ink/10 py-2 pr-7 pl-5 first:border-l-0 first:pl-0 last:pr-1"
              >
                <span className="text-[11px] tracking-[0.2em] text-bronze">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="font-display text-xl whitespace-nowrap tracking-tight text-ink transition-transform duration-200 group-hover:-translate-y-0.5 md:text-2xl">
                  {label(room)}
                </span>
                <span
                  aria-hidden
                  className="text-sm text-ink-mute transition-transform duration-200 group-hover:translate-x-1 group-hover:text-bronze-deep"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
