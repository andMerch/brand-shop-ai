import { config } from "./config.js";

export type ExtractedOrder = {
  customerName?: string;
  email?: string;
  dueDate?: string;
  currency?: string;
  total?: number;
  items?: Array<{ name?: string; quantity?: number; unitPrice?: number }>;
};

function buildExtractPrompt() {
  return `You are an AI order extraction agent. Extract order data and return ONLY valid JSON with this schema:
{
  "customerName": string | null,
  "email": string | null,
  "dueDate": string | null,
  "currency": string | null,
  "total": number | null,
  "items": [ { "name": string | null, "quantity": number | null, "unitPrice": number | null } ]
}
If a field is unknown, return null. Use numbers (not strings) for totals, quantities, and unitPrice.`;
}

function extractTextFromResponse(data: any): string {
  if (typeof data?.output_text === "string") {
    return data.output_text;
  }
  const output = data?.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (content?.type === "output_text" && typeof content.text === "string") {
          chunks.push(content.text);
        }
        if (content?.type === "text" && typeof content.text === "string") {
          chunks.push(content.text);
        }
      }
    }
  }
  return chunks.join("\n");
}

function safeJsonParse(text: string): ExtractedOrder | null {
  try {
    return JSON.parse(text) as ExtractedOrder;
  } catch {
    return null;
  }
}

async function uploadFileToOpenAI({
  buffer,
  filename,
  contentType,
  purpose
}: {
  buffer: Buffer;
  filename: string;
  contentType: string;
  purpose: "user_data";
}) {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: contentType });
  form.append("file", blob, filename);
  form.append("purpose", purpose);

  const res = await fetch("https://api.openai.com/v1/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`
    },
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI file upload failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function extractOrderFromFile({
  buffer,
  filename,
  contentType
}: {
  buffer: Buffer;
  filename: string;
  contentType: string;
}) {
  if (!config.openaiApiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const fileId = await uploadFileToOpenAI({
    buffer,
    filename,
    contentType,
    purpose: "user_data"
  });

  const inputContent = [
    { type: "input_text", text: buildExtractPrompt() },
    contentType.includes("pdf")
      ? { type: "input_file", file_id: fileId }
      : { type: "input_image", file_id: fileId }
  ];

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel,
      input: [
        {
          role: "user",
          content: inputContent
        }
      ]
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI response failed: ${res.status} ${text}`);
  }

  const json = await res.json();
  const outputText = extractTextFromResponse(json);
  const parsed = safeJsonParse(outputText);

  return parsed ?? null;
}
