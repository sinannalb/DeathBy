import fs from "node:fs/promises";
import path from "node:path";
import { getStore } from "@netlify/blobs";

const STORE_NAME = "product-images";
const SAFE_KEY_REGEX = /^[a-zA-Z0-9._-]+$/;

export function isValidImageKey(key: string): boolean {
  return SAFE_KEY_REGEX.test(key) && !key.includes("..");
}

function getLocalUploadsDir(): string {
  return path.join(process.cwd(), ".uploads");
}

function isMissingBlobsEnvError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "MissingBlobsEnvironmentError" ||
      err.message.includes("MissingBlobsEnvironmentError"))
  );
}

export async function saveUploadedImage(
  key: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<void> {
  if (!isValidImageKey(key)) {
    throw new Error("Geçersiz dosya anahtarı.");
  }

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    await store.set(key, data, {
      metadata: { contentType },
    });
  } catch (err) {
    if (!isMissingBlobsEnvError(err)) {
      throw err;
    }
    const dir = getLocalUploadsDir();
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), Buffer.from(data));
    await fs.writeFile(
      path.join(dir, `${key}.meta.json`),
      JSON.stringify({ contentType }),
      "utf8",
    );
  }
}

export async function readUploadedImage(
  key: string,
): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  if (!isValidImageKey(key)) {
    return null;
  }

  try {
    const store = getStore({ name: STORE_NAME, consistency: "strong" });
    const entry = await store.getWithMetadata(key, {
      consistency: "strong",
      type: "arrayBuffer",
    });
    if (entry === null) {
      return null;
    }
    const rawMeta = entry.metadata as { contentType?: unknown } | null;
    const contentType =
      rawMeta && typeof rawMeta.contentType === "string"
        ? rawMeta.contentType
        : "application/octet-stream";
    return {
      data: entry.data,
      contentType,
    };
  } catch (err) {
    if (!isMissingBlobsEnvError(err)) {
      throw err;
    }
    const dir = getLocalUploadsDir();
    try {
      const [buf, metaRaw] = await Promise.all([
        fs.readFile(path.join(dir, key)),
        fs.readFile(path.join(dir, `${key}.meta.json`), "utf8").catch(() => "{}"),
      ]);
      const meta = JSON.parse(metaRaw) as { contentType?: string };
      const arrayBuf = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength,
      );
      return {
        data: arrayBuf,
        contentType: meta.contentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
}
