// Session state. Deliberately a plain reactive object rather than Vuex —
// this app has one user, one token and one profile, and a store would be
// ceremony around three fields.
//
// The token is kept in Capacitor Preferences (which maps to Android's
// SharedPreferences) rather than localStorage: the WebView's local
// storage can be cleared by the system when it reclaims space, which
// would silently sign the customer out.

import { reactive } from "vue";
import { Preferences } from "@capacitor/preferences";
import { api, setToken } from "./api";

const TOKEN_KEY = "hanein.customer.token";

export const session = reactive({
  token: "",
  customer: null,
  ready: false,
});

export const isSignedIn = () => Boolean(session.token && session.customer);

async function persistToken (token) {
  if (token) {
    await Preferences.set({ key: TOKEN_KEY, value: token });
  } else {
    await Preferences.remove({ key: TOKEN_KEY });
  }
}

function applySession (token, customer) {
  session.token = token;
  session.customer = customer;
  setToken(token);
}

let restorePromise = null;

/**
 * Await the one-time session restore, starting it if it hasn't begun.
 *
 * The router guard calls this before every navigation so no screen can
 * fire an API request before the stored token is loaded. Without it, a
 * cold start races: the first screen requests data with no token, gets
 * a 401, and the app signs the customer out of a perfectly good session.
 */
export function ensureSessionRestored () {
  if (!restorePromise) restorePromise = restoreSession();
  return restorePromise;
}

/**
 * Restores a stored token and confirms it is still valid — an expired
 * token must not leave the app showing a signed-in shell it can't load
 * any data into. Use ensureSessionRestored() rather than calling this
 * directly, so it only ever runs once.
 */
export async function restoreSession () {
  try {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (value) {
      setToken(value);
      const data = await api("/customerAuth/me");
      applySession(value, data.customer);
    }
  } catch {
    // Expired, revoked, or offline at startup: treat as signed out
    // rather than blocking the app behind a spinner.
    applySession("", null);
    await persistToken("");
  } finally {
    session.ready = true;
  }
}

export async function register (payload) {
  const data = await api("/customerAuth/register", {
    method: "POST",
    body: payload,
  });
  applySession(data.token, data.customer);
  await persistToken(data.token);
  return data.customer;
}

export async function login (phone, password) {
  const data = await api("/customerAuth/login", {
    method: "POST",
    body: { phone, password },
  });
  applySession(data.token, data.customer);
  await persistToken(data.token);
  return data.customer;
}

export async function updateProfile (payload) {
  const data = await api("/customerAuth/me", { method: "PUT", body: payload });
  session.customer = data.customer;
  return data.customer;
}

export async function changePassword (currentPassword, newPassword) {
  return api("/customerAuth/password", {
    method: "PUT",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

export async function signOut () {
  applySession("", null);
  await persistToken("");
}
