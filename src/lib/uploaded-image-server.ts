import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { isReadOnlyRuntime } from "./runtime";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

export class UploadedImageError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "UploadedImageError";
  }
}

export async function saveUploadedDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new UploadedImageError("Unsupported data URL");
  const mime = match[1].toLowerCase();
  const ext = MIME_EXT[mime];
  if (!ext) throw new UploadedImageError(`Unsupported mime: ${mime}`);
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.byteLength > 12 * 1024 * 1024) throw new UploadedImageError("Image too large (>12MB)", 413);

  // Vercel's filesystem is ephemeral. Keep the validated asset in the local
  // project state instead so refreshes in the same browser still work.
  if (isReadOnlyRuntime()) return dataUrl;

  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
  const filename = `${hash}.${ext}`;
  const directory = path.join(process.cwd(), "public", "screenshots", "uploaded");
  const file = path.join(directory, filename);
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.access(file);
  } catch {
    await fs.writeFile(file, bytes);
  }
  return `/screenshots/uploaded/${filename}`;
}
