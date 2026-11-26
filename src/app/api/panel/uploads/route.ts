import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-helpers";
import { requirePanelRole } from "@/lib/auth";
import { saveUploadedImage } from "@/lib/image-storage";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

export async function POST(request: Request) {
  const auth = await requirePanelRole(["ADMIN"]);
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Görsel yükleme verisi okunamadı.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Lütfen yüklenecek bir görsel dosyası seçin.", 400);
  }

  const ext = MIME_TO_EXT[file.type];
  if (!ext) {
    return jsonError(
      "Desteklenmeyen dosya formatı. Yalnızca JPG, PNG, WebP, AVIF veya GIF yükleyebilirsiniz.",
      400,
    );
  }

  if (file.size <= 0) {
    return jsonError("Seçilen dosya boş.", 400);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return jsonError("Görsel boyutu en fazla 5 MB olabilir.", 400);
  }

  const key = `prod-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const buffer = await file.arrayBuffer();

  try {
    await saveUploadedImage(key, buffer, file.type);
  } catch (err) {
    console.error("Image upload error:", err);
    return jsonError("Görsel kaydedilirken bir hata oluştu.", 500);
  }

  return NextResponse.json(
    {
      url: `/api/uploads/${key}`,
      key,
    },
    { status: 201 },
  );
}
