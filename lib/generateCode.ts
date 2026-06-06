// lib/generateCode.ts
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // exclude confusing chars: I, O, 0, 1

function randomSegment(length: number): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return s;
}

/** Permanent bin location identifier, e.g. "B-7K2A" */
export function generateBinCode(): string {
  return `B-${randomSegment(4)}`;
}

/** Personal officer QR code, e.g. "U-9M3X" */
export function generateUserCode(): string {
  return `U-${randomSegment(4)}`;
}

/** Format code for display */
export function formatCode(code: string): string {
  return code.toUpperCase().replace(/\s/g, "");
}
