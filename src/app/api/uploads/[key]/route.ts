import { NextResponse } from "next/server";
import { isValidImageKey, readUploadedImage } from "@/lib/image-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
) {
  const { key } = await context.params;
  if (!isValidImageKey(key)) {
    return new NextResponse("Geçersiz dosya anahtarı.", { status: 400 });
  }

  const result = await readUploadedImage(key);
  if (!result) {
    return new NextResponse("Görsel bulunamadı.", { status: 404 });
  }

  return new NextResponse(result.data, {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
