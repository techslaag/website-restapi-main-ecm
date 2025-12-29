import IPaginateResponse from "@/interfaces/IPaginateResponse";
import prisma from "@/lib/prisma";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import IPackage, {
  PACKAGE_PUBLIC_SELECT_INPUT,
  toIPackage,
} from "@/interfaces/IPackageFw";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const queryParams = extractQueryParams(req);

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

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "financeweek-package",
    post_status: "publish",
  };

  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  const packageFws = await prisma.mod180_posts.findMany({
    where: whereQuery,
    ...paginationMeta.query,
    orderBy: {
      post_date_gmt: "desc",
    },
    select: PACKAGE_PUBLIC_SELECT_INPUT,
  });

  const parsedPackageFws = await Promise.all(
    packageFws.map(async (packageFw) => await toIPackage(packageFw)),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<IPackage>>({
      ...paginationMeta.meta,
      items: parsedPackageFws,
    }),
  );
}
