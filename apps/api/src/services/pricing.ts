import { PricingConfigInput } from "@app/shared";

export type PricingContext = {
  baseCost: number;
  decorationLocations?: number;
};

export const defaultDirectMarkupTiers = [
  { min: 5.01, max: 9.99, percent: 85 },
  { min: 10, max: 29.99, percent: 60 },
  { min: 30, percent: 50 }
];

export function buildDefaultPricing(model: PricingConfigInput["model"] = "DISTRIBUTOR") {
  return {
    model,
    decoration: {
      baseFee: 7.5,
      markupFixed: 8.5,
      applyPercentMarkup: false
    },
    distributorMarkupPercent: 40,
    directMarkupTiers: defaultDirectMarkupTiers,
    checkoutFees: {
      shipping: 7,
      taxRate: 0.07,
      ccRate: 0.03,
      platformFee: model === "DISTRIBUTOR" ? 4.94 : 3,
      fulfillmentFeeDecorator: model === "DISTRIBUTOR" ? 3 : undefined,
      fulfillmentFeePlatform: model === "DISTRIBUTOR" ? 0.5 : undefined,
      transactionFeeRate: model === "DISTRIBUTOR" ? 0.03 : undefined,
      orderFee: model === "DISTRIBUTOR" ? 0.79 : undefined
    }
  } satisfies PricingConfigInput;
}

export function resolveMarkupPercent(config: PricingConfigInput, baseCost: number) {
  if (config.model === "DISTRIBUTOR") {
    return config.distributorMarkupPercent ?? 0;
  }
  const tier = config.directMarkupTiers?.find((entry) => {
    const max = entry.max ?? Number.POSITIVE_INFINITY;
    return baseCost >= entry.min && baseCost <= max;
  });
  return tier?.percent ?? 0;
}

export function calculateItemPrice(config: PricingConfigInput, ctx: PricingContext) {
  const locations = Math.max(ctx.decorationLocations ?? 1, 0);
  const baseCost = Math.max(ctx.baseCost ?? 0, 0);
  const decorationBase = config.decoration.baseFee * locations;
  const decorationMarkup = config.decoration.markupFixed * locations;
  const decorationTotal = decorationBase + decorationMarkup;

  const markupPercent = resolveMarkupPercent(config, baseCost);
  const markupBase = config.decoration.applyPercentMarkup
    ? baseCost + decorationBase
    : baseCost;
  const baseMarkup = (markupBase * markupPercent) / 100;

  return {
    baseCost,
    decorationBase,
    decorationMarkup,
    decorationTotal,
    markupPercent,
    baseMarkup,
    price: baseCost + baseMarkup + decorationTotal
  };
}
