// Branded order email templates (PRD F9). Pure functions — no React Email
// dep, no vendor imports. Table-layout 600px, all-inline styles, luxury
// tokens (paper #F7F3EC, ink #1C1917, bronze #9A7B4F), Fraunces/Georgia
// headings, absolute APP_URL links, CTA anchor + plain-URL fallback.

export type OrderLineView = {
  name: string;
  qty: number;
  unitDisplay: string;
  lineDisplay: string;
  /** SKU = product slug (owner/admin slips). */
  sku?: string;
  /** Stock at notify time (owner/admin slips). */
  stock?: number | null;
};

export type OrderAddressView = {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  postal: string;
  country: string;
  zoneName: string | null;
  notes?: string | null;
};

export type OrderEmailView = {
  orderNumber: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  address: OrderAddressView;
  lines: OrderLineView[];
  currencyCode: string;
  subtotalDisplay: string;
  shippingDisplay: string;
  totalDisplay: string;
  etaDays: string | null;
  orderUrl: string;
  confirmUrl: string;
  adminUrl: string;
  supportEmail: string;
  storeName?: string;
  /** Phase 1 trust shell — contact + legal links (absolute URLs). */
  supportPhone?: string;
  shopAddress?: string;
  shopHours?: string;
  whatsappUrl?: string;
  whatsappDisplay?: string;
  shippingUrl?: string;
  returnsUrl?: string;
  contactUrl?: string;
  /** Paystack branch: cod (default) vs paystack. */
  paymentMethod?: string;
  /** Gateway reference for paid orders (receipt + ops). */
  paystackRef?: string | null;
  /** Masked card for the receipt (ops + buyer). */
  cardLast4?: string | null;
  cardBrand?: string | null;
};

/** True when the order was prepaid online (nothing due on delivery). */
export function isPaidView(v: OrderEmailView): boolean {
  return v.paymentMethod === "paystack";
}

function billingTagOf(v: OrderEmailView): string {
  return isPaidView(v) ? "Paid online" : "Cash on delivery";
}

export type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

const PAPER = "#F7F3EC";
const PAPER_DEEP = "#EDE5D3";
const INK = "#1C1917";
const INK_SOFT = "#57534E";
const BRONZE = "#9A7B4F";
const HEADINGS = "Fraunces, Georgia, 'Times New Roman', serif";
const BODY = "'Helvetica Neue', Helvetica, Arial, sans-serif";

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function storeNameOf(v: OrderEmailView): string {
  return v.storeName ?? "Maison";
}

function lineRowsHtml(v: OrderEmailView): string {
  return v.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${PAPER_DEEP};font-family:${BODY};font-size:14px;color:${INK};">
            ${esc(l.name)}<br />
            <span style="font-size:12px;color:${INK_SOFT};">Qty ${l.qty} &times; ${esc(l.unitDisplay)}${l.sku ? ` &middot; SKU ${esc(l.sku)}` : ""}</span>
          </td>
          <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid ${PAPER_DEEP};font-family:${BODY};font-size:14px;color:${INK};white-space:nowrap;vertical-align:top;">
            ${esc(l.lineDisplay)}
          </td>
        </tr>`,
    )
    .join("");
}

function buyerLineRowsHtml(v: OrderEmailView): string {
  return v.lines
    .map(
      (l) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${PAPER_DEEP};font-family:${BODY};font-size:14px;color:${INK};">
            ${esc(l.name)}<br />
            <span style="font-size:12px;color:${INK_SOFT};">Qty ${l.qty} &times; ${esc(l.unitDisplay)}</span>
          </td>
          <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid ${PAPER_DEEP};font-family:${BODY};font-size:14px;color:${INK};white-space:nowrap;vertical-align:top;">
            ${esc(l.lineDisplay)}
          </td>
        </tr>`,
    )
    .join("");
}

