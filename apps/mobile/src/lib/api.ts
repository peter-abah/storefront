import type {
  ApiResult,
  CartDTO,
  CartLineInput,
  CartMergeResultDTO,
  CartMutationResultDTO,
  CartRemoveResultDTO,
  CheckoutInput,
  CheckoutPriceSnapshot,
  FilterMetaDTO,
  GuestCartProductDTO,
  MobileBootstrapDTO,
  MobileProfileDTO,
  MyOrderDTO,
  OrderCancelledDTO,
  OrderCreatedDTO,
  OrderDetailDTO,
  PaginatedProductsDTO,
  PaystackInitDTO,
  PaystackVerifyInput,
  ProductDetailDTO,
  ProductSort,
  RelatedProductDTO,
} from "@maison/shared";
import { authClient } from "./auth-client";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  /**
   * Failure extras preserved from the wire `{ok:false,...}` body — notably
   * PRICE_CHANGED's `old`/`new` snapshots, which must never be dropped.
   */
  readonly details: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** PRICE_CHANGED failures carry the shopper-old and server-new snapshots. */
export function isPriceChangedError(
  error: unknown,
): error is ApiError & {
  details: { old: CheckoutPriceSnapshot; new: CheckoutPriceSnapshot };
} {
  if (!(error instanceof ApiError) || error.code !== "PRICE_CHANGED") {
    return false;
  }
  const { old, new: next } = error.details as {
    old?: CheckoutPriceSnapshot;
    new?: CheckoutPriceSnapshot;
  };
  return (
    typeof old === "object" &&
    old !== null &&
    typeof next === "object" &&
    next !== null
  );
}

export type ApiFetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

function apiBaseUrl(): string {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? "").trim();
  if (!raw) {
    throw new ApiError(
      "CONFIG",
      "The shop API is not configured. Set EXPO_PUBLIC_API_URL and restart the app.",
      0,
    );
  }
  return `${raw.replace(/\/+$/, "")}/api/mobile/v1`;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, auth = false, headers, ...init } = options;

  const baseUrl = apiBaseUrl();

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

  if (auth) {
    // An empty or unreadable cookie store must not crash the request: it
    // simply goes out unauthenticated and the API answers UNAUTHENTICATED,
    // which surfaces as an ApiError distinct from NETWORK_ERROR.
    try {
      const cookie = await authClient.getCookie();
      if (cookie) requestHeaders.set("Cookie", cookie);
    } catch {
      // fall through without a Cookie header
    }
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: requestHeaders,
      credentials: "omit",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      `Could not reach the Maison API (${apiHost()}). Check your connection and try again.`,
      0,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(
      "INVALID_RESPONSE",
      `The API returned an unexpected response (HTTP ${response.status}).`,
      response.status,
    );
  }

  if (!isApiResult(payload)) {
    throw new ApiError(
      "INVALID_RESPONSE",
      `The API returned an unexpected response (HTTP ${response.status}).`,
      response.status,
    );
  }

  if (payload.ok) return payload.data as T;

  const { ok: _ok, code, message, ...details } = payload as ApiResult<never> & {
    [key: string]: unknown;
  };
  void _ok;
  if (typeof code !== "string" || typeof message !== "string") {
    throw new ApiError(
      "INVALID_RESPONSE",
      `The API returned an unexpected response (HTTP ${response.status}).`,
      response.status,
    );
  }
  throw new ApiError(code, message, response.status, details);
}

function isApiResult(value: unknown): value is ApiResult<unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok?: unknown }).ok === "boolean"
  );
}

export function apiHost(): string {
  try {
    return new URL(process.env.EXPO_PUBLIC_API_URL ?? "").host;
  } catch {
    return "unknown host";
  }
}

export function bootstrap(): Promise<MobileBootstrapDTO> {
  return apiFetch<MobileBootstrapDTO>("/bootstrap");
}

export function me(): Promise<MobileProfileDTO> {
  return apiFetch<MobileProfileDTO>("/me", { auth: true });
}

/**
 * Query names mirror `productListQuerySchema` (the wire contract): `q`,
 * `minPriceCents`/`maxPriceCents` in base cents, and no `perPage` (the
 * endpoint fixes the page size at listProducts' default of 24).
 */
export type ProductListQuery = {
  q?: string;
  room?: string;
  category?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
};

export function listProducts(
  query: ProductListQuery = {},
): Promise<PaginatedProductsDTO> {
  const params = new URLSearchParams();
  const q = query.q?.trim();
  if (q) params.set("q", q);
  if (query.room) params.set("room", query.room);
  if (query.category) params.set("category", query.category);
  if (query.minPriceCents !== undefined) {
    params.set("minPriceCents", String(Math.floor(query.minPriceCents)));
  }
  if (query.maxPriceCents !== undefined) {
    params.set("maxPriceCents", String(Math.floor(query.maxPriceCents)));
  }
  if (query.inStock) params.set("inStock", "true");
  if (query.sort) params.set("sort", query.sort);
  if (query.page !== undefined) params.set("page", String(query.page));

  const search = params.toString();
  return apiFetch<PaginatedProductsDTO>(`/products${search ? `?${search}` : ""}`);
}

