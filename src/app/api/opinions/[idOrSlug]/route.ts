import IPost, { toIPost, toUpdatePostMakeOpinion } from "@/interfaces/IPost";
import IPostPersonnality from "@/interfaces/IPostPersonnality";
import {
  parsePostPersonnality,
  parseUpdateAvatarPostPersonnality,
} from "@/lib/DataParsers";
import {
  getPostFeaturedImage,
} from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import {
  excludeProps,
  isNumeric,
  toSafeJSON,
  errorResponse,
} from "@/lib/utils/index";
import { PHP } from "@/lib/utils/utilsJS";
import { Prisma } from "@prisma/client";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params: { idOrSlug } }: { params: { idOrSlug: string } },
) {
  try {
    // filter to find the specific opinion by ID or slug
  const whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "post",
    post_status: "publish",
    meta: {
      some: {
        meta_key: "post_type",
        meta_value: "opinion",
      },
    },
    OR: [
      isNumeric(idOrSlug) ? { ID: BigInt(idOrSlug) } : { post_name: idOrSlug },
    ],
  };

  const opinion = await prisma.mod180_posts.findFirst({
    where: whereQuery,
    orderBy: {
      post_date_gmt: "desc",
    },
    select: {
      ID: true,
      post_name: true,
      post_status: true,
      post_excerpt: true,
      post_content: true,
      post_title: true,
      post_date: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
      archivedAt: true,
      archived: true,
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

  if (!opinion) {
    return Response.json(
      {
        message: "Opinion not found.",
      },
      {
        status: 404,
      },
    );
  }

  /**
   * Delete the content is the user don't have access to it
   */

  const formattedOpinion = toSafeJSON(opinion);
  // //Add co-author
  // let updatedOpinion;
  //
  // const isCowrited = formattedOpinion.meta?.find(
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
  //     updatedOpinion = toSafeJSON(formattedOpinion);
  //
  //     updatedOpinion["authors"] = [
  //       formattedOpinion.author,
  //       {
  //         ID: cowriter.ID,
  //         display_name: cowriter.display_name,
  //         user_nicename: cowriter.user_nicename,
  //       },
  //     ];
  //   }
  // }

  //Add Personalities
  const isPersonality = formattedOpinion.meta?.find(
    (meta: any) => meta.meta_key === "personnality",
  );
  let personalitiesResult: IPostPersonnality[] = [];
  if (isPersonality) {
    try {
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
          if (!personnality) {
            return null;
          }
          try {
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
          } catch (personalityError) {
            console.error('Error processing personality:', personalityError);
            return null;
          }
        }),
      );

      personalitiesResult = toSafeJSON(parsedPersonnalities.filter(p => p !== null));
    } catch (personalityProcessingError) {
      console.error('Error processing personalities:', personalityProcessingError);
      // Continue without personalities if there's an error
      personalitiesResult = [];
    }
  }

  // const opinionWithCoauthor = toIPost(toSafeJSON(updatedOpinion));
  // let parsedOpinion = toUpdatePostMakeOpinion(
  //   opinionWithCoauthor,
  //   personalitiesResult,
  // );

  let parsedOpinion = toUpdatePostMakeOpinion(
    toIPost(opinion),
    personalitiesResult,
  );

  if (parsedOpinion.featuredMediaId) {
    parsedOpinion = await getPostFeaturedImage(parsedOpinion);
  }

  // the given user cannot read the post
  if (
    ["ecomembre", "premium"].includes(parsedOpinion.postPrestige ?? "") ||
    (isNumeric(parsedOpinion.price) && Number(parsedOpinion.price) > 0)
  ) {
    // we delete the post content
    parsedOpinion = excludeProps(parsedOpinion, ["content"]);
  }

  return Response.json(toSafeJSON<IPost>(parsedOpinion));
  
  } catch (error) {
    console.error('Error in opinions API:', error);
    return errorResponse(serializeError(error), { status: 500 });
  }
}
