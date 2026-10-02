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

export const checkoutSchema = z.object({
  address: addressSchema,
  currencyCode: z.string().trim().min(1, "Choose a currency."),
  clientToken: z.string().uuid("Something interrupted checkout — please reload and try again."),
  zoneId: z.string().uuid("Choose a delivery zone."),
});

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().min(1).max(99),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CartLineInput = z.infer<typeof cartLineSchema>;
