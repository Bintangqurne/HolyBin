// lib/generateCode.ts

/**
 * Generates a unique pickup code in format: TRH-XXXX-XXXX
 * Easy to read and type for officers in the field
 */
export function generateUniqueCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars: I, O, 0, 1
  let part = "";

  for (let i = 0; i < 4; i++) {
    part += chars[Math.floor(Math.random() * chars.length)];
  }

  return `TRH-${part}`;
}

/**
 * Check if a code has expired (default: 24 hours)
 */
export function isCodeExpired(expiresAt: Date | string): boolean {
  const expiry = new Date(expiresAt);
  return new Date() > expiry;
}

/**
 * Get expiry date (hours from now)
 */
export function getExpiryDate(hoursFromNow: number = 24): Date {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date;
}

/**
 * Format code for display
 */
export function formatCode(code: string): string {
  return code.toUpperCase().replace(/\s/g, "");
}
