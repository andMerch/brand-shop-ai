import { z } from "zod";

export const StoreBuilderTriggerSchema = z.object({
  tenantId: z.string().min(1).optional(),
  locationId: z.string().min(1),
  storeName: z.string().min(1),
  clientName: z.string().optional(),
  brandVertical: z.string().optional(),
  metadata: z.record(z.any()).optional()
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
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
