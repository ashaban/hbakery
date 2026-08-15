// Single place every network call goes through.
//
// In the packaged Android app the WebView serves the bundled files from
// the device itself (https://localhost), so a relative path like
// "/shop/products" would ask the *phone* for the API and get nothing
// back. Requests therefore have to carry an absolute origin. In a
// browser during development the origin stays empty and Vite's proxy
// (see vite.config.mjs) forwards to the local backend.

import { Capacitor } from "@capacitor/core";
import { currentLanguage, t } from "./i18n";

export const isNative = () => Capacitor.isNativePlatform();

export const API_ORIGIN = isNative()
  ? (import.meta.env.VITE_API_URL || "https://hanein.co.tz").replace(/\/$/, "")
  : "";

let authToken = "";

export function setToken (token) {
  authToken = token || "";
}

export function getToken () {
  return authToken;
}

/** Thrown for any non-2xx response, carrying the server's own message. */
export class ApiError extends Error {
  constructor (message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// Set by main.js so a 401 anywhere can drop the user back to the sign-in
// screen, rather than every caller having to handle an expired token.
let onUnauthorized = null;
export function setUnauthorizedHandler (handler) {
  onUnauthorized = handler;
}

export async function api (path, { method = "GET", body = null } = {}) {
  const headers = {};
  if (body) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  // So a server-side message (e.g. "only 20 left") comes back in the
  // same language as the screen showing it.
  headers["Accept-Language"] = currentLanguage();

  let response;
  try {
    response = await fetch(`${API_ORIGIN}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch only rejects on a genuine network failure, which for this
    // app almost always means "no signal", not a broken server.
    throw new ApiError(t("errors.offline"), 0);
  }

  if (response.status === 401 && authToken) {
    setToken("");
    if (onUnauthorized) onUnauthorized();
    throw new ApiError(t("errors.sessionExpired"), 401);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || t("errors.generic"),
      response.status,
    );
  }

  return data;
}
