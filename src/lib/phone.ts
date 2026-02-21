/**
 * Normalize Indonesian phone number to 628xxx format.
 * Handles: "08xxx"→"628xxx", "+628xxx"→"628xxx", "628xxx"→"628xxx"
 * Returns null if input is empty/invalid.
 */
export function normalizePhone(phone: string): string | null {
  if (!phone) return null;
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // Handle Indonesian formats
  if (digits.startsWith("0")) {
    digits = "62" + digits.slice(1);
  } else if (!digits.startsWith("62")) {
    // Not Indonesian format, return as-is
    return digits;
  }
  return digits;
}

/**
 * Convert WAHA phone format to normalized format.
 * "628xxx@c.us" → "628xxx"
 */
export function wahaPhoneToNormalized(wahaId: string): string {
  return wahaId.replace(/@.*$/, "");
}
