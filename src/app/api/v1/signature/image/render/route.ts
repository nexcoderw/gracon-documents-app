/**
 * Same-origin renderer for presigned signature-image URLs.
 *
 * Signature images are private S3 objects exposed through short-lived presigned
 * URLs. The editor needs to load them through canvas to remove light
 * backgrounds, but browsers block canvas reads when S3 does not return CORS
 * headers for the documents origin. This route keeps the fetch server-side,
 * validates that only signature-image objects are fetched, and returns the
 * image bytes from the documents origin.
 */
import { NextRequest, NextResponse } from "next/server";

const SIGNATURE_IMAGE_PATH_PREFIX = "/signature-images/";
const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;

function isAllowedS3SignatureImageUrl(value: string) {
  try {
    const url = new URL(value);
    const isHttps = url.protocol === "https:";
    const isS3Host =
      url.hostname.endsWith(".amazonaws.com") ||
      url.hostname.endsWith(".amazonaws.com.cn");
    const isSignatureImage = url.pathname.includes(SIGNATURE_IMAGE_PATH_PREFIX);
    const isPresigned = url.searchParams.has("X-Amz-Signature");

    return isHttps && isS3Host && isSignatureImage && isPresigned;
  } catch {
    return false;
  }
}

/**
 * Fetches an allowed presigned signature image and returns it from this origin.
 */
export async function GET(request: NextRequest) {
  const sourceUrl = request.nextUrl.searchParams.get("url");

  if (!sourceUrl || !isAllowedS3SignatureImageUrl(sourceUrl)) {
    return NextResponse.json(
      { message: "Invalid signature image source." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(sourceUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "Signature image is unavailable." },
        { status: response.status },
      );
    }

    const contentType =
      response.headers.get("content-type") ?? "application/octet-stream";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { message: "Signature image source did not return an image." },
        { status: 415 },
      );
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_SIGNATURE_IMAGE_BYTES) {
      return NextResponse.json(
        { message: "Signature image is too large." },
        { status: 413 },
      );
    }

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_SIGNATURE_IMAGE_BYTES) {
      return NextResponse.json(
        { message: "Signature image is too large." },
        { status: 413 },
      );
    }

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Unable to load signature image." },
      { status: 502 },
    );
  }
}
