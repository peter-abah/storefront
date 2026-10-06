import type {
  ApiResult,
  FilterMetaDTO,
  MobileBootstrapDTO,
  MobileProfileDTO,
  PaginatedProductsDTO,
  ProductDetailDTO,
  ProductSort,
  RelatedProductDTO,
} from "@maison/shared";
import { authClient } from "./auth-client";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
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
    const cookie = await authClient.getCookie();
    if (cookie) requestHeaders.set("Cookie", cookie);
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

  throw new ApiError(payload.code, payload.message, response.status);
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
