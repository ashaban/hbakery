import { createI18n } from 'vue-i18n'

// Fallback messages if backend fails
const fallbackMessages = {}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: {}, // Will be loaded dynamically
  silentTranslationWarn: true,
})

// Cache for loaded locales
const loadedLocales = new Set(['en'])

export async function loadLocaleMessages (locale) {
  // if (loadedLocales.has(locale)) {
  //   return i18n.global.getLocaleMessage(locale)
  // }

  try {
    // Try to fetch from backend using Fetch API
    const response = await fetch(`/locales/${locale}`)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    i18n.global.setLocaleMessage(locale, data)
    loadedLocales.add(locale)
    return data
  } catch (error) {
    console.error(`Failed to load ${locale} translations:`, error)

    if (fallbackMessages[locale]) {
      i18n.global.setLocaleMessage(locale, fallbackMessages[locale])
      loadedLocales.add(locale)
      return fallbackMessages[locale]
    }

    i18n.global.setLocaleMessage(locale, fallbackMessages.en)
    return fallbackMessages.en
  }
}

export async function setI18nLanguage (locale) {
  await loadLocaleMessages(locale)
  i18n.global.locale.value = locale
  document.querySelector('html').setAttribute('lang', locale)
  return locale
}

export default i18n
