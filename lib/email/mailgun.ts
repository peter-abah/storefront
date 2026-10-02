// Mailgun provider (V1 active impl). Native fetch only — no mailgun.js dep.
// Correct endpoints: domains GET /v3/domains/{domain}; messages POST
// https://api.mailgun.net/v3/{domain}/messages
// (EU: https://api.eu.mailgun.net) with Basic api:key + multipart/form-data.
// Sandbox rule: `from` is always the configured sandbox sender; recipients
// come from the caller (`lib/email/notify.ts` redirects to TEST_INBOX).

import {
  EmailSendError,
  type EmailProvider,
  type EmailSendInput,
  type EmailSendResult,
} from "./provider";

export type MailgunConfig = {
  apiKey: string;
  domain: string;
  from: string;
  region?: string;
};

/** Region-switched API host. Host only — callers append `/v3/...` (no /v3 bug). */
export function mailgunBaseUrl(region?: string): string {
  return (region ?? "US").trim().toUpperCase() === "EU"
    ? "https://api.eu.mailgun.net"
    : "https://api.mailgun.net";
}

function asList(to: EmailSendInput["to"]): string[] {
  return (Array.isArray(to) ? to : [to])
    .map((s) => s.trim())
    .filter(Boolean);
}

export function createMailgunProvider(
  config?: Partial<MailgunConfig>,
): EmailProvider {
  const apiKey = config?.apiKey ?? process.env.MAILGUN_API_KEY ?? "";
  const domain = config?.domain ?? process.env.MAILGUN_DOMAIN ?? "";
  const from = config?.from ?? process.env.MAILGUN_FROM ?? "";
  const region = config?.region ?? process.env.MAILGUN_REGION ?? "US";

  if (!apiKey) {
    throw new Error("[email] missing MAILGUN_API_KEY — set it in env.");
  }
  if (!domain) {
    throw new Error("[email] missing MAILGUN_DOMAIN — set it in env.");
  }
  if (!from) {
    throw new Error("[email] missing MAILGUN_FROM — set it in env.");
  }

  const url = `${mailgunBaseUrl(region)}/v3/${domain}/messages`;
  const auth =
    "Basic " + Buffer.from(`api:${apiKey}`, "utf8").toString("base64");

  return {
    name: "mailgun",
    async send(input: EmailSendInput): Promise<EmailSendResult> {
      const recipients = asList(input.to);
      if (recipients.length === 0) {
        throw new EmailSendError({
          message: "[email] no recipients",
          retryable: false,
          code: "NO_RECIPIENTS",
        });
      }
      if (!input.subject?.trim() || !input.html?.trim()) {
        throw new EmailSendError({
          message: "[email] subject and html are required",
          retryable: false,
          code: "INVALID_INPUT",
        });
      }

      const form = new FormData();
      form.append("from", from);
      for (const r of recipients) form.append("to", r);
      form.append("subject", input.subject);
      form.append("html", input.html);
      if (input.text?.trim()) form.append("text", input.text);
      if (input.replyTo?.trim()) form.append("h:reply-to", input.replyTo.trim());

      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { Authorization: auth },
          body: form,
        });
      } catch (e) {
        // Network / DNS / timeout — safe to retry.
        throw new EmailSendError({
          message: `[email] mailgun network error: ${(e as Error)?.message ?? e}`,
          retryable: true,
          code: "NETWORK",
        });
      }

      if (res.ok) {
        let id = "";
        try {
          const json = (await res.json()) as { id?: string; message?: string };
          id = json.id ?? json.message ?? "";
        } catch {
          id = "";
        }
        return { id: id || `mailgun-${Date.now()}` };
      }

      const body = (await res.text().catch(() => "")).slice(0, 500);
      const isFailFast =
        res.status === 400 || res.status === 401 || res.status === 403;
      // Sandbox rejects non-authorized recipients (403) → fail fast, no retry.
      // 429 + 5xx/network → retryable. Other 4xx → non-retryable.
      const retryable = isFailFast
        ? false
        : res.status === 429 || res.status >= 500;
      const hint =
        res.status === 403
          ? " — unauthorized recipient: add to Authorized Recipients in the Mailgun dashboard, then retry"
          : "";
      throw new EmailSendError({
        message: `[email] mailgun ${res.status}: ${body || res.statusText}${hint}`,
        status: res.status,
        retryable,
        providerMessage: `${body || res.statusText}${hint}`,
        code: `MAILGUN_${res.status}`,
      });
    },
  };
}
