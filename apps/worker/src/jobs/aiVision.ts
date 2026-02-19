import { prisma } from "@app/db";
import { applyRouting } from "../services/routing.js";
import { getGhlClientForLocation } from "../lib/ghlClient.js";
import { extractOrderFromFile, ExtractedOrder } from "../lib/openai.js";
import { promises as fs } from "node:fs";

const sampleExtract: ExtractedOrder = {
  customerName: "Lincoln High School",
  email: "orders@lincoln.edu",
  items: [
    {
      name: "Custom T-Shirt",
      quantity: 100,
      unitPrice: 4.5
    }
  ],
  dueDate: "2025-03-15",
  currency: "USD",
  total: 450
};

function validateExtract(extracted: ExtractedOrder) {
  const findings: Array<{ severity: "INFO" | "WARNING" | "ERROR"; field?: string; message: string }> = [];

  for (const item of extracted.items ?? []) {
    const quantity = item.quantity ?? 0;
    if (quantity <= 0) {
      findings.push({ severity: "ERROR", field: "quantity", message: "Quantity must be greater than 0." });
    }
    if (quantity > 500) {
      findings.push({ severity: "WARNING", field: "quantity", message: "Unusually high quantity detected." });
    }
  }

  if (!extracted.email) {
    findings.push({ severity: "WARNING", field: "email", message: "Missing customer email." });
  }

  return findings;
}

export async function processAiVisionJob(data: {
  jobId?: string;
  tenantId: string;
  locationId?: string;
  source: string;
  sourceRef?: string | null;
  inputUrl: string;
}) {
  if (!data.jobId) {
    throw new Error("jobId_required");
  }

  await prisma.aiVisionJob.update({
    where: { id: data.jobId },
    data: { status: "PROCESSING" }
  });

  let extracted: ExtractedOrder | null = null;
  let usedFallback = false;
  try {
    if (data.inputUrl.startsWith("file://")) {
      const filePath = data.inputUrl.replace("file://", "");
      const buffer = await fs.readFile(filePath);
      const filename = filePath.split("/").pop() ?? "document";
      const contentType = filename.endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
      extracted = await extractOrderFromFile({ buffer, filename, contentType });
    } else {
      const res = await fetch(data.inputUrl);
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const contentType = res.headers.get("content-type") ?? "application/octet-stream";
        const filename = data.inputUrl.split("/").pop() ?? "document";
        extracted = await extractOrderFromFile({
          buffer: Buffer.from(arrayBuffer),
          filename,
          contentType
        });
      }
    }
  } catch (error) {
    extracted = null;
  }

  if (!extracted) {
    extracted = sampleExtract;
    usedFallback = true;
  }
  const findings = validateExtract(extracted);

  if (usedFallback) {
    findings.push({
      severity: "WARNING",
      field: "extraction",
      message: "AI Vision fallback used. Please review extracted data."
    });
  }

  if (findings.length > 0) {
    for (const finding of findings) {
      await prisma.aiVisionFinding.create({
        data: {
          jobId: data.jobId,
          severity: finding.severity,
          field: finding.field,
          message: finding.message
        }
      });
    }

    await prisma.aiVisionJob.update({
      where: { id: data.jobId },
      data: {
        status: "NEEDS_REVIEW",
        extracted
      }
    });
  } else {
    await prisma.aiVisionJob.update({
      where: { id: data.jobId },
      data: {
        status: "COMPLETE",
        extracted
      }
    });

    const order = await prisma.order.create({
      data: {
        tenantId: data.tenantId,
        status: "NEW",
        total: extracted.total ?? 0,
        currency: extracted.currency ?? "USD",
        items: {
          create: (extracted.items ?? []).map((item) => ({
            productName: item.name ?? "Unknown Item",
            quantity: item.quantity ?? 1,
            unitPrice: item.unitPrice ?? 0
          }))
        }
      }
    });

    await applyRouting({
      tenantId: data.tenantId,
      orderId: order.id,
      productType: "apparel"
    });
  }

  if (data.sourceRef) {
    try {
      const ghl = await getGhlClientForLocation(data.locationId);
      await ghl.postConversationNote(
        data.sourceRef,
        findings.length > 0
          ? `AI Vision found ${findings.length} issue(s) and needs review.`
          : "AI Vision completed and created an order."
      );
    } catch (error) {
      // Best effort only
      await prisma.aiVisionJob.update({
        where: { id: data.jobId },
        data: { status: findings.length > 0 ? "NEEDS_REVIEW" : "COMPLETE" }
      });
    }
  }
}
