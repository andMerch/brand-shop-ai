import { config } from "./config.js";
import { prisma } from "./db.js";

export class GhlClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey?: string) {
    this.baseUrl = config.ghlBaseUrl;
    this.apiKey = apiKey ?? config.ghlApiKey;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    } as const;
  }

  async request<T>(path: string, init?: RequestInit): Promise<T> {
    if (!this.apiKey) {
      throw new Error("Missing GHL API key");
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        ...(init?.headers ?? {})
      }
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GHL request failed ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
  }

  async postConversationNote(conversationId: string, body: string) {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        type: "note",
        body
      })
    });
  }

  async updateCustomField(contactId: string, fields: Record<string, string>) {
    return this.request(`/contacts/${contactId}`, {
      method: "PUT",
      body: JSON.stringify({
        customFields: Object.entries(fields).map(([id, value]) => ({ id, value }))
      })
    });
  }

  async triggerReviewRequest(locationId: string, contactId: string, channel: "sms" | "email") {
    return this.request(`/reputation/requests`, {
      method: "POST",
      body: JSON.stringify({
        locationId,
        contactId,
        channel
      })
    });
  }
}

export async function getGhlClientForLocation(locationId?: string | null) {
  if (!locationId) {
    return new GhlClient();
  }
  const location = await prisma.ghlLocation.findFirst({ where: { locationId } });
  return new GhlClient(location?.apiKey ?? undefined);
}
