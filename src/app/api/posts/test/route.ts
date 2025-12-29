import IPaginateResponse from "@/interfaces/IPaginateResponse";
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
import IPost, { toIPost, toUpdatePostMakeOpinion } from "@/interfaces/IPost";

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

  const opinions = await prisma.mod180_posts.findMany({
    where: whereQuery,
    ...paginationMeta.query,
    orderBy: {
      post_date_gmt: "desc",
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

  return Response.json(
    toSafeJSON<IPaginateResponse<IPost>>({
      ...paginationMeta.meta,
      items: parsedPosts,
    }),
  );

  // return Response.json(toSafeJSON(opinions));
}
