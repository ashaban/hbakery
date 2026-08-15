import { isNative } from "./platform";

/**
 * Where the API lives, from wherever this code happens to be running.
 *
 * On the web — including the installed PWA — the client is served by the
 * same Express process as the API, so a relative '/whatever' is correct
 * and keeps everything same-origin.
 *
 * In the Capacitor build it is not. The web assets are bundled into the
 * APK and served by the WebView from the device itself (origin
 * https://localhost), so a relative '/whatever' asks the *phone* for the
 * API and gets the SPA's own index.html back instead — the
 * "Unexpected token '<'" you get when the JSON parse then fails. The
 * native build needs an absolute URL pointing at the real server.
 */
export const API_ORIGIN = isNative()
  ? (import.meta.env.VITE_API_URL || "https://hanein.co.tz").replace(/\/$/, "")
  : "";

/**
 * Rewrites a same-origin-relative fetch() URL to point at the real API
 * when running natively; passed straight through everywhere else. Only
 * touches root-relative paths ("/whatever") — an already-absolute URL
 * (http://, https://) is left alone.
 */
export function resolveApiUrl(resource) {
  if (!API_ORIGIN || typeof resource !== "string" || !resource.startsWith("/")) {
    return resource;
  }
  return `${API_ORIGIN}${resource}`;
}
