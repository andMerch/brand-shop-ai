import { PricingConfigInput } from "@app/shared";

export type PricingContext = {
  baseCost: number;
  decorationLocations?: number;
};

export type PricingRule = {
  target: "GLOBAL" | "CATEGORY" | "PRODUCT" | "VARIANT" | "SIZE" | "COLOR";
  targetValue?: string | null;
  deltaType: "FIXED" | "PERCENT";
  deltaValue: number;
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

type RuleMatchContext = {
  productId?: string | null;
  category?: string | null;
  variantId?: string | null;
  size?: string | null;
  color?: string | null;
};

function normalizeValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function pickMostSpecificRule(
  rules: PricingRule[],
  deltaType: PricingRule["deltaType"],
  ctx: RuleMatchContext
) {
  const orderedTargets: PricingRule["target"][] = [
    "VARIANT",
    "PRODUCT",
    "CATEGORY",
    "GLOBAL"
  ];

  for (const target of orderedTargets) {
    const match = rules.find((rule) => {
      if (rule.deltaType !== deltaType) return false;
      if (rule.target !== target) return false;
      if (target === "GLOBAL") return true;
      const ruleValue = normalizeValue(rule.targetValue ?? "");
      if (target === "VARIANT") return ruleValue && ruleValue === normalizeValue(ctx.variantId);
      if (target === "PRODUCT") return ruleValue && ruleValue === normalizeValue(ctx.productId);
      if (target === "CATEGORY") return ruleValue && ruleValue === normalizeValue(ctx.category);
      return false;
    });
    if (match) return match;
  }

  return null;
}

function pickRuleForAttribute(
  rules: PricingRule[],
  deltaType: PricingRule["deltaType"],
  target: "SIZE" | "COLOR",
  value?: string | null
) {
  const normalizedValue = normalizeValue(value);
  if (!normalizedValue) return null;
  return (
    rules.find(
      (rule) =>
        rule.deltaType === deltaType &&
        rule.target === target &&
        normalizeValue(rule.targetValue ?? "") === normalizedValue
    ) ?? null
  );
}

export function applyPricingRules({
  baseCost,
  decorationBase,
  decorationTotal,
  config,
  rules,
  context,
  defaultPercent,
  percentBaseOverride
}: {
  baseCost: number;
  decorationBase: number;
  decorationTotal: number;
  config: PricingConfigInput;
  rules: PricingRule[];
  context: RuleMatchContext;
  defaultPercent: number;
  percentBaseOverride?: number;
}) {
  const basePercentRule = pickMostSpecificRule(rules, "PERCENT", context);
  const sizePercentRule = pickRuleForAttribute(rules, "PERCENT", "SIZE", context.size);
  const colorPercentRule = pickRuleForAttribute(rules, "PERCENT", "COLOR", context.color);
  const percentTotal =
    (basePercentRule?.deltaValue ?? defaultPercent ?? 0) +
    (sizePercentRule?.deltaValue ?? 0) +
    (colorPercentRule?.deltaValue ?? 0);

  const baseFixedRule = pickMostSpecificRule(rules, "FIXED", context);
  const sizeFixedRule = pickRuleForAttribute(rules, "FIXED", "SIZE", context.size);
  const colorFixedRule = pickRuleForAttribute(rules, "FIXED", "COLOR", context.color);
  const fixedTotal =
    (baseFixedRule?.deltaValue ?? 0) +
    (sizeFixedRule?.deltaValue ?? 0) +
    (colorFixedRule?.deltaValue ?? 0);

  const percentBase =
    percentBaseOverride ??
    (config.decoration.applyPercentMarkup
      ? baseCost + decorationBase
      : baseCost);
  const percentAmount = (percentBase * percentTotal) / 100;

  return {
    percentTotal,
    fixedTotal,
    percentAmount
  };
}
