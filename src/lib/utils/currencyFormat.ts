export function formatAmountCurrency(
  amount: number,
  currency: string,
  userLocale?: string,
) {
  return new Intl.NumberFormat(userLocale ?? "fr", {
    style: "currency",
    currency: currency.toUpperCase(),
  })
    .format(amount)
    .replaceAll(/\s/g, " ");
}
