import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { toIPostMostViewed } from "@/interfaces/IPostMostViewed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const today = new Date();

    // Note: Archive filtering is temporarily disabled until server restart
    // Once server is restarted with new Prisma client, uncomment the archive filter below:
    // archived: { not: true }
    const whereQuery: Prisma.mod180_postsWhereInput = {
      post_type: "post",
      post_status: "publish",
    meta: {
      some: {
        meta_key: "post_type",
        meta_value: {
          not: "opinion",
        },
      },
    },
    AND: [
      {
        post_date_gmt: {
          gte: new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate() - 7,
          ),
          // gte: new Date(2024, 1, 3),
        },
      },
    ],
  };

  const posts = await prisma.mod180_posts.findMany({
    where: whereQuery,
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
      meta: true,
    },
  });

  if (posts) {
    // const formattedResponse = toSafeJSON(posts.map(toIPost));
    const formattedResponse = toSafeJSON(posts);

    const filteredPostsByViews = await Promise.all(
      formattedResponse.map(async (post: any, index: any) => {
        return {
          id: index,
          view_count: post?.meta?.find(
            (meta: any) => meta.meta_key === "tie_views",
          )?.meta_value
            ? Number(
                post?.meta?.find((meta: any) => meta.meta_key === "tie_views")
                  ?.meta_value,
              )
            : 0,
        };
      }),
    );
    const sortedViewsCount = filteredPostsByViews
      .sort(function (a, b) {
        return b.view_count - a.view_count;
      })
      .slice(0, 10);
    const filteredPosts = await Promise.all(
      sortedViewsCount.map((post: any) => {
        return posts[post.id];
      }),
    );
    const parsedPosts = await Promise.all(filteredPosts.map(toIPostMostViewed));
    return NextResponse.json(parsedPosts);
  } else {
    return Response.json(
      { message: "Posts not found" },
      {
        status: 404,
      },
    );
  }
  } catch (error) {
    console.error('Most viewed posts API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch most viewed posts',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
