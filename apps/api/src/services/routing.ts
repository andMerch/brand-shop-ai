import { prisma } from "../lib/db.js";

export type RouteInput = {
  tenantId: string;
  orderId?: string;
  order?: {
    storeId?: string;
    productType?: string;
    supplierId?: string;
    decorationMethod?: string;
  };
};

export async function routeOrder(input: RouteInput) {
  const orderRecord = input.orderId
    ? await prisma.order.findFirst({ where: { id: input.orderId, tenantId: input.tenantId } })
    : null;

  const context = {
    productType: input.order?.productType,
    supplierId: input.order?.supplierId,
    decorationMethod: input.order?.decorationMethod
  };

  const rules = await prisma.routingRule.findMany({
    where: { tenantId: input.tenantId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
  });

  let bestRule: (typeof rules)[number] | null = null;
  let bestScore = -1;

  for (const rule of rules) {
    if (rule.productType && rule.productType !== context.productType) continue;
    if (rule.supplierId && rule.supplierId !== context.supplierId) continue;
    if (rule.decorationMethod && rule.decorationMethod !== context.decorationMethod) continue;

    let score = 0;
    if (rule.productType) score += 1;
    if (rule.supplierId) score += 1;
    if (rule.decorationMethod) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestRule = rule;
    }
  }

  if (!bestRule) {
    return {
      matched: false,
      ruleId: null,
      decoratorId: null
    };
  }

  if (orderRecord) {
    await prisma.routingDecision.upsert({
      where: { orderId: orderRecord.id },
      update: {
        ruleId: bestRule.id,
        decoratorId: bestRule.decoratorId,
        status: "APPLIED"
      },
      create: {
        orderId: orderRecord.id,
        ruleId: bestRule.id,
        decoratorId: bestRule.decoratorId,
        status: "APPLIED"
      }
    });

    await prisma.order.update({
      where: { id: orderRecord.id },
      data: { status: "ROUTED" }
    });
  }

  return {
    matched: true,
    ruleId: bestRule.id,
    decoratorId: bestRule.decoratorId
  };
}
