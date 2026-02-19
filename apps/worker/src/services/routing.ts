import { prisma } from "@app/db";

export async function applyRouting({
  tenantId,
  orderId,
  productType,
  supplierId,
  decorationMethod
}: {
  tenantId: string;
  orderId: string;
  productType?: string;
  supplierId?: string;
  decorationMethod?: string;
}) {
  const rules = await prisma.routingRule.findMany({
    where: { tenantId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }]
  });

  let bestRule: (typeof rules)[number] | null = null;
  let bestScore = -1;

  for (const rule of rules) {
    if (rule.productType && rule.productType !== productType) continue;
    if (rule.supplierId && rule.supplierId !== supplierId) continue;
    if (rule.decorationMethod && rule.decorationMethod !== decorationMethod) continue;

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
    return { matched: false, ruleId: null, decoratorId: null };
  }

  await prisma.routingDecision.upsert({
    where: { orderId },
    update: {
      ruleId: bestRule.id,
      decoratorId: bestRule.decoratorId,
      status: "APPLIED"
    },
    create: {
      orderId,
      ruleId: bestRule.id,
      decoratorId: bestRule.decoratorId,
      status: "APPLIED"
    }
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { status: "ROUTED" }
  });

  return { matched: true, ruleId: bestRule.id, decoratorId: bestRule.decoratorId };
}
