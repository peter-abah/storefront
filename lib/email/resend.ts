// Resend provider — stubbed future impl (PRD F9 / ADR-008).
// Swapping to Resend later = implement this + flip EMAIL_PROVIDER.
// DO NOT install the `resend` dep until the swap. Zero new deps.

import { EmailSendError, type EmailProvider } from "./provider";

const NOT_CONFIGURED_MSG =
  "[email] Resend provider NOT_CONFIGURED — set RESEND_API_KEY and implement lib/email/resend.ts (V1 ships Mailgun only).";

export function createResendProvider(): EmailProvider {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new EmailSendError({
      message: NOT_CONFIGURED_MSG,
      retryable: false,
      code: "NOT_CONFIGURED",
    });
  }
  // Key present but impl not written yet — same interface, fail on send.
  return {
    name: "resend",
    async send() {
      throw new EmailSendError({
        message: NOT_CONFIGURED_MSG,
        retryable: false,
        code: "NOT_CONFIGURED",
      });
    },
  };
}
