// @maison/shared — mobile API contract (WP2).
// DTOs mirror the shapes the web server actually returns, camelCase.
// Every field is JSON-serializable: Date columns from Drizzle are typed as
// ISO `string` here because they cross the JSON wire (Date does not survive
// JSON serialization).

/** Generic route-handler envelope — mirrors ActionResult in apps/web/lib/actions/cart.ts:15-17. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string };

// ---------------------------------------------------------------------------
// Cart — apps/web/lib/actions/cart.ts
// ---------------------------------------------------------------------------

/** apps/web/lib/actions/cart.ts:19-30 */
export type CartLineDTO = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  unitBaseCents: number;
  qty: number;
  stock: number;
  lineBaseCents: number;
  /** True when the stored qty exceeds live stock (display clamps). */
  clamped: boolean;
};

/** apps/web/lib/actions/cart.ts:32-42 */
export type CartDTO = {
  lines: CartLineDTO[];
  count: number;
  subtotalBaseCents: number;
  /** Hidden/deleted products still in the cart but excluded from display. */
  removedCount: number;
  removedNames: string[];
  removedIds: string[];
  /** Active products with zero stock (shown as unavailable lines). */
  outOfStockCount: number;
};

/** apps/web/lib/actions/cart.ts:140-143 (summarize) */
export type CartSummaryDTO = {
  count: number;
  subtotalBaseCents: number;
};

/** apps/web/lib/actions/cart.ts:153-155 / 207-209 (addToCart / updateQty result) */
export type CartMutationResultDTO = {
  qty: number;
  clamped: boolean;
  count: number;
  subtotalBaseCents: number;
};

/** apps/web/lib/actions/cart.ts:253-255 (removeLine result) */
export type CartRemoveResultDTO = {
  count: number;
  subtotalBaseCents: number;
};

/** apps/web/lib/actions/cart.ts:275-277 (mergeGuestCart result) */
export type CartMergeResultDTO = {
  merged: number;
  skipped: number;
  count: number;
  subtotalBaseCents: number;
};

/** apps/web/lib/actions/cart.ts:335-347 (getCartProducts public row projection) */
export type GuestCartProductDTO = {
  id: string;
  slug: string;
  name: string;
  priceBaseCents: number;
  stock: number;
  active: boolean;
  images: ProductImage[];
};

// ---------------------------------------------------------------------------
// Catalog — apps/web/lib/queries/products.ts + apps/web/lib/db/schema.ts
// ---------------------------------------------------------------------------

/** apps/web/lib/queries/products.ts:26 (roomEnum, schema.ts:81-88) */
export type Room = "living" | "bedroom" | "dining" | "bath" | "decor" | "outdoor";

/** apps/web/lib/queries/products.ts:27 (categoryEnum, schema.ts:90-96) */
export type Category =
  | "furniture"
  | "lighting"
  | "textiles"
  | "decor"
  | "tableware";

/** apps/web/lib/queries/products.ts:10 */
export type ProductSort = "featured" | "newest" | "price_asc" | "price_desc";

/** apps/web/lib/db/schema.ts:119-122 (products.images jsonb) */
export type ProductImage = { url: string; blurHash?: string };

/** apps/web/lib/db/schema.ts:111-116 (products.dimensions jsonb) */
export type ProductDimensions = { w: number; d: number; h: number; unit: string };

/**
 * Full product row — apps/web/lib/queries/products.ts:6
 * (`typeof products.$inferSelect`, apps/web/lib/db/schema.ts:98-133).
 * `createdAt` is a Date in the web query result; it is an ISO string here.
 */
export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  story: string | null;
  priceBaseCents: number;
  stock: number;
  room: Room;
  category: Category;
  materials: string[] | null;
  dimensions: ProductDimensions | null;
  weightKg: string | null;
  care: string | null;
  images: ProductImage[];
  active: boolean;
  featured: boolean;
  search: string | null;
  /** ISO string on the wire (Date in the web query result). */
  createdAt: string;
};

