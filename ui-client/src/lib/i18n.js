// Kiswahili is the default: the customers this app is for are Tanzanian
// shopkeepers, so English is the fallback, not the starting point. The
// choice is remembered in Preferences so it survives reinstalling the
// WebView's storage, and is sent to the API in Accept-Language so server
// messages ("Tuambie alama ya karibu...") come back in the same language
// as the screen they appear on.

import { createI18n } from "vue-i18n";
import { Preferences } from "@capacitor/preferences";
import en from "@/locales/en.json";
import sw from "@/locales/sw.json";

const LANGUAGE_KEY = "hanein.customer.language";

export const SUPPORTED_LANGUAGES = [
  { code: "sw", label: "Kiswahili" },
  { code: "en", label: "English" },
];

export const DEFAULT_LANGUAGE = "sw";

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: DEFAULT_LANGUAGE,
  fallbackLocale: "en",
  messages: { en, sw },
});

export const t = (key, params) => i18n.global.t(key, params);

export function currentLanguage () {
  return i18n.global.locale.value;
}

/** Read the stored choice at startup. Falls back to Kiswahili. */
export async function restoreLanguage () {
  try {
    const { value } = await Preferences.get({ key: LANGUAGE_KEY });
    if (value && SUPPORTED_LANGUAGES.some(l => l.code === value)) {
      i18n.global.locale.value = value;
    }
  } catch {
    // Storage unavailable — the default is already correct.
  }
}

export async function setLanguage (code) {
  if (!SUPPORTED_LANGUAGES.some(l => l.code === code)) return;
  i18n.global.locale.value = code;
  document.documentElement.setAttribute("lang", code);
  try {
    await Preferences.set({ key: LANGUAGE_KEY, value: code });
  } catch {
    // A failed write only means the choice won't persist a restart.
  }
}
