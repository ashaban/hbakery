// Phone number is a customer's login identity, so "0712 345 678",
// "+255712345678" and "255712345678" have to resolve to the same account
// — otherwise someone registers one way, types it the other way a week
// later, and is told their account doesn't exist.
//
// Everything is normalised to +255XXXXXXXXX before it touches the
// database, which is also what makes the partial unique index on
// customer(phone) meaningful.

/**
 * Normalise a Tanzanian mobile number to +255XXXXXXXXX.
 * Returns null if it can't be read as one.
 */
function normalizePhone(input) {
  if (typeof input !== "string") return null;

  // Strip everything that isn't a digit or a leading +
  const cleaned = input.trim().replace(/[\s\-().]/g, "");
  const digits = cleaned.replace(/^\+/, "");

  if (!/^\d+$/.test(digits)) return null;

  let national;
  if (digits.startsWith("255")) {
    national = digits.slice(3);
  } else if (digits.startsWith("0")) {
    national = digits.slice(1);
  } else {
    national = digits;
  }

  // Tanzanian mobile numbers are 9 digits after the country code and
  // start with 6 or 7 (6xx/7xx across all networks).
  if (!/^[67]\d{8}$/.test(national)) return null;

  return `+255${national}`;
}

module.exports = { normalizePhone };
