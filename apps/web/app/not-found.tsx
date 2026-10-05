import Link from "next/link";
import { EmptyState } from "@/components/storefront/EmptyState";

export default function NotFound() {
  return (
    <main className="editorial-grid py-20">
      <div className="col-span-12 md:col-span-8 md:col-start-3">
        <div className="border-t-2 border-ink bg-cream">
          <EmptyState
            eyebrow="Off the shelf — N° 404"
            title="That piece isn't here."
            body="It may have sold through or the link is off — every room starts again from the catalog. Begin with Living Room."
            primary={{ href: "/shop", label: "Browse the catalog" }}
            secondary={[{ href: "/shop?room=living", label: "Explore Living Room" }]}
          />
        </div>
        <p className="mt-4 text-center text-xs text-ink-mute">
          Or <Link href="/" className="text-bronze-deep underline underline-offset-4">return home</Link> to
          start from the editors&rsquo; picks.
        </p>
      </div>
    </main>
  );
}
