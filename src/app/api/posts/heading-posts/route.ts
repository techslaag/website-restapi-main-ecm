import { toIPost } from "@/interfaces/IPost";
import prisma from "@/lib/prisma";
import { NextRequest } from "next/server";
import { serializeError } from "serialize-error";
import { getPostFeaturedImage } from "@/lib/utils/databaseUtils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    // fetch heading posts
    const response = await prisma.headingPost.findMany({
      select: {
        id: true,
        order: true,
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
            meta: true,
            author: {
              select: {
                ID: true,
                display_name: true,
                user_nicename: true,
              },
            },
          },
        },
      },
    });

    return Response.json(
      response.map(({ id, order, post }) => ({
        id,
        order,
        post: toIPost(post).featuredMediaId
          ? getPostFeaturedImage(toIPost(post))
          : toIPost(post),
      })),
    );
  } catch (error) {
    return Response.json(serializeError(error), {
      status: 500,
    });
  }
}
