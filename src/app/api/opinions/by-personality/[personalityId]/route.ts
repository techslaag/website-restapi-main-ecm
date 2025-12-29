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

export async function GET(
  req: Request,
  { params }: { params: { personalityId: string } }
) {
  try {
    const queryParams = extractQueryParams(req);
    const personalityId = params.personalityId;
    const currentOpinionId = queryParams.excludeId;

    const page = Number(queryParams.page ?? 1);
    const limit = Number(queryParams.limit ?? 5);

    // First, find all posts that have this personality
    const postsWithPersonality = await prisma.mod180_postmeta.findMany({
      where: {
        meta_key: "personnality",
        meta_value: {
          contains: `"${personalityId}"`,
        },
      },
      select: {
        post_id: true,
      },
    });

    const postIds = postsWithPersonality.map((p) => p.post_id);

    // Filter to only include opinion posts and exclude current opinion if provided
    const whereQuery: Prisma.mod180_postsWhereInput = {
      ID: {
        in: postIds,
        ...(currentOpinionId ? { not: Number(currentOpinionId) } : {}),
      },
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
      whereQuery
    );

    // Get opinions sorted by date
    const opinions = await prisma.mod180_posts.findMany({
      where: whereQuery,
      take: limit,
      skip: (page - 1) * limit,
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

    if (opinions.length === 0) {
      return Response.json({
        ...paginationMeta.meta,
        items: [],
      });
    }

    const formattedResponse = toSafeJSON(opinions);
    const parsedOpinions = await Promise.all(
      formattedResponse.map(async (opinion: any) => {
        // Add Personalities
        const isPersonality = opinion.meta?.find(
          (meta: any) => meta.meta_key === "personnality"
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
                })
            )
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
                formattedAvatar.guid
              );
            })
          );

          personalitiesResult = toSafeJSON(parsedPersonnalities);
        }

        return toUpdatePostMakeOpinion(toIPost(opinion), personalitiesResult);
      })
    );

    let parsedPosts = await Promise.all(
      parsedOpinions.map(async (post) => {
        let parsedPost = post;
        if (post.featuredMediaId) {
          parsedPost = await getPostFeaturedImage(post);
        }
        return parsedPost;
      })
    );

    return Response.json(
      toSafeJSON<IPaginateResponse<IPost>>({
        ...paginationMeta.meta,
        items: parsedPosts,
      })
    );
  } catch (error) {
    console.error("Error fetching opinions by personality:", error);
    return Response.json(
      { error: "Failed to fetch opinions by personality" },
      { status: 500 }
    );
  }
}