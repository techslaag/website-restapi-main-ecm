import prisma from "@/lib/prisma";
import { captureException } from "@sentry/nextjs";
import { PDFDocument } from "pdf-lib";
import { serializeError } from "serialize-error";

export async function generateStaticParams() {
  try {
    const products = await prisma.mod180_posts.findMany({
      where: {
        post_type: "brand-product",
        post_status: "publish",
      },
      select: {
        ID: true,
        meta: {
          select: {
            meta_key: true,
            meta_value: true,
          },
        },
      },
    });

    const paramsList: Array<Array<{ id: string; page: string }>> = [];

    for (const product of products) {
      try {
        const pdfFileId = product.meta.find(
          (m) => m.meta_key === "pdf_file",
        )?.meta_value;

        if (!pdfFileId) {
          continue;
        }

        const file = await prisma.mod180_posts.findUnique({
          where: {
            ID: Number(pdfFileId),
            post_type: "attachment",
            post_status: "inherit",
          },
          select: {
            guid: true,
          },
        });

        if (!file) {
          continue;
        }
        console.log("file.guid", file.guid);
        // load the pdf
        const pdfContent = await fetch(file.guid, { cache: "no-cache" }).then(
          async (res) => await res.arrayBuffer(),
        );

        // product meta
        const pdfDoc = await PDFDocument.load(pdfContent);

        paramsList.push(
          new Array(pdfDoc.getPageCount()).map((_, pageIndex) => {
            return {
              id: product.ID.toString(),
              page: `${pageIndex + 1}`,
            };
          }),
        );
      } catch (error) {
        console.log(
          "product page static param",
          product.ID,
          serializeError(error),
        );
        captureException(error);
      }
    }
    console.log("paramsList", paramsList.flat());

    return paramsList.flat();
  } catch (error) {
    console.log("product page static params error: ", serializeError(error));
    captureException(error);
    return [];
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string; page: string } },
) {
  const id = params.id.toString();

  const product = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(id),
    },
    select: {
      ID: true,
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
    },
  });

  if (!product) {
    return Response.json(
      {
        message: "Produit introuvable.",
      },
      {
        status: 404,
      },
    );
  }

  const pdfFileId = product.meta.find(
    (m) => m.meta_key === "pdf_file",
  )?.meta_value;

  if (!pdfFileId) {
    return Response.json(
      {
        message: "Fichier pdf du produit introuvable.",
      },
      {
        status: 404,
      },
    );
  }

  const file = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(pdfFileId),
      post_type: "attachment",
      post_status: "inherit",
    },
    select: {
      guid: true,
    },
  });

  if (!file) {
    return Response.json(
      {
        message: "Fichier pdf du produit introuvable.",
      },
      {
        status: 404,
      },
    );
  }

  // load the pdf
  const pdfContent = await fetch(file?.guid).then(
    async (res) => await res.arrayBuffer(),
  );

  // product meta
  const pdfDoc = await PDFDocument.load(pdfContent);

  // Create a new "sub" document
  const subDocument = await PDFDocument.create();

  // copy the page at current index
  const [copiedPage] = await subDocument.copyPages(pdfDoc, [
    Number(params.page),
  ]);

  // add the page
  subDocument.addPage(copiedPage);

  // file in bytes
  const pdfBytes = await subDocument.save();

  const copyFile = `product-${params.id}-${params.page}.pdf`;

  return new Response(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${copyFile}`,
    },
  });
}
