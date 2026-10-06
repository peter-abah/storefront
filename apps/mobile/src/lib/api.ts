import type {
  ApiResult,
  MobileBootstrapDTO,
  MobileProfileDTO,
} from "@maison/shared";
import { authClient } from "./auth-client";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL ?? ""}/api/mobile/v1`;

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

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, auth = false, headers, ...init } = options;

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");

  if (auth) {
    const cookie = await authClient.getCookie();
    if (cookie) requestHeaders.set("Cookie", cookie);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
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
