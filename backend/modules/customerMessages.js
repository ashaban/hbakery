// Messages the customer app shows the user verbatim.
//
// These have to be translated server-side rather than in the app,
// because several of them are only decidable here — "Only 20 of Bingo is
// still unscheduled" depends on data the app doesn't have. The app sends
// its chosen language in Accept-Language; anything other than Kiswahili
// falls back to English.
//
// Only customer-facing routes (/customerAuth, /shop, /geo) use this.
// Staff routes stay English, which is what the admin system is in.

const MESSAGES = {
  // ── Registration / profile ─────────────────────────────────────────
  nameRequired: {
    en: "Name is required",
    sw: "Jina linahitajika",
  },
  passwordTooShort: {
    en: "Password must be at least 4 characters",
    sw: "Nenosiri liwe na herufi 4 au zaidi",
  },
  invalidPhone: {
    en: "Enter a valid Tanzanian phone number",
    sw: "Weka namba sahihi ya simu ya Tanzania",
  },
  regionDistrictRequired: {
    en: "Region and district are required",
    sw: "Mkoa na wilaya vinahitajika",
  },
  townRequired: {
    en: "Town or street is required",
    sw: "Mji au mtaa unahitajika",
  },
  landmarkRequired: {
    en: "Tell us a nearby landmark so the driver can find you",
    sw: "Tuambie alama ya karibu ili dereva akupate",
  },
  districtNotInRegion: {
    en: "That district is not in that region",
    sw: "Wilaya hiyo haipo katika mkoa huo",
  },
  accountExists: {
    en: "An account already exists for this phone number. Please sign in.",
    sw: "Tayari kuna akaunti kwa namba hii ya simu. Tafadhali ingia.",
  },
  registrationFailed: {
    en: "Registration failed",
    sw: "Kujisajili kumeshindikana",
  },

  // ── Sign in ────────────────────────────────────────────────────────
  phoneAndPasswordRequired: {
    en: "Phone number and password are required",
    sw: "Namba ya simu na nenosiri vinahitajika",
  },
  invalidCredentials: {
    en: "Invalid phone number or password",
    sw: "Namba ya simu au nenosiri si sahihi",
  },
  accountDeactivated: {
    en: "This account has been deactivated. Please contact us.",
    sw: "Akaunti hii imezimwa. Tafadhali wasiliana nasi.",
  },
  loginFailed: {
    en: "Login failed",
    sw: "Kuingia kumeshindikana",
  },
  accountNotFound: {
    en: "Account not found",
    sw: "Akaunti haijapatikana",
  },
  profileLoadFailed: {
    en: "Failed to load profile",
    sw: "Imeshindwa kupakia wasifu",
  },
  profileUpdateFailed: {
    en: "Failed to update profile",
    sw: "Imeshindwa kusasisha wasifu",
  },
  passwordsRequired: {
    en: "Current and new password are required",
    sw: "Nenosiri la sasa na jipya vinahitajika",
  },
  currentPasswordWrong: {
    en: "Current password is incorrect",
    sw: "Nenosiri la sasa si sahihi",
  },
  passwordChangeFailed: {
    en: "Failed to change password",
    sw: "Imeshindwa kubadilisha nenosiri",
  },

  // ── Shop / orders ──────────────────────────────────────────────────
  productsLoadFailed: {
    en: "Failed to load products",
    sw: "Imeshindwa kupakia bidhaa",
  },
  ordersLoadFailed: {
    en: "Failed to load orders",
    sw: "Imeshindwa kupakia oda",
  },
  orderLoadFailed: {
    en: "Failed to load order",
    sw: "Imeshindwa kupakia oda",
  },
  orderNotFound: {
    en: "Order not found",
    sw: "Oda haijapatikana",
  },
  orderEmpty: {
    en: "Your order is empty",
    sw: "Oda yako haina bidhaa",
  },
  lineNeedsProductAndQuantity: {
    en: "Every line needs a product and a quantity",
    sw: "Kila kipengele kinahitaji bidhaa na kiasi",
  },
  productUnavailable: {
    en: "One of the products is no longer available",
    sw: "Mojawapo ya bidhaa haipatikani tena",
  },
  orderPlaceFailed: {
    en: "Failed to place order",
    sw: "Imeshindwa kuweka oda",
  },
  orderAlreadyCancelled: {
    en: "This order is already cancelled",
    sw: "Oda hii tayari imeghairiwa",
  },
  orderAlreadyScheduled: {
    en: "This order already has a delivery scheduled. Please call us to change it.",
    sw: "Oda hii tayari imepangiwa siku ya kufikishwa. Tafadhali tupigie simu kuibadilisha.",
  },
  orderCancelFailed: {
    en: "Failed to cancel order",
    sw: "Imeshindwa kughairi oda",
  },

  // ── Geography ──────────────────────────────────────────────────────
  regionsLoadFailed: {
    en: "Failed to fetch regions",
    sw: "Imeshindwa kupata mikoa",
  },
  districtsLoadFailed: {
    en: "Failed to fetch districts",
    sw: "Imeshindwa kupata wilaya",
  },
};

const SUPPORTED = ["sw", "en"];
const DEFAULT_LANGUAGE = "sw";

/**
 * Reads the caller's language from Accept-Language. The app sends a bare
 * "sw" or "en"; a browser sends a full list, so take the first supported
 * tag it mentions.
 */
function resolveLanguage (req) {
  const header = req.headers["accept-language"];
  if (!header) return DEFAULT_LANGUAGE;

  const tags = String(header)
    .split(",")
    .map(part => part.split(";")[0].trim().toLowerCase().slice(0, 2));

  return tags.find(tag => SUPPORTED.includes(tag)) || DEFAULT_LANGUAGE;
}

/**
 * t(req, "landmarkRequired") -> the message in the caller's language.
 * An unknown key returns the key itself rather than throwing: a missing
 * translation should never turn a 400 into a 500.
 */
function t (req, key) {
  const entry = MESSAGES[key];
  if (!entry) return key;
  return entry[resolveLanguage(req)] || entry.en;
}

module.exports = { t, resolveLanguage, MESSAGES, SUPPORTED, DEFAULT_LANGUAGE };
