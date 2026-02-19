import { promises as fs } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import { getSupabaseClient } from "./supabase.js";

const baseDir = "/tmp/brand-shop-ai";

export async function storeFile({
  filename,
  data,
  contentType
}: {
  filename: string;
  data: Buffer;
  contentType?: string;
}) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectKey = `${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${safeName}`;
    const { error } = await supabase.storage
      .from(config.supabase.bucket)
      .upload(objectKey, data, {
        contentType,
        upsert: false
      });
    if (error) {
      throw error;
    }

    const { data: publicData } = supabase.storage.from(config.supabase.bucket).getPublicUrl(objectKey);
    return {
      url: publicData.publicUrl,
      path: objectKey
    };
  }

  await fs.mkdir(baseDir, { recursive: true });
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "-");
  const filePath = join(baseDir, `${randomUUID()}-${safeName}`);
  await fs.writeFile(filePath, data);
  return {
    url: `file://${filePath}`,
    path: filePath
  };
}
