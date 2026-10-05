// Provider factory (PRD F9). EMAIL_PROVIDER=mailgun (default) | resend.
// Cached singleton; fail-fast on missing key/domain/from (thrown by the
// provider constructors, surfacing as 500 from the notify route).
//
// Ban rule: nothing outside lib/email/ may import vendor SDKs (there are
// none — native fetch only, no mailgun.js / resend deps).

import type { EmailProvider } from "./provider";
import { createMailgunProvider } from "./mailgun";
import { createResendProvider } from "./resend";

let cached: EmailProvider | null = null;
let cachedFor: string | null = null;

export function providerKey(): string {
  return (process.env.EMAIL_PROVIDER ?? "mailgun").trim().toLowerCase();
}

export function getEmailProvider(): EmailProvider {
  const key = providerKey() || "mailgun";
  if (cached && cachedFor === key) return cached;
  if (key === "mailgun") {
    cached = createMailgunProvider();
  } else if (key === "resend") {
    cached = createResendProvider(); // throws NOT_CONFIGURED until the swap
  } else {
    throw new Error(
      `[email] unknown EMAIL_PROVIDER="${key}" (expected "mailgun" | "resend")`,
    );
  }
  cachedFor = key;
  return cached;
}

/** Test-only escape hatch (live-fire script never needs this). */
export function __resetEmailProviderForTests(): void {
  cached = null;
  cachedFor = null;
}
