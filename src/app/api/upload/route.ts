import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const ALLOWED_FOLDERS = new Set(["blog", "games", "uploads", "seo"]);

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png":  ".png",
  "image/webp": ".webp",
  "image/gif":  ".gif",
};

const VIDEO_MIME_TO_EXT: Record<string, string> = {
  "video/mp4":       ".mp4",
  "video/webm":      ".webm",
  "video/quicktime": ".mov",
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Uploads disabled in production. Place images in /public locally and commit." },
      { status: 403 },
    );
  }

  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const folderRaw = form.get("folder");
  const folder = typeof folderRaw === "string" ? folderRaw : "uploads";

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  if (!ALLOWED_FOLDERS.has(folder)) {
    return NextResponse.json({ error: `folder must be one of ${[...ALLOWED_FOLDERS].join(", ")}` }, { status: 400 });
  }

  const mime = file.type;
  const isImage = mime in IMAGE_MIME_TO_EXT;
  const isVideo = mime in VIDEO_MIME_TO_EXT;

  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mime || "unknown"}. Allowed: jpg, png, webp, gif, mp4, webm, mov.` },
      { status: 400 },
    );
  }

  const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    const mb = Math.round(cap / (1024 * 1024));
    return NextResponse.json({ error: `File exceeds ${mb} MB limit.` }, { status: 400 });
  }

  const ext = isImage ? IMAGE_MIME_TO_EXT[mime] : VIDEO_MIME_TO_EXT[mime];
  const filename = `${randomUUID()}${ext}`;

  const publicDir = path.join(process.cwd(), "public");
  const dir = path.join(publicDir, folder);
  const filePath = path.join(dir, filename);

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(publicDir) + path.sep)) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, buffer);

  return NextResponse.json({ path: `/${folder}/${filename}` });
}