function totalsHtml(v: OrderEmailView): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
      <tr>
        <td style="font-family:${BODY};font-size:14px;color:${INK_SOFT};padding:3px 0;">Subtotal</td>
        <td align="right" style="font-family:${BODY};font-size:14px;color:${INK};padding:3px 0;">${esc(v.subtotalDisplay)}</td>
      </tr>
      <tr>
        <td style="font-family:${BODY};font-size:14px;color:${INK_SOFT};padding:3px 0;">Delivery fee</td>
        <td align="right" style="font-family:${BODY};font-size:14px;color:${INK};padding:3px 0;">${esc(v.shippingDisplay)}</td>
      </tr>
      <tr>
        <td style="font-family:${HEADINGS};font-size:16px;color:${INK};padding:8px 0 0;">Total (${esc(v.currencyCode)})</td>
        <td align="right" style="font-family:${HEADINGS};font-size:18px;color:${INK};padding:8px 0 0;">${esc(v.totalDisplay)}</td>
      </tr>
    </table>`;
}

function addressHtml(v: OrderEmailView): string {
  const a = v.address;
  return `
    <p style="font-family:${BODY};font-size:14px;line-height:1.6;color:${INK};margin:0;">
      ${esc(a.name)}<br />
      ${esc(a.street)}<br />
      ${esc(a.city)}, ${esc(a.state)} ${esc(a.postal)}<br />
      ${esc(a.country)}<br />
      <span style="color:${INK_SOFT};">${esc(a.phone)}</span>
      ${a.zoneName ? `<br /><span style="color:${INK_SOFT};">Zone: ${esc(a.zoneName)}${v.etaDays ? ` &middot; ETA ${esc(v.etaDays)}` : ""}</span>` : ""}
    </p>`;
}

function ctaHtml(label: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;">
      <tr>
        <td style="background-color:${INK};padding:13px 28px;">
          <a href="${esc(url)}" style="font-family:${BODY};font-size:14px;font-weight:bold;color:${PAPER};text-decoration:none;">${esc(label)}</a>
        </td>
      </tr>
    </table>
    <p style="font-family:${BODY};font-size:12px;line-height:1.6;color:${INK_SOFT};margin:0 0 4px;">
      Button not working? Paste this link into your browser:<br />
      <a href="${esc(url)}" style="color:${BRONZE};word-break:break-all;">${esc(url)}</a>
    </p>`;
}

