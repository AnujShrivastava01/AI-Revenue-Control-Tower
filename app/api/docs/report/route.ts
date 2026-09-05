import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-static";

/** Serves the compiled technical report straight from docs/, so the landing page can link to it without duplicating the file into public/. */
export async function GET() {
  const filePath = path.join(process.cwd(), "docs", "report.pdf");
  const file = await readFile(filePath);

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="Financial-Control-Tower-Report.pdf"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
