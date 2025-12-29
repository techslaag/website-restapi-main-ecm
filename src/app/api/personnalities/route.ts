import {
  parsePostPersonnality,
  parseUpdateAvatarPostPersonnality,
} from "@/lib/DataParsers";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import IPaginateResponse from "@/interfaces/IPaginateResponse";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import IPostPersonnality from "@/interfaces/IPostPersonnality";

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
    post_type: "personnality",
    post_status: "publish",
  };

  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  const personnalities = await prisma.mod180_posts.findMany({
    where: whereQuery,
    ...paginationMeta.query,
    orderBy: {
      post_date_gmt: "desc",
    },
    select: {
      ID: true,
      post_name: true,
      post_title: true,
      post_date: true,
      post_excerpt: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
    },
  });

  const formattedResponse = toSafeJSON(personnalities);

  const parsedPersonnalities = await Promise.all(
    formattedResponse.map(async (personnality: any) => {
      const parsedPersonnality = parsePostPersonnality(personnality);
      const avatar = await prisma.mod180_posts.findUnique({
        where: {
          ID: Number(parsedPersonnality.avatarId),
          post_type: "attachment",
          post_status: "inherit",
        },
        select: {
          guid: true,
        },
      });
      const formattedAvatar = toSafeJSON(avatar);
      return parseUpdateAvatarPostPersonnality(
        parsedPersonnality,
        formattedAvatar.guid,
      );
    }),
  );

  return Response.json(
    toSafeJSON<IPaginateResponse<IPostPersonnality>>({
      ...paginationMeta.meta,
      items: parsedPersonnalities,
    }),
  );
}
