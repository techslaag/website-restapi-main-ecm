import IPostCategory, { toIPostCategory } from "@/interfaces/IPostCategory";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.mod180_term_taxonomyWhereInput = {
    taxonomy: "category",
  };

  const paginationMeta = await getPaginationMetaData(
    "mod180_term_taxonomy",
    page,
    limit,
    whereQuery,
  );

  const categories = await prisma.mod180_term_taxonomy.findMany({
    where: whereQuery,
    ...paginationMeta.query,
    include: {
      term: true,
    },
  });
  // const formattedResponse = JSON.parse(
  //   JSON.stringify(
  //     categories,
  //     (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
  //   ),
  // );

  return Response.json(
    toSafeJSON<IPaginateResponse<IPostCategory>>({
      ...paginationMeta.meta,
      items: categories.map<IPostCategory>(toIPostCategory),
    }),
  );

  // const parsedCategories = await Promise.all(
  //   formattedResponse.map(toIPostCategory),
  // );
  //
  // return Response.json(parsedCategories);
}


/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Retrieve a paginated list of categories
 *     description: Fetches categories with pagination support. The taxonomy is fixed to "category".
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           example: 1
 *         description: The page number to retrieve.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *           example: 10
 *         description: The number of items per page.
 *     responses:
 *       200:
 *         description: A paginated list of categories.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                   example: 100
 *                 totalPages:
 *                   type: integer
 *                   example: 10
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "1"
 *                       name:
 *                         type: string
 *                         example: "Technology"
 *                       description:
 *                         type: string
 *                         example: "Posts related to technology."
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-11-22T10:00:00Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2024-11-22T10:00:00Z"
 *       400:
 *         description: Invalid query parameters.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid page or limit parameters."
 *       500:
 *         description: Server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch categories."
 */
