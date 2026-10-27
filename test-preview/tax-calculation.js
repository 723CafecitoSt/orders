/* Tax-exclusive amounts in cents. Round once per rate on the order. */
export const TAX_RATES = Object.freeze({ '825': 825, '725': 725, '0': 0 });

export function calculateTaxes(items) {
  const totals = { '825': 0, '725': 0, '0': 0 };
  let subtotalCents = 0;
  for (const item of items) {
    const rate = String(item.taxBasisPoints);
    if (!Object.hasOwn(TAX_RATES, rate) || !Number.isSafeInteger(item.qty) || item.qty < 1 || !Number.isSafeInteger(item.basePriceCents) || item.basePriceCents < 0) throw new Error('Invalid item or tax rate');
    let unit = item.basePriceCents;
    let taxableUnit = item.basePriceCents;
    for (const modifier of item.modifiers || []) {
      if (!Number.isSafeInteger(modifier.priceCents) || modifier.priceCents < 0 || typeof modifier.taxable !== 'boolean') throw new Error('Invalid modifier');
      unit += modifier.priceCents;
      if (modifier.taxable) taxableUnit += modifier.priceCents;
    }
    subtotalCents += unit * item.qty;
    totals[rate] += taxableUnit * item.qty;
    if (!Number.isSafeInteger(subtotalCents) || !Number.isSafeInteger(totals[rate])) throw new Error('Amount is too large');
  }
  const breakdown = Object.entries(totals).map(([rate, baseCents]) => {
    const product = BigInt(baseCents) * BigInt(TAX_RATES[rate]);
    const tax = (product + 5000n) / 10000n;
    if (tax > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Tax is too large');
    return { taxBasisPoints: TAX_RATES[rate], baseCents, taxCents: Number(tax) };
  });
  const taxCents = breakdown.reduce((sum, entry) => sum + entry.taxCents, 0);
  if (!Number.isSafeInteger(subtotalCents + taxCents)) throw new Error('Total is too large');
  return { subtotalCents, breakdown, taxCents, totalCents: subtotalCents + taxCents };
}
