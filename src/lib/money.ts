const EXPONENTS: Record<string, number> = {
  USD: 2,
};

export function currencyExponent(currency: string): number {
  const exponent = EXPONENTS[currency];
  if (exponent === undefined) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return exponent;
}

function assertMinor(amountMinor: number): void {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Amount must be an integer number of minor units, received ${amountMinor}`);
  }
}

function parseMajorToMinor(value: string, currency: string): number {
  const exponent = currencyExponent(currency);
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid amount: ${value}`);
  }

  const sign = match[1] === "-" ? -1 : 1;
  const wholeText = match[2] ?? "0";
  if (wholeText.length > 12) {
    throw new Error(`Amount is too large: ${value}`);
  }
  const whole = Number(wholeText);
  const fraction = match[3] ?? "";
  const padded = fraction.padEnd(exponent + 1, "0");
  const keep = padded.slice(0, exponent) || "0";
  const roundDigit = padded[exponent] ?? "0";
  const factor = 10 ** exponent;
  let minor = whole * factor + Number(keep);
  if (roundDigit >= "5") minor += 1;
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Amount is too large: ${value}`);
  }
  return sign * minor;
}

/** Decimal major units for Airwallex. 1250 USD → 12.5, never 1250. */
export function toAwxAmount(amountMinor: number, currency: string): number {
  assertMinor(amountMinor);
  const exponent = currencyExponent(currency);
  const sign = amountMinor < 0 ? "-" : "";
  const absolute = Math.abs(amountMinor);
  const factor = 10 ** exponent;
  const whole = Math.trunc(absolute / factor);
  const fraction = absolute % factor;
  const text =
    exponent === 0 ? `${sign}${whole}` : `${sign}${whole}.${String(fraction).padStart(exponent, "0")}`;
  return Number(text);
}

/** Airwallex decimal (number or string) → integer minor units, half up. */
export function fromAwxAmount(value: string | number, currency: string): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid amount: ${value}`);
    }
    const exponent = currencyExponent(currency);
    return parseMajorToMinor(value.toFixed(exponent + 4), currency);
  }
  return parseMajorToMinor(value, currency);
}

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(toAwxAmount(amountMinor, currency));
}