/** Fields apps/web/components/storefront/ProductCard.tsx:18-88 reads from a full row. */
export type ProductCardDTO = Pick<
  ProductDTO,
  | "id"
  | "slug"
  | "name"
  | "tagline"
  | "priceBaseCents"
  | "stock"
  | "room"
  | "category"
  | "images"
  | "featured"
>;

/** apps/web/app/product/[slug]/page.tsx:42-137 reads the full product row. */
export type ProductDetailDTO = ProductDTO;

/** apps/web/lib/queries/products.ts:133-149 (getRelated — full rows rendered as cards). */
export type RelatedProductDTO = ProductCardDTO;

/** apps/web/lib/queries/products.ts:12-22 (ListProductsParams) */
export type ProductListParamsDTO = {
  search?: string;
  room?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort | string;
  page?: number;
  perPage?: number;
};

/** apps/web/lib/queries/products.ts:56-124 (listProducts result) */
export type PaginatedProductsDTO = {
  items: ProductCardDTO[];
  total: number;
};

/** apps/web/lib/queries/products.ts:151-167 (getFilterMeta result) */
export type FilterMetaDTO = {
  rooms: Room[];
  categories: Category[];
};

/**
 * Full currency row — apps/web/lib/queries/products.ts:24
 * (`typeof currencies.$inferSelect`, apps/web/lib/db/schema.ts:50-57);
 * also returned by apps/web/lib/actions/cart.ts:351-354 (getActiveCurrencies).
 */
