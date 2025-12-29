import {
  parsePackageFw,
  parseUpdateCover,
  parseUpdateCovernFileProduct,
} from "@/lib/DataParsers";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { PDFDocument } from "pdf-lib";
import { PACKAGE_PUBLIC_SELECT_INPUT } from "@/interfaces/IPackageFw";

export async function generateStaticParams() {
  const posts = await prisma.mod180_posts.findMany({
    where: {
      post_type: "financeweek-package",
      post_status: "publish",
    },
    select: {
      ID: true,
    },
  });

  return posts.map((post) => ({
    id: post.ID.toString(),
  }));
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const queryParams = extractQueryParams(req);
  const id = params.id.toString();

  if (queryParams.page) {
    if (!Number(queryParams.page)) {
      return Response.json(
        {
          error: "Invalid page number",
        },
        {
          status: 400,
        },
      );
    }
  }

  try {
    id.toString();
  } catch (e) {
    return Response.json(
      {
        error: "Invalid id",
      },
      {
        status: 400,
      },
    );
  }

  const packageFw = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(id),
    },
    select: PACKAGE_PUBLIC_SELECT_INPUT,
  });

  const formattedResponse = parsePackageFw(packageFw);

  return Response.json(toSafeJSON(formattedResponse));
}
