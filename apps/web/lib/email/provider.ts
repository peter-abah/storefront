// Email provider port (PRD F9 / ADR-008). Nothing outside `lib/email/`
// may import a vendor SDK — providers implement this interface and are
// chosen via `lib/email/index.ts` by EMAIL_PROVIDER.

export type EmailRecipient = string | string[];

export type EmailSendInput = {
  to: EmailRecipient;
  subject: string;
  html: string;
  text?: string;
  /** Reply-To header (support mailbox). Phase 1 trust shell. */
  replyTo?: string;
};

export type EmailSendResult = {
  /** Provider message id (Mailgun `id`, Resend `id`, ...). */
  id: string;
};

export interface EmailProvider {
  /** Stable provider key recorded in `email_log.provider`. */
  readonly name: string;
  send(input: EmailSendInput): Promise<EmailSendResult>;
}

export type EmailSendErrorOptions = {
  message: string;
  /** HTTP status from the provider (if any). */
  status?: number;
  /** True when the caller should retry (429 / 5xx / network). */
  retryable: boolean;
  /** Raw provider-side message for `email_log.last_error`. */
  providerMessage?: string;
  code?: string;
};

/** Throw when a provider send fails. Non-retryable = fail fast (4xx). */
export class EmailSendError extends Error {
  status?: number;
  retryable: boolean;
  providerMessage?: string;
  code: string;

  constructor(opts: EmailSendErrorOptions) {
    super(opts.message);
    this.name = "EmailSendError";
    this.status = opts.status;
    this.retryable = opts.retryable;
    this.providerMessage = opts.providerMessage;
    this.code = opts.code ?? "PROVIDER_ERROR";
  }
}