export type CurrencyDTO = {
  code: string;
  symbol: string;
  label: string;
  rateToBase: string;
  isBase: boolean;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Bootstrap / checkout context — apps/web/app/checkout/page.tsx
// ---------------------------------------------------------------------------

/** apps/web/app/checkout/page.tsx:38-49 (zone rates mapping) */
export type ShippingRateDTO = {
  minSubtotalCents: number;
  feeCents: number;
  etaDays: string;
};

/** apps/web/app/checkout/page.tsx:38-49 (zones mapping) */
export type ShippingZoneDTO = {
  id: string;
  name: string;
  rates: ShippingRateDTO[];
};

/** apps/web/app/checkout/page.tsx:51-57 (boxedCurrencies mapping) */
export type CheckoutCurrencyDTO = {
  code: string;
  symbol: string;
  label: string;
  rateToBase: string;
  isBase: boolean;
};

/** apps/web/lib/payments.ts:11 (getPaymentMethodsSafe row) */
export type PaymentMethodDTO = {
  code: string;
  label: string;
  enabled: boolean;
};

/** apps/web/lib/contact.ts CONTACT + apps/web/lib/admin-emails.ts supportEmailAsync. */
export type MobileContactDTO = {
  email: string;
  phone: string;
  phoneHref: string;
  whatsappUrl: string;
  whatsapp: string;
  address: string;
  hours: string;
};

/** GET /api/mobile/v1/bootstrap — one round-trip for app cold start. */
export type MobileBootstrapDTO = {
  currencies: CurrencyDTO[];
  checkout: CheckoutContextDTO;
  contact: MobileContactDTO;
};

/** GET /api/mobile/v1/me — apps/web/lib/auth-session.ts SessionProfile["user"]. */
export type MobileProfileDTO = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

/** apps/web/app/checkout/page.tsx:119-136 (CheckoutForm payload). */
export type CheckoutContextDTO = {
  zones: ShippingZoneDTO[];
  currencies: CheckoutCurrencyDTO[];
  /** apps/web/app/checkout/page.tsx:74-75,124 (isBase row, else first active). */
  defaultCurrencyCode: string;
  /** apps/web/app/checkout/page.tsx:134 passes every row; filter by `enabled`. */
  paymentMethods: PaymentMethodDTO[];
  /** apps/web/app/checkout/page.tsx:135 (lib/paystack.ts paystackPublicKey). */
  paystackPublicKey: string;
};

// ---------------------------------------------------------------------------
// Checkout — apps/web/lib/actions/checkout.ts
// ---------------------------------------------------------------------------

/** apps/web/lib/actions/checkout.ts:51-57 */
export type CheckoutPriceSnapshot = {
  subtotalBaseCents: number;
  shippingBaseCents: number;
  totalBaseCents: number;
  currencyCode: string;
  rateToBase: string;
};

/** apps/web/lib/actions/checkout.ts:59-65 */
export type PriceChangedFailure = {
  ok: false;
  code: "PRICE_CHANGED";
  message: string;
  old: CheckoutPriceSnapshot;
  new: CheckoutPriceSnapshot;
};

/** apps/web/lib/actions/checkout.ts:68 (createOrder) / 682-686 (verify) */
export type OrderCreatedDTO = {
  orderId: string;
  number: string;
  idempotent?: boolean;
};

/** apps/web/lib/actions/checkout.ts:67-69 */
export type CreateOrderResult = ApiResult<OrderCreatedDTO> | PriceChangedFailure;

/** apps/web/lib/actions/checkout.ts:446-456 (initPaystackOrder data payload) */
export type PaystackInitDTO = {
  orderId: string;
  number: string;
  reference: string;
  /** Integer kobo to charge (base cents 1:1 while base is NGN). */
  kobo: number;
  email: string;
  publicKey: string;
  paid?: boolean;
  idempotent?: boolean;
};

/** apps/web/lib/actions/checkout.ts:445-457 */
export type InitPaystackResult = ApiResult<PaystackInitDTO> | PriceChangedFailure;

/** apps/web/lib/actions/checkout.ts:682-686 */
export type VerifyPaystackResult = ApiResult<OrderCreatedDTO>;

// ---------------------------------------------------------------------------
// Orders — apps/web/lib/actions/orders.ts
// ---------------------------------------------------------------------------

/** apps/web/lib/db/schema.ts:184-196 (orders.address jsonb) */
export type OrderAddressDTO = {
  name: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  street: string;
  postal: string;
  zoneId: string;
  notes?: string;
};

/** apps/web/lib/db/schema.ts:202-206 (orders.paystack_auth jsonb) */
export type PaystackAuthDTO = {
  last4?: string;
  brand?: string;
  channel?: string;
};

/**
 * Full order row — apps/web/lib/actions/orders.ts:68
 * (`typeof orders.$inferSelect`, apps/web/lib/db/schema.ts:167-210).
 * `paidAt` and `createdAt` are Dates in the web action; ISO strings here.
 */
export type OrderRowDTO = {
  id: string;
  number: string;
  userId: string;
  email: string;
  status: string;
  currencyCode: string;
  fxRateSnapshot: string;
  subtotalBaseCents: number;
  shippingBaseCents: number;
  totalBaseCents: number;
  address: OrderAddressDTO;
  clientToken: string;
  paymentMethod: string;
  paymentStatus: string;
  paystackRef: string | null;
  paidAt: string | null;
  paystackAuth: PaystackAuthDTO | null;
  createdAt: string;
};

/** apps/web/lib/actions/orders.ts:17-29 (createdAt is a Date there). */
export type MyOrderDTO = {
  id: string;
  number: string;
  status: string;
  currencyCode: string;
  currencySymbol: string;
  fxRateSnapshot: string;
  subtotalBaseCents: number;
  shippingBaseCents: number;
  totalBaseCents: number;
  itemCount: number;
  /** ISO string on the wire (Date in the web action result). */
  createdAt: string;
};

/** apps/web/lib/actions/orders.ts:69-76 */
export type OrderDetailItemDTO = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  qty: number;
  unitBaseCents: number;
};

/** apps/web/lib/actions/orders.ts:67-79 */
export type OrderDetailDTO = {
  order: OrderRowDTO;
  items: OrderDetailItemDTO[];
  zoneName: string | null;
  currency: CurrencyDTO;
};

/** apps/web/lib/actions/orders.ts:156-158 (cancelOrder result) */
export type OrderCancelledDTO = { id: string };
