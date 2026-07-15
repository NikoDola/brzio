import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";

const APK_FILENAME = "app-debug.apk";

export const runtime = "nodejs";

export async function GET() {
  const apkPath = path.join(process.cwd(), "public", APK_FILENAME);

  try {
    const { size } = await stat(apkPath);
    const stream = Readable.toWeb(createReadStream(apkPath)) as ReadableStream<Uint8Array>;

    return new Response(stream, {
      headers: {
        "Content-Type": "application/vnd.android.package-archive",
        "Content-Disposition": `attachment; filename="${APK_FILENAME}"`,
        "Content-Length": size.toString(),
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Response("APK not found", { status: 404 });
    }

    throw error;
  }
}
