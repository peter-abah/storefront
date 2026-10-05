import { z } from "zod";

// F6 industry-standard COD fields. Phone is E.164-ish (min 7 digits);
// the rider calls this number, so it is required at checkout.
export const addressSchema = z.object({
  name: z.string().trim().min(2, "Enter the recipient's full name."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{7,20}$/, "Enter a valid phone number."),
  country: z.string().trim().min(1, "Country is required."),
  state: z.string().trim().min(1, "State / region is required."),
  city: z.string().trim().min(1, "City is required."),
  street: z.string().trim().min(2, "Street address is required."),
  postal: z.string().trim().min(1, "Postal code is required."),
  zoneId: z.string().uuid("Choose a delivery zone."),
  notes: z.string().trim().max(500, "Notes are limited to 500 characters.").optional(),
});

export const paymentMethodSchema = z.enum(["cod", "paystack"]);

export const checkoutSchema = z
  .object({
    address: addressSchema,
    currencyCode: z.string().trim().min(1, "Choose a currency."),
    clientToken: z.string().uuid("Something interrupted checkout — please reload and try again."),
    zoneId: z.string().uuid("Choose a delivery zone."),
    paymentMethod: paymentMethodSchema.optional().default("cod"),
    // Paystack inline-popup reference. Absent at init (server mints it);
    // present when the shopper returns from the popup / verify step.
    paystackReference: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid payment reference.")
      .optional(),
  // Honest-checkout expectations: what the shopper reviewed. Server
  // re-prices from the DB and returns PRICE_CHANGED on drift — these
  // values are never trusted for charging.
  expectedSubtotalBaseCents: z.number().int().min(0).optional(),
  expectedShippingBaseCents: z.number().int().min(0).optional(),
  expectedTotalBaseCents: z.number().int().min(0).optional(),
  expectedRateToBase: z.string().trim().min(1).optional(),
})
  .superRefine((v, ctx) => {
    // Conditional: a Paystack reference never applies to cash-on-delivery.
    if (v.paymentMethod === "cod" && v.paystackReference) {
      ctx.addIssue({
        code: "custom",
        path: ["paystackReference"],
        message: "Payment reference does not apply to cash on delivery.",
      });
    }
  });

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CartLineInput = z.infer<typeof cartLineSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
