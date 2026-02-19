import { prisma } from "../lib/db.js";

export async function computeDashboardSummary(tenantId: string) {
  const [ordersAgg, activeStores, convCount, avgRating, routedCount, totalOrders] =
    await Promise.all([
      prisma.order.aggregate({
        where: { tenantId },
        _sum: { total: true },
        _count: { _all: true }
      }),
      prisma.store.count({ where: { tenantId, status: "LIVE" } }),
      prisma.conversation.count({ where: { tenantId } }),
      prisma.reputationReview.aggregate({
        where: { tenantId },
        _avg: { rating: true }
      }),
      prisma.routingDecision.count({ where: { order: { tenantId } } }),
      prisma.order.count({ where: { tenantId } })
    ]);

  const revenue = ordersAgg._sum.total ?? 0;
  const orders = ordersAgg._count._all ?? 0;
  const aov = orders > 0 ? revenue / orders : 0;
  const routingAccuracy = totalOrders > 0 ? routedCount / totalOrders : 0;
  const reputationScore = avgRating._avg.rating ?? 0;

  return {
    revenue,
    orders,
    aov,
    activeStores,
    aiSupportConversations: convCount,
    routingAccuracy,
    reputationScore
  };
}
