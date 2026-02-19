import { prisma } from "./db.js";

export async function resolveTenantId({
  tenantId,
  locationId
}: {
  tenantId?: string | null;
  locationId?: string | null;
}) {
  if (tenantId) return tenantId;
  if (!locationId) {
    throw new Error("tenantId_or_locationId_required");
  }
  const location = await prisma.ghlLocation.findFirst({ where: { locationId } });
  if (!location?.tenantId) {
    throw new Error("location_not_linked");
  }
  return location.tenantId;
}