export type ProductDetailResponse = {
  product: ProductDetailDTO;
  related: RelatedProductDTO[];
};

export function getProduct(slug: string): Promise<ProductDetailResponse> {
  return apiFetch<ProductDetailResponse>(
    `/products/${encodeURIComponent(slug)}`,
  );
}

export function getFilters(): Promise<FilterMetaDTO> {
  return apiFetch<FilterMetaDTO>("/filters");
}

/** GET /cart — authenticated cart with live stock clamps. */
export function getCart(): Promise<CartDTO> {
  return apiFetch<CartDTO>("/cart", { auth: true });
}

/** POST /cart/items — add one line (qty 1–99, server clamps to stock). */
export function addCartItem(
  input: CartLineInput,
): Promise<CartMutationResultDTO> {
  return apiFetch<CartMutationResultDTO>("/cart/items", {
    method: "POST",
    body: input,
    auth: true,
  });
}

/** PATCH /cart/items/[productId] — set qty (1–99). */
export function updateCartItem(
  productId: string,
  qty: number,
): Promise<CartMutationResultDTO> {
  return apiFetch<CartMutationResultDTO>(
    `/cart/items/${encodeURIComponent(productId)}`,
    { method: "PATCH", body: { qty }, auth: true },
  );
}

/** DELETE /cart/items/[productId] — remove one line. */
export function removeCartItem(
  productId: string,
): Promise<CartRemoveResultDTO> {
  return apiFetch<CartRemoveResultDTO>(
    `/cart/items/${encodeURIComponent(productId)}`,
    { method: "DELETE", auth: true },
  );
}

/** POST /cart/merge — sum guest lines into the DB cart (wire body `{lines}`). */
export function mergeCart(
  lines: CartLineInput[],
): Promise<CartMergeResultDTO> {
  return apiFetch<CartMergeResultDTO>("/cart/merge", {
    method: "POST",
    body: { lines },
    auth: true,
  });
}

/**
 * POST /cart/products — public (no auth) live snapshots for guest-cart
 * display. Max 50 ids per call; callers chunk larger guest carts.
 */
export function getCartProducts(
  ids: string[],
): Promise<GuestCartProductDTO[]> {
  return apiFetch<GuestCartProductDTO[]>("/cart/products", {
    method: "POST",
    body: { ids },
  });
}

/**
 * POST /checkout/cod — place a cash-on-delivery order. The server re-prices
 * from the DB; `expected*` is only the reviewed snapshot. A PRICE_CHANGED
 * failure arrives as an ApiError (409) whose `details` carry old/new —
 * read them with `isPriceChangedError`.
 */
export function createCodOrder(input: CheckoutInput): Promise<OrderCreatedDTO> {
  return apiFetch<OrderCreatedDTO>("/checkout/cod", {
    method: "POST",
    body: input,
    auth: true,
  });
}

/** POST /checkout/paystack/init — create awaiting-payment order + charge data. */
export function initPaystackOrder(
  input: CheckoutInput,
): Promise<PaystackInitDTO> {
  return apiFetch<PaystackInitDTO>("/checkout/paystack/init", {
    method: "POST",
    body: input,
    auth: true,
  });
}

/** POST /checkout/paystack/verify — confirm gateway money (idempotent). */
export function verifyPaystackOrder(
  input: PaystackVerifyInput,
): Promise<OrderCreatedDTO> {
  return apiFetch<OrderCreatedDTO>("/checkout/paystack/verify", {
    method: "POST",
    body: input,
    auth: true,
  });
}

/** GET /orders — authenticated order history, newest first. */
export function getOrders(): Promise<MyOrderDTO[]> {
  return apiFetch<MyOrderDTO[]>("/orders", { auth: true });
}

/** GET /orders/[id] — owner-only detail (404 for missing/foreign ids). */
export function getOrderDetail(id: string): Promise<OrderDetailDTO> {
  return apiFetch<OrderDetailDTO>(`/orders/${encodeURIComponent(id)}`, {
    auth: true,
  });
}

/** POST /orders/[id]/cancel — buyer cancel inside the 12h window. */
export function cancelOrder(id: string): Promise<OrderCancelledDTO> {
  return apiFetch<OrderCancelledDTO>(
    `/orders/${encodeURIComponent(id)}/cancel`,
    { method: "POST", auth: true },
  );
}
