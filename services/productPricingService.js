function toTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getBasePrice(product) {
  const price = Math.max(0, Math.round(Number(product?.price || 0)));
  const promo = product?.promoPrice === null || product?.promoPrice === undefined
    ? null
    : Math.max(0, Math.round(Number(product.promoPrice)));
  return promo !== null && promo < price ? promo : price;
}

function getProductPriceInfo(product, now = new Date()) {
  const regularPrice = Math.max(0, Math.round(Number(product?.price || 0)));
  const basePrice = getBasePrice(product);
  const flash = product?.flashSale || {};
  const nowTime = new Date(now).getTime();
  const startsAt = toTime(flash.startsAt);
  const endsAt = toTime(flash.endsAt);
  const flashPrice = flash.price === null || flash.price === undefined ? null : Math.max(0, Math.round(Number(flash.price)));
  const configured = Boolean(flash.enabled && flashPrice !== null && startsAt && endsAt && endsAt > startsAt && flashPrice < basePrice);
  const upcoming = configured && nowTime < startsAt;
  const active = configured && nowTime >= startsAt && nowTime < endsAt;
  const expired = configured && nowTime >= endsAt;
  const effectivePrice = active ? flashPrice : basePrice;
  const compareAtPrice = active ? basePrice : (basePrice < regularPrice ? regularPrice : null);
  const discountPercent = compareAtPrice && compareAtPrice > effectivePrice
    ? Math.round(((compareAtPrice - effectivePrice) / compareAtPrice) * 100)
    : 0;

  return {
    regularPrice,
    basePrice,
    effectivePrice,
    compareAtPrice,
    hasPromo: basePrice < regularPrice,
    flashConfigured: configured,
    flashUpcoming: upcoming,
    flashActive: active,
    flashExpired: expired,
    flashStartsAt: startsAt ? new Date(startsAt) : null,
    flashEndsAt: endsAt ? new Date(endsAt) : null,
    discountPercent
  };
}

module.exports = { getBasePrice, getProductPriceInfo };