function shell(opts: {
  preheader: string;
  eyebrow: string;
  heading: string;
  introHtml: string;
  v: OrderEmailView;
  /** Optional extra block rendered inside the container, above the footer. */
  extraHtml?: string;
  /** When true, render buyer lines without SKU. */
  hideSku?: boolean;
  /** Overrides the footer billing tag (defaults to the view's method). */
  billingTag?: string;
}): string {
  const store = storeNameOf(opts.v);
  const tag = opts.billingTag ?? billingTagOf(opts.v);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background-color:${PAPER_DEEP};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER_DEEP};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${PAPER};padding:36px 36px 28px;text-align:left;">
        <tr><td>
          <p style="font-family:${BODY};font-size:11px;letter-spacing:3px;text-transform:uppercase;color:${BRONZE};margin:0 0 8px;">${esc(store)} &middot; ${esc(opts.eyebrow)}</p>
          <h1 style="font-family:${HEADINGS};font-size:30px;line-height:1.15;color:${INK};margin:0 0 6px;font-weight:600;">${esc(opts.heading)}</h1>
          <div style="border-top:2px solid ${BRONZE};width:64px;margin:14px 0 18px;">&nbsp;</div>
          <div style="font-family:${BODY};font-size:14px;line-height:1.7;color:${INK};">${opts.introHtml}</div>
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${PAPER};padding:0 36px 36px;text-align:left;">
        <tr><td>
          <p style="font-family:${BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${INK_SOFT};margin:24px 0 4px;">Order ${esc(opts.v.orderNumber)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${opts.hideSku ? buyerLineRowsHtml(opts.v) : lineRowsHtml(opts.v)}</table>
          ${totalsHtml(opts.v)}
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${PAPER};padding:0 36px 36px;text-align:left;">
        <tr><td>
          <p style="font-family:${BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${INK_SOFT};margin:0 0 8px;">Delivery address</p>
          ${addressHtml(opts.v)}
        </td></tr>
      </table>
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:${PAPER};padding:8px 36px 36px;text-align:center;">
        <tr><td style="border-top:1px solid ${PAPER_DEEP};padding-top:20px;text-align:left;">
          ${opts.extraHtml ?? ""}
          <p style="font-family:${BODY};font-size:12px;color:${INK_SOFT};margin:0;">${esc(store)} &middot; ${esc(tag)} &middot; Questions? Write to ${esc(opts.v.supportEmail)}${opts.v.supportPhone ? ` &middot; ${esc(opts.v.supportPhone)}` : ""}${opts.v.whatsappDisplay ? ` &middot; ${esc(opts.v.whatsappDisplay)}${opts.v.shopHours ? ` (${esc(opts.v.shopHours)})` : ""}` : ""}${opts.v.contactUrl ? ` &middot; <a href="${esc(opts.v.contactUrl)}" style="color:${BRONZE};">Contact the shop</a>` : ""}</p>
          ${opts.v.shopAddress ? `<p style="font-family:${BODY};font-size:12px;color:${INK_SOFT};margin:6px 0 0;">${esc(opts.v.shopAddress)}</p>` : ""}
          ${opts.v.whatsappUrl ? `<p style="font-family:${BODY};font-size:12px;margin:6px 0 0;"><a href="${esc(opts.v.whatsappUrl)}" style="color:${BRONZE};">${esc(opts.v.whatsappDisplay || "WhatsApp")}</a></p>` : ""}
          ${opts.v.shippingUrl || opts.v.returnsUrl ? `<p style="font-family:${BODY};font-size:12px;margin:8px 0 0;">${opts.v.shippingUrl ? `<a href="${esc(opts.v.shippingUrl)}" style="color:${BRONZE};">Shipping</a>` : ""}${opts.v.returnsUrl ? ` &middot; <a href="${esc(opts.v.returnsUrl)}" style="color:${BRONZE};">Returns</a>` : ""}</p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function linesText(v: OrderEmailView): string {
  return v.lines
    .map(
      (l) =>
        `- ${l.name}${l.sku ? ` (SKU ${l.sku})` : ""} — Qty ${l.qty} x ${l.unitDisplay} = ${l.lineDisplay}`,
    )
    .join("\n");
}

function buyerLinesText(v: OrderEmailView): string {
  return v.lines
    .map((l) => `- ${l.name} — Qty ${l.qty} x ${l.unitDisplay} = ${l.lineDisplay}`)
    .join("\n");
}

function textFooter(v: OrderEmailView): string {
  const contact = `Questions? Write to ${v.supportEmail}${v.supportPhone ? ` · ${v.supportPhone}` : ""}${v.whatsappDisplay ? ` · ${v.whatsappDisplay}${v.shopHours ? ` (${v.shopHours})` : ""}` : ""}${v.contactUrl ? ` · Contact the shop: ${v.contactUrl}` : ""}`;
  const shop = v.shopAddress ? `\n${v.shopAddress}` : "";
  const wa = v.whatsappUrl
    ? `\nWhatsApp: ${v.whatsappDisplay ? `${v.whatsappDisplay} ` : ""}${v.whatsappUrl}`
    : "";
  const links = [v.shippingUrl, v.returnsUrl].filter(Boolean).join(" / ");
  return `\n--\n${storeNameOf(v)} · ${billingTagOf(v)} · ${contact}${shop}${wa}${links ? `\n${links}` : ""}`;
}

/** Paid receipt line shared by buyer/owner/admin texts. */
function paidLineText(v: OrderEmailView): string {
  const bits = [`Paystack ref ${v.paystackRef ?? "—"}`];
  if (v.cardBrand || v.cardLast4) {
    bits.push(`${v.cardBrand ?? "Card"}${v.cardLast4 ? ` •• ${v.cardLast4}` : ""}`);
  }
  return bits.join(" · ");
}

/** Paid receipt block shared by buyer/owner/admin HTML. */
function paidLineHtml(v: OrderEmailView): string {
  const card =
    v.cardBrand || v.cardLast4
      ? ` &middot; ${esc(v.cardBrand ?? "Card")}${v.cardLast4 ? ` &middot;&middot; ${esc(v.cardLast4)}` : ""}`
      : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER_DEEP};margin:0 0 6px;">
      <tr><td style="padding:14px 16px;">
        <p style="font-family:${BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRONZE};margin:0 0 6px;">Paid online — nothing due</p>
        <p style="font-family:${BODY};font-size:14px;color:${INK};margin:0;">Paystack ref ${esc(v.paystackRef ?? "—")}${card}</p>
      </td></tr>
    </table>`;
}

/** 1. Buyer confirmation: COD cash-ready note OR paid-online receipt. */
export function orderBuyerConfirm(v: OrderEmailView): EmailTemplate {
  const store = storeNameOf(v);
  if (isPaidView(v)) {
    const subject = `Order ${v.orderNumber} paid — receipt inside`;
    const introHtml = `
    <p style="margin:0 0 10px;">Dear ${esc(v.buyerName)}, thank you — your payment went through.</p>
    <p style="margin:0 0 10px;">This order is <strong>paid in full (${esc(v.totalDisplay)})</strong> — nothing is due to the rider${v.etaDays ? ` (ETA ${esc(v.etaDays)}${v.address.zoneName ? `, ${esc(v.address.zoneName)}` : ""})` : ""}.</p>
    ${paidLineHtml(v)}
    ${ctaHtml("Track your order", v.orderUrl)}
  `;
    const html = shell({
      preheader: `Order ${v.orderNumber} paid (${v.totalDisplay}) — nothing due on delivery.`,
      eyebrow: "Payment receipt",
      heading: "Payment received — thank you.",
      introHtml,
      v,
      hideSku: true,
    });
    const text = `${store} — Order ${v.orderNumber} paid\n\nDear ${v.buyerName}, thank you — your payment went through.\nPaid in full (${v.totalDisplay}): nothing is due to the rider${v.etaDays ? ` (ETA ${v.etaDays}${v.address.zoneName ? `, ${v.address.zoneName}` : ""})` : ""}.\n${paidLineText(v)}\n\nTrack your order: ${v.orderUrl}\n\nITEMS\n${buyerLinesText(v)}\n\nSubtotal: ${v.subtotalDisplay}\nDelivery fee: ${v.shippingDisplay}\nTotal paid (${v.currencyCode}): ${v.totalDisplay}\n\nDELIVERY ADDRESS\n${v.address.name}\n${v.address.street}\n${v.address.city}, ${v.address.state} ${v.address.postal}\n${v.address.country}\n${v.address.phone}${v.address.zoneName ? `\nZone: ${v.address.zoneName}` : ""}${textFooter(v)}`;
    return { subject, html, text };
  }
  const subject = `Order ${v.orderNumber} confirmed — pay on delivery`;
  const introHtml = `
    <p style="margin:0 0 10px;">Dear ${esc(v.buyerName)}, thank you — we&apos;ve got your order.</p>
    <p style="margin:0 0 10px;">This is <strong>cash on delivery</strong>: please keep <strong>${esc(v.totalDisplay)}</strong> ready. Our rider will <strong>call ${esc(v.buyerPhone)}</strong> before arriving${v.etaDays ? ` (ETA ${esc(v.etaDays)}${v.address.zoneName ? `, ${esc(v.address.zoneName)}` : ""})` : ""}.</p>
    ${ctaHtml("Track your order", v.orderUrl)}
  `;
  const html = shell({
    preheader: `Order ${v.orderNumber} confirmed — ${v.totalDisplay} cash on delivery.`,
    eyebrow: "Order confirmation",
    heading: "Thank you — we've got your order.",
    introHtml,
    v,
    hideSku: true,
  });
  const text = `${store} — Order ${v.orderNumber} confirmed\n\nDear ${v.buyerName}, thank you — we've got your order.\nCash on delivery: keep ${v.totalDisplay} ready. Our rider will call ${v.buyerPhone} before arriving${v.etaDays ? ` (ETA ${v.etaDays}${v.address.zoneName ? `, ${v.address.zoneName}` : ""})` : ""}.\n\nTrack your order: ${v.orderUrl}\n\nITEMS\n${buyerLinesText(v)}\n\nSubtotal: ${v.subtotalDisplay}\nDelivery fee: ${v.shippingDisplay}\nTotal (${v.currencyCode}): ${v.totalDisplay}\n\nDELIVERY ADDRESS\n${v.address.name}\n${v.address.street}\n${v.address.city}, ${v.address.state} ${v.address.postal}\n${v.address.country}\n${v.address.phone}${v.address.zoneName ? `\nZone: ${v.address.zoneName}` : ""}${textFooter(v)}`;
  return { subject, html, text };
}

function ownerIntroHtml(v: OrderEmailView): string {
  return `
    <p style="margin:0 0 10px;">${isPaidView(v) ? "A prepaid order is ready to confirm — money already landed." : "A new order needs your confirmation."}</p>
    ${isPaidView(v) ? paidLineHtml(v) : ""}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAPER_DEEP};margin:0 0 6px;">
      <tr><td style="padding:14px 16px;">
        <p style="font-family:${BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${BRONZE};margin:0 0 6px;">Buyer contact — call to confirm</p>
        <p style="font-family:${HEADINGS};font-size:20px;color:${INK};margin:0 0 4px;">${esc(v.buyerName)} &middot; ${esc(v.buyerPhone)}</p>
        <p style="font-family:${BODY};font-size:13px;color:${INK_SOFT};margin:0;">${esc(v.buyerEmail)}</p>
        ${v.address.notes ? `<p style="font-family:${BODY};font-size:13px;color:${INK};margin:8px 0 0;"><em>Buyer note: ${esc(v.address.notes)}</em></p>` : ""}
      </td></tr>
    </table>
    <p style="font-family:${BODY};font-size:12px;line-height:1.6;color:${INK_SOFT};margin:10px 0 0;">Stock noted at order time — please confirm promptly and check current levels before packing.</p>
    ${ctaHtml("Confirm this order", v.confirmUrl)}
  `;
}

function ownerTextBody(v: OrderEmailView): string {
  const paidLine = isPaidView(v) ? `\n\nPAID ONLINE — nothing to collect\n${paidLineText(v)}` : "";
  return `BUYER CONTACT (call to confirm)\n${v.buyerName} · ${v.buyerPhone}\n${v.buyerEmail}${v.address.notes ? `\nBuyer note: ${v.address.notes}` : ""}${paidLine}\n\nITEMS\n${linesText(v)}\n\nSubtotal: ${v.subtotalDisplay}\nDelivery fee: ${v.shippingDisplay}\nTotal (${v.currencyCode}): ${v.totalDisplay}\n\nFULL ADDRESS\n${v.address.name}\n${v.address.street}\n${v.address.city}, ${v.address.state} ${v.address.postal}\n${v.address.country}\n${v.address.phone}${v.address.zoneName ? `\nZone: ${v.address.zoneName}` : ""}${v.etaDays ? `\nETA: ${v.etaDays}` : ""}`;
}

/** 2. Owner fulfillment slip: buyer contact prominent, full address, confirm CTA. */
export function orderOwnerSlip(v: OrderEmailView): EmailTemplate {
  const subject = `New order ${v.orderNumber} — ${v.totalDisplay}, confirm now`;
  const html = shell({
    preheader: `New order ${v.orderNumber} — ${v.buyerName}, ${v.buyerPhone}.`,
    eyebrow: "Fulfillment slip",
    heading: `New order ${v.orderNumber}`,
    introHtml: ownerIntroHtml(v),
    v,
  });
  const text = `New order ${v.orderNumber} — confirm now: ${v.confirmUrl}\n\n${ownerTextBody(v)}${textFooter(v)}`;
  return { subject, html, text };
}

/** 3. Admin digest: owner-slip content + provider/log observability hint. */
export function orderAdminDigest(v: OrderEmailView): EmailTemplate {
  const subject = `Order ${v.orderNumber} — ${v.totalDisplay} (${v.currencyCode})`;
  const extraHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${PAPER_DEEP};">
      <tr><td style="padding:12px 16px;">
        <p style="font-family:${BODY};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${INK_SOFT};margin:0 0 6px;">Ops hint</p>
        <p style="font-family:${BODY};font-size:13px;line-height:1.6;color:${INK};margin:0;">
          Delivery updates for this order are in Admin → Emails.
          <a href="${esc(v.adminUrl)}" style="color:${BRONZE};">Open order</a> to review or resend.
        </p>
      </td></tr>
    </table>`;
  const html = shell({
    preheader: `Order ${v.orderNumber} — ${v.totalDisplay} confirmed.`,
    eyebrow: "Admin digest",
    heading: `Order ${v.orderNumber} — digest`,
    introHtml: ownerIntroHtml(v),
    v,
    extraHtml,
  });
  const text = `Admin digest for order ${v.orderNumber}\n\n${ownerTextBody(v)}\n\nOperations — delivery updates live under Admin → Emails. Review: ${v.adminUrl}${textFooter(v)}`;
  return { subject, html, text };
}

// Spec-name aliases (Wave 5 brief): buyerConfirmation / ownerFulfillmentSlip /
// adminDigest. Single OrderEmailView aggregates (order, lines, zone) so the
// builders stay pure (no DB); currency lookup + toDisplay/formatDisplay live
// in lib/email/notify.ts buildView.
/** Buyer confirmation alias. */
export const buyerConfirmation = orderBuyerConfirm;
/** Owner fulfillment-slip alias (SKUs = slugs, stock note included). */
export const ownerFulfillmentSlip = orderOwnerSlip;
/** Admin digest alias. */
export const adminDigest = orderAdminDigest;
