export function normalizeCustomerTaxId(value: string): string {
  return value.trim().toUpperCase().replace(/[\s.-]/g, "");
}

export function isValidCustomerTaxId(value: string): boolean {
  const taxId = normalizeCustomerTaxId(value);
  if (!taxId) return true;
  if (/^\d{8}[A-Z]$/.test(taxId)) return "TRWAGMYFPDXBNJZSQVHLCKE"[Number(taxId.slice(0, 8)) % 23] === taxId[8];
  if (/^[XYZ]\d{7}[A-Z]$/.test(taxId)) {
    const number = Number(`${{ X: "0", Y: "1", Z: "2" }[taxId[0] as "X" | "Y" | "Z"]}${taxId.slice(1, 8)}`);
    return "TRWAGMYFPDXBNJZSQVHLCKE"[number % 23] === taxId[8];
  }
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(taxId)) return false;
  const digits = taxId.slice(1, 8).split("").map(Number);
  const sum = digits.reduce((total, digit, index) => total + (index % 2 === 0 ? Math.floor((digit * 2) / 10) + (digit * 2) % 10 : digit), 0);
  const control = (10 - (sum % 10)) % 10;
  const expected = "JABCDEFGHI"[control];
  return taxId[8] === String(control) || taxId[8] === expected;
}
