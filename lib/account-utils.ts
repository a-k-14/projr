/**
 * Formats an account's name and optionally its number for display.
 * Example: "HDFC Bank - 1234"
 */
export function formatAccountDisplayName(name: string, accountNumber?: string, full = false): string {
  if (!accountNumber) return name;

  const numberStr = String(accountNumber).trim();
  if (!numberStr) return name;

  if (full) {
    return `${name} - ${numberStr}`;
  }

  // Get last 4 digits
  const last4 = numberStr.slice(-4);
  return `${name} - ${last4}`;
}
