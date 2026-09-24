// Stripe Connect fee maths shared by Config > Cobros online and
// Plataforma > Stripe Connect. Mirrors backend connectFee.applicationFeeCents.
// Coordination id: stripe_connect_fees_v1

export type FeeParts = { stripe_base_percent: number; stripe_base_fixed_cents: number };

const pct = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 });
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export const formatPercent = (v: number) => `${pct.format(v)} %`;
export const formatEuros = (cents: number) => eur.format(cents / 100);

/** "11,25 % + 0,25 €" — Stripe base + platform commission. */
export const formatTotalFee = (base: FeeParts, platformPercent: number) =>
  `${formatPercent(base.stripe_base_percent + platformPercent)} + ${formatEuros(base.stripe_base_fixed_cents)}`;

/** Cents kept from a charge of `amountCents` (never the whole amount). */
export const feeCents = (base: FeeParts, platformPercent: number, amountCents: number) => {
  const fee = Math.round((amountCents * (base.stripe_base_percent + platformPercent)) / 100) + base.stripe_base_fixed_cents;
  return Math.max(0, Math.min(fee, amountCents - 1));
};
