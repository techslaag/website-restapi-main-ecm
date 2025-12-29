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
  { params }: { params: { opinionId: string } }
) {
  try {
    const queryParams = extractQueryParams(req);
    const currentOpinionId = Number(params.opinionId);

    const page = Number(queryParams.page ?? 1);
    const limit = Number(queryParams.limit ?? 6);
    const strategy = queryParams.strategy || "mixed"; // "mixed", "tags", "popular", "complementary"

    // Get the current opinion to extract its tags, categories and content
    const currentOpinion = await prisma.mod180_posts.findUnique({
      where: {
        ID: currentOpinionId,
      },
      select: {
        post_title: true,
        post_content: true,
        termRelationships: {
          select: {
            term_taxonomy_id: true,
            taxonomy: {
              select: {
                taxonomy: true,
                term: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        meta: {
          where: {
            meta_key: "personnality",
          },
          select: {
            meta_value: true,
          },
        },
      },
    });

    if (!currentOpinion) {
      return Response.json(
        { error: "Opinion not found" },
        { status: 404 }
      );
    }

    // Extract tags and categories
    const tagIds = currentOpinion.termRelationships
      .filter((rel) => rel.taxonomy.taxonomy === "post_tag")
      .map((rel) => Number(rel.term_taxonomy_id));

    const categoryIds = currentOpinion.termRelationships
      .filter((rel) => rel.taxonomy.taxonomy === "category")
      .map((rel) => Number(rel.term_taxonomy_id));

    // Extract keywords from tags for content matching
    const tagKeywords = currentOpinion.termRelationships
      .filter((rel) => rel.taxonomy.taxonomy === "post_tag")
      .map((rel) => rel.taxonomy.term.name.toLowerCase());

    let sortedPostIds: number[] = [];
    let postScores = new Map<number, number>();

    if (strategy === "popular") {
      // Strategy 1: Popular articles (most viewed recently)
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 60); // Last 30 days

      const popularPosts = await prisma.mod180_posts.findMany({
        where: {
          post_type: "post",
          post_status: "publish",
          post_date_gmt: {
            gte: recentDate,
          },
          ID: {
            not: currentOpinionId,
          },
        },
        select: {
          ID: true,
          meta: {
            where: {
              meta_key: "views_count",
            },
            select: {
              meta_value: true,
            },
          },
        },
        orderBy: {
          post_date_gmt: "desc",
        },
        take: limit * 3, // Get more to ensure we have enough after filtering
      });

      // Sort by view count
      sortedPostIds = popularPosts
        .map((post) => ({
          id: Number(post.ID),
          views: parseInt(post.meta[0]?.meta_value || "0"),
        }))
        .sort((a, b) => b.views - a.views)
        .map((item) => item.id);

    } else if (strategy === "complementary") {
      // Strategy 2: Complementary articles (same event/subject, different angles)
      // Look for posts in same categories but different authors
      const currentPersonalityId = currentOpinion.meta[0]?.meta_value
        ? PHP.parse(currentOpinion.meta[0].meta_value)[0]
        : null;

      const complementaryPosts = await prisma.mod180_term_relationships.findMany({
        where: {
          term_taxonomy_id: {
            in: categoryIds,
          },
        },
        select: {
          object_id: true,
        },
      });

      // Get posts and filter by different author
      const postsToCheck = Array.from(new Set(complementaryPosts.map((p) => Number(p.object_id))));
      
      if (currentPersonalityId) {
        const postsWithSameAuthor = await prisma.mod180_postmeta.findMany({
          where: {
            post_id: {
              in: postsToCheck,
            },
            meta_key: "personnality",
            meta_value: {
              contains: `"${currentPersonalityId}"`,
            },
          },
          select: {
            post_id: true,
          },
        });

        const sameAuthorIds = new Set(postsWithSameAuthor.map((p) => Number(p.post_id)));
        sortedPostIds = postsToCheck.filter(
          (id) => id !== currentOpinionId && !sameAuthorIds.has(id)
        );
      } else {
        sortedPostIds = postsToCheck.filter((id) => id !== currentOpinionId);
      }

    } else {
      // Strategy 3: Mixed approach (default) - combine tags, categories, and content similarity
      // Find posts that share tags or categories
      const relatedPosts = await prisma.mod180_term_relationships.findMany({
        where: {
          term_taxonomy_id: {
            in: [...tagIds, ...categoryIds],
          },
        },
        select: {
          object_id: true,
          term_taxonomy_id: true,
        },
      });

      // Calculate scores based on shared tags/categories
      relatedPosts.forEach((rel) => {
        const objectId = Number(rel.object_id);
        if (objectId === currentOpinionId) return;
        
        const score = postScores.get(objectId) || 0;
        // Give more weight to shared tags than categories
        const weight = tagIds.includes(Number(rel.term_taxonomy_id)) ? 2 : 1;
        postScores.set(objectId, score + weight);
      });

      // If we have tag keywords, boost posts that contain these keywords in title
      if (tagKeywords.length > 0) {
        const keywordMatches = await prisma.mod180_posts.findMany({
          where: {
            post_type: "post",
            post_status: "publish",
            ID: {
              not: currentOpinionId,
            },
            OR: tagKeywords.map((keyword) => ({
              post_title: {
                contains: keyword,
                mode: "insensitive" as const,
              },
            })),
          },
          select: {
            ID: true,
          },
          take: 20,
        });

        // Boost scores for keyword matches
        keywordMatches.forEach((post) => {
          const postId = Number(post.ID);
          const currentScore = postScores.get(postId) || 0;
          postScores.set(postId, currentScore + 3);
        });
      }

      // Sort by score and get top post IDs
      sortedPostIds = Array.from(postScores.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([postId]) => postId);
    }

    // Filter to include all published posts
    const whereQuery: Prisma.mod180_postsWhereInput = {
      ID: {
        in: sortedPostIds.slice(0, limit * 2), // Limit the IDs to query
      },
      post_type: "post",
      post_status: "publish",
    };

    // If no related posts found, fallback to recent posts
    if (sortedPostIds.length === 0) {
      const recentPosts = await prisma.mod180_posts.findMany({
        where: {
          post_type: "post",
          post_status: "publish",
          ID: {
            not: currentOpinionId,
          },
        },
        select: {
          ID: true,
        },
        orderBy: {
          post_date_gmt: "desc",
        },
        take: limit,
      });

      sortedPostIds = recentPosts.map((p) => Number(p.ID));
      whereQuery.ID = { in: sortedPostIds };
    }

    const paginationMeta = await getPaginationMetaData(
      "mod180_posts",
      page,
      limit,
      whereQuery
    );

    // Get posts maintaining the relevance order
    const posts = await prisma.mod180_posts.findMany({
      where: whereQuery,
      take: limit,
      skip: (page - 1) * limit,
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

    if (posts.length === 0) {
      return Response.json({
        ...paginationMeta.meta,
        items: [],
      });
    }

    const formattedResponse = toSafeJSON(posts);
    const parsedPosts = await Promise.all(
      formattedResponse.map(async (post: any) => {
        // Add Personalities (for opinion posts)
        const isPersonality = post.meta?.find(
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

        return toUpdatePostMakeOpinion(toIPost(post), personalitiesResult);
      })
    );

    let finalPosts = await Promise.all(
      parsedPosts.map(async (post) => {
        let parsedPost = post;
        if (post.featuredMediaId) {
          parsedPost = await getPostFeaturedImage(post);
        }
        return parsedPost;
      })
    );

    // Maintain the relevance order
    const idOrder = new Map(sortedPostIds.map((id, index) => [id, index]));
    finalPosts.sort((a, b) => {
      const orderA = idOrder.get(Number(a.id)) ?? 999;
      const orderB = idOrder.get(Number(b.id)) ?? 999;
      return orderA - orderB;
    });

    return Response.json(
      toSafeJSON<IPaginateResponse<IPost>>({
        ...paginationMeta.meta,
        items: finalPosts.slice(0, limit),
      })
    );
  } catch (error) {
    console.error("Error fetching related opinions:", error);
    return Response.json(
      { error: "Failed to fetch related opinions" },
      { status: 500 }
    );
  }
}