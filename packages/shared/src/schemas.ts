import { z } from "zod";

export const StoreBuilderTriggerSchema = z.object({
  tenantId: z.string().min(1).optional(),
  locationId: z.string().min(1),
  storeName: z.string().min(1),
  clientName: z.string().optional(),
  brandVertical: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  pricingModel: z.enum(["DISTRIBUTOR", "DIRECT"]).optional()
});

export const AiVisionIngestSchema = z.object({
  tenantId: z.string().min(1).optional(),
  locationId: z.string().min(1),
  source: z.enum(["upload", "ghl"]),
  sourceRef: z.string().optional()
});

export const RoutingRuleSchema = z.object({
  tenantId: z.string().min(1),
  priority: z.number().int().min(0).default(0),
  productType: z.string().optional(),
  supplierId: z.string().optional(),
  decorationMethod: z.string().optional(),
  decoratorId: z.string().optional()
});

export const RouteOrderSchema = z.object({
  tenantId: z.string().min(1),
  orderId: z.string().optional(),
  order: z
    .object({
      storeId: z.string().optional(),
      productType: z.string().optional(),
      supplierId: z.string().optional(),
      decorationMethod: z.string().optional()
    })
    .optional()
});

export const ReputationRequestSchema = z.object({
  tenantId: z.string().min(1),
  locationId: z.string().min(1),
  contactId: z.string().min(1),
  channel: z.enum(["sms", "email"]).default("sms")
});

export const PricingModelSchema = z.enum(["DISTRIBUTOR", "DIRECT"]);

export const PricingConfigSchema = z.object({
  model: PricingModelSchema,
  decoration: z.object({
    baseFee: z.number().min(0),
    markupFixed: z.number().min(0),
    applyPercentMarkup: z.boolean().default(false)
  }),
  distributorMarkupPercent: z.number().min(0).default(40),
  directMarkupTiers: z
    .array(
      z.object({
        min: z.number().min(0),
        max: z.number().optional(),
        percent: z.number().min(0)
      })
    )
    .default([
      { min: 5.01, max: 9.99, percent: 85 },
      { min: 10, max: 29.99, percent: 60 },
      { min: 30, percent: 50 }
    ]),
  checkoutFees: z.object({
    shipping: z.number().min(0).default(7),
    taxRate: z.number().min(0).default(0.07),
    ccRate: z.number().min(0).default(0.03),
    platformFee: z.number().min(0).default(4.94),
    platformFeeRate: z.number().min(0).optional(),
    fulfillmentFeeDecorator: z.number().min(0).optional(),
    fulfillmentFeePlatform: z.number().min(0).optional(),
    transactionFeeRate: z.number().min(0).optional(),
    orderFee: z.number().min(0).optional()
  })
});

export const StorefrontDomainSchema = z.object({
  storeId: z.string().min(1),
  domain: z.string().min(3),
  type: z.enum(["SUBDOMAIN", "CUSTOM"]).default("CUSTOM"),
  isPrimary: z.boolean().optional()
});

export const StorefrontCheckoutSchema = z.object({
  storeId: z.string().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        variantId: z.string().optional(),
        quantity: z.number().int().min(1)
      })
    )
    .min(1),
  decorationLocations: z.number().int().min(1).optional()
});

export const PricingRuleSchema = z.object({
  tenantId: z.string().optional(),
  target: z.enum(["GLOBAL", "CATEGORY", "PRODUCT", "VARIANT", "SIZE", "COLOR"]),
  targetValue: z.string().optional(),
  deltaType: z.enum(["FIXED", "PERCENT"]),
  deltaValue: z.number()
});

export const PricingRuleBatchSchema = z.object({
  tenantId: z.string().optional(),
  rules: z.array(PricingRuleSchema).min(1)
});

export const PricingConfigUpsertSchema = z.object({
  scope: z.enum(["GLOBAL", "TENANT", "STORE"]),
  scopeId: z.string().optional(),
  config: PricingConfigSchema
});

export const SupplierAccountSchema = z.object({
  tenantId: z.string().min(1),
  supplier: z.enum(["SSACTIVEWEAR", "SANMAR"]),
  credentials: z.record(z.any()),
  baseUrl: z.string().optional(),
  active: z.boolean().optional()
});

export const CatalogSyncSchema = z.object({
  tenantId: z.string().min(1),
  storeId: z.string().optional(),
  source: z.enum(["ssactivewear", "printful", "sanmar"]),
  limit: z.number().int().min(1).max(500).optional(),
  supplierAccountId: z.string().optional()
});

export const DashboardSummarySchema = z.object({
  revenue: z.number(),
  orders: z.number(),
  aov: z.number(),
  activeStores: z.number(),
  aiSupportConversations: z.number(),
  routingAccuracy: z.number(),
  reputationScore: z.number()
});

export type StoreBuilderTriggerInput = z.infer<typeof StoreBuilderTriggerSchema>;
export type AiVisionIngestInput = z.infer<typeof AiVisionIngestSchema>;
export type RoutingRuleInput = z.infer<typeof RoutingRuleSchema>;
export type RouteOrderInput = z.infer<typeof RouteOrderSchema>;
export type ReputationRequestInput = z.infer<typeof ReputationRequestSchema>;
export type PricingConfigInput = z.infer<typeof PricingConfigSchema>;
export type StorefrontDomainInput = z.infer<typeof StorefrontDomainSchema>;
export type StorefrontCheckoutInput = z.infer<typeof StorefrontCheckoutSchema>;
export type PricingRuleInput = z.infer<typeof PricingRuleSchema>;
export type PricingRuleBatchInput = z.infer<typeof PricingRuleBatchSchema>;
export type PricingConfigUpsertInput = z.infer<typeof PricingConfigUpsertSchema>;
export type SupplierAccountInput = z.infer<typeof SupplierAccountSchema>;
export type CatalogSyncInput = z.infer<typeof CatalogSyncSchema>;
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
