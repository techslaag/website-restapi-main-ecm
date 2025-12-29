import { PRODUCT_PUBLIC_SELECT_INPUT } from "@/interfaces/IProduct";
import {
  parseProduct,
  parseUpdateCover,
  parseUpdateCovernFileProduct,
} from "@/lib/DataParsers";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { PDFDocument } from "pdf-lib";

export async function generateStaticParams() {
  const posts = await prisma.mod180_posts.findMany({
    where: {
      post_type: "brand-product",
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

  const product = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(id),
    },
    select: PRODUCT_PUBLIC_SELECT_INPUT,
  });

  const formattedResponse = parseProduct(product);

  const cover = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(formattedResponse.coverId),
      post_type: "attachment",
      post_status: "inherit",
    },
    select: {
      guid: true,
    },
  });

  if (
    formattedResponse.integrationMode === "iframe" ||
    formattedResponse.integrationMode === "link"
  ) {
    let parsedProduct = formattedResponse;

    if (cover) {
      parsedProduct = parseUpdateCover(formattedResponse, cover.guid);
    }

    console.log(
      "Voici enfin le produit completement parsé style Itachi ",
      parsedProduct,
    );

    return Response.json(toSafeJSON(parsedProduct));
  } else {
    const file = await prisma.mod180_posts.findUnique({
      where: {
        ID: Number(formattedResponse.fileContentId),
        post_type: "attachment",
        post_status: "inherit",
      },
      select: {
        guid: true,
      },
    });

    let parsedProduct = formattedResponse;

    if (cover && file) {
      parsedProduct = parseUpdateCovernFileProduct(
        formattedResponse,
        cover.guid,
        file.guid,
      );
    }
    console.log("Voici enfin le produit completement parsé ", parsedProduct);

    const pdfContent = await fetch(parsedProduct.fileContentUrl).then(
      async (res) => await res.arrayBuffer(),
    );

    console.log("Ici aussi ca passe :  ", pdfContent);

    // product meta
    const pdfDoc = await PDFDocument.load(pdfContent);

    Object.assign(parsedProduct, {
      meta: {
        pages: pdfDoc.getPageCount(),
        title: pdfDoc.getTitle(),
      },
    });

    return Response.json(toSafeJSON(parsedProduct));
  }
}
