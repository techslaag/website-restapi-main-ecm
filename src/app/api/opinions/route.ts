import IPaginateResponse from "@/interfaces/IPaginateResponse";
import IPost, { toIPost, toUpdatePostMakeOpinion } from "@/interfaces/IPost";
import IPostPersonnality from "@/interfaces/IPostPersonnality";
import {
  parsePostPersonnality,
  parseUpdateAvatarPostPersonnality,
} from "@/lib/DataParsers";
import {
  getPaginationMetaData,
  getPostFeaturedImage,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { extractQueryParams, toSafeJSON } from "@/lib/utils/index";
import { PHP } from "@/lib/utils/utilsJS";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const queryParams = extractQueryParams(req);

  const page = Number(queryParams.page ?? 1),
    limit = Number(queryParams.limit ?? 25);

  // filter to be used for both pagination meta and the data list
  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "post",
    post_status: "publish",
    meta: {
      some: {
        meta_key: "post_type",
        meta_value: "opinion",
      },
    },
  };

  const paginationMeta = await getPaginationMetaData(
    "mod180_posts",
    page,
    limit,
    whereQuery,
  );

  // Get all opinion posts with position sorted at database level
  const opinionsRaw = await prisma.$queryRaw<{ID: number}[]>`
    SELECT DISTINCT p.ID
    FROM mod180_posts p
    INNER JOIN mod180_postmeta pm_type ON p.ID = pm_type.post_id 
      AND pm_type.meta_key = 'post_type' 
      AND pm_type.meta_value = 'opinion'
    LEFT JOIN mod180_postmeta pm_pos ON p.ID = pm_pos.post_id 
      AND pm_pos.meta_key = 'position'
    WHERE p.post_type = 'post' 
      AND p.post_status = 'publish'
    ORDER BY COALESCE(CAST(pm_pos.meta_value AS SIGNED), 0) DESC, p.post_date_gmt DESC
    LIMIT ${limit} OFFSET ${(page - 1) * limit}
  `;

  const opinionIds = opinionsRaw.map(row => row.ID);
  
  if (opinionIds.length === 0) {
    return Response.json({
      ...paginationMeta.meta,
      items: [],
    });
  }

  const opinions = await prisma.mod180_posts.findMany({
    where: {
      ID: { in: opinionIds },
    },
    select: {
      ID: true,
      post_name: true,
      post_status: true,
      post_excerpt: true,
      post_title: true,
      post_date: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
      termRelationships: {
        select: {
          taxonomy: {
            select: {
              taxonomy: true,
              count: true,
              description: true,
              term: {
                select: {
                  term_id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      },
      children: {
        select: {
          ID: true,
          guid: true,
          post_type: true,
          post_excerpt: true,
          post_mime_type: true,
          post_title: true,
          post_date: true,
          meta: {
            select: {
              meta_key: true,
              meta_value: true,
            },
          },
        },
      },
      author: {
        select: {
          ID: true,
          display_name: true,
          user_nicename: true,
        },
      },
    },
  });

  if (opinions == null) {
    return Response.json([]);
  }

  const formattedResponse = toSafeJSON(opinions);
  const parsedOpinions = await Promise.all(
    formattedResponse.map(async (opinion: any) => {
      // let updatedOpinion;
      //
      // //Add co-author
      // const isCowrited = opinion.meta?.find(
      //   (meta: any) => meta.meta_key === "cowriter",
      // );
      //
      // if (isCowrited) {
      //   const cowriter = await prisma.mod180_users.findUnique({
      //     where: {
      //       ID: Number(isCowrited.meta_value),
      //     },
      //   });
      //
      //   if (cowriter) {
      //     updatedOpinion = toSafeJSON(opinion);
      //
      //     updatedOpinion["authors"] = [
      //       opinion.author,
      //       {
      //         ID: cowriter.ID,
      //         display_name: cowriter.display_name,
      //         user_nicename: cowriter.user_nicename,
      //       },
      //     ];
      //   }
      // }

      //Add Personalities
      const isPersonality = opinion.meta?.find(
        (meta: any) => meta.meta_key === "personnality",
      );

      let personalitiesResult: IPostPersonnality[] = [];
      if (isPersonality) {
        const personalityIDs = PHP.parse(isPersonality.meta_value);
        const personalities = await Promise.all(
          personalityIDs.map(
            async (id: number) =>
              await prisma.mod180_posts.findUnique({
                where: {
                  ID: Number(id),
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
              }),
          ),
        );
        const formattedPersonalities = toSafeJSON(personalities);
        const parsedPersonnalities = await Promise.all(
          formattedPersonalities.map(async (personnality: any) => {
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

        personalitiesResult = toSafeJSON(parsedPersonnalities);
      }

      // const opinionWithCoauthor = toIPost(toSafeJSON(updatedOpinion));
      // return toUpdatePostMakeOpinion(opinionWithCoauthor, personalitiesResult);

      return toUpdatePostMakeOpinion(toIPost(opinion), personalitiesResult);
    }),
  );

  let parsedPosts = await Promise.all(
    parsedOpinions.map(async (post) => {
      //check if media and insert if not
      let parsedPost = post;
      if (post.featuredMediaId) {
        parsedPost = await getPostFeaturedImage(post);
      }
      return parsedPost;
    }),
  );

  // Maintain the order from the database query
  const idOrder = new Map(opinionIds.map((id, index) => [id.toString(), index]));
  parsedPosts.sort((a, b) => {
    const orderA = idOrder.get(a.id) ?? 999;
    const orderB = idOrder.get(b.id) ?? 999;
    return orderA - orderB;
  });

  return Response.json(
    toSafeJSON<IPaginateResponse<IPost>>({
      ...paginationMeta.meta,
      items: parsedPosts,
    }),
  );
}
