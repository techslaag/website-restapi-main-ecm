import { toIPost } from "@/interfaces/IPost";
import { toIPostCategory } from "@/interfaces/IPostCategory";
import { getPaginationMetaData, getPostFeaturedImage } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import {
  extractQueryParams,
  forceNumberOrDefault,
  toSafeJSON,
} from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // extract query parameters
  const queryParams = extractQueryParams(req);

  // query
  const whereInput: Prisma.mod180_term_taxonomyWhereInput = {
    taxonomy: "affair",
    relationships: {
      some: { post: { NOT: undefined } },
    },
  };

  const page = forceNumberOrDefault(queryParams.page, 1),
    limit = forceNumberOrDefault(queryParams.limit, 25);

  // get the pagination meta data (page, limit, total pages)
  const paginationMeta = await getPaginationMetaData(
    "mod180_term_taxonomy",
    page,
    limit,
    whereInput,
  );

  const categories = await prisma.mod180_term_taxonomy.findMany({
    ...paginationMeta.query,
    where: whereInput,
    select: {
      taxonomy: true,
      count: true,
      description: true,
      term: true,
      relationships: {
        take: 1,
        orderBy: { post: { post_date: "desc" } },
        select: {
          post: {
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
          },
          taxonomy: true,
        },
      },
    },
  });

  const parsedCategories = await Promise.all(
    categories.map(async (item) => {
      let latestPost = item.relationships.map((item) => toIPost(item.post))[0];
      
      // Fetch featured image if needed
      if (latestPost && latestPost.featuredMediaId && !latestPost.featuredMedia) {
        latestPost = await getPostFeaturedImage(latestPost);
      }
      
      return {
        ...toIPostCategory(item),
        post: latestPost,
        // Add date and image from the latest post
        date: latestPost?.date || null,
        dateGmt: latestPost?.dateGmt || null,
        image: latestPost?.featuredMedia || null,
        imageUrl: latestPost?.featuredMedia?.sourceUrl || null,
      };
    })
  );

  return Response.json(
    toSafeJSON({
      ...paginationMeta.meta,
      items: parsedCategories,
    }),
  );
}
