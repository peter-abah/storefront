import Link from "next/link";

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

export function RoomRail({ rooms }: RoomRailProps) {
  if (rooms.length === 0) return null;
  return (
    <nav aria-label="Shop by room" className="border-y border-ink/10 bg-cream/60">
      <div className="editorial-grid py-5">
        <p className="col-span-12 text-xs tracking-[0.28em] uppercase text-ink-mute">
          Shop by room
        </p>
        <ul className="col-span-12 mt-3 flex gap-2 overflow-x-auto pb-1">
          {rooms.map((room) => (
            <li key={room} className="shrink-0">
              <Link
                href={`/shop?room=${encodeURIComponent(room)}`}
                className="rounded-pill inline-block border border-ink/15 bg-paper px-5 py-2.5 text-sm transition-colors hover:border-bronze hover:text-bronze-deep"
              >
                {label(room)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
