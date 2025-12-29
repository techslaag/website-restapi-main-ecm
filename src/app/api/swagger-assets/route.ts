import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const swaggerUiPath = require("swagger-ui-dist").absolutePath();

export async function GET(req: NextRequest) {
  const fileName = req.nextUrl.searchParams.get("file");
  if (!fileName) {
    return NextResponse.json({ error: "File not specified" }, { status: 400 });
  }

  const filePath = path.join(swaggerUiPath, fileName);

  try {
    const fileContents = await readFile(filePath);
    const contentType = fileName.endsWith(".css")
      ? "text/css"
      : fileName.endsWith(".js")
      ? "application/javascript"
      : "text/plain";

    return new NextResponse(fileContents, {
      headers: { "Content-Type": contentType },
    });
  } catch (error) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
