import { config } from "./config.js";
import { prisma } from "@app/db";

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
}

export async function getGhlClientForLocation(locationId?: string | null) {
  if (!locationId) return new GhlClient();
  const location = await prisma.ghlLocation.findFirst({ where: { locationId } });
  return new GhlClient(location?.apiKey ?? undefined);
}
