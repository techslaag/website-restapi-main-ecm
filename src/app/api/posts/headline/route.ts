import IPost, { toIPost } from "@/interfaces/IPost";
import { getPostFeaturedImage } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const whereQuery: Prisma.mod180_postsWhereInput = {
      post_type: "post",
      post_status: "publish",
      archived: { not: true }, // Re-enabled archive filtering to prevent archived posts from appearing as headlines
    meta: {
      some: {
        meta_key: "post_type",
        meta_value: {
          not: "opinion",
        },
      },
    },
    termRelationships: {
      some: {
        taxonomy: {
          term: {
            slug: "a-la-une",
          },
        },
      },
    },
  };

  const headlinePost = await prisma.mod180_posts.findFirst({
    where: whereQuery,
    orderBy: {
      post_date_gmt: "desc",
    },
    include: {
      termRelationships: {
        include: {
          taxonomy: {
            include: {
              term: true,
            },
          },
        },
      },
      meta: true,
      children: {
        include: {
          meta: true,
        },
      },
      author: {
        include: {
          metas: true,
        },
      },
    },
  });

  if (headlinePost) {
    const isCowrited = headlinePost.meta?.find(
      (meta) => meta.meta_key === "cowriter",
    );

    if (isCowrited) {
      const cowriter = await prisma.mod180_users.findUnique({
        where: {
          ID: Number(isCowrited.meta_value),
        },
      });

      if (cowriter) {
        (headlinePost as any)["authors"] = [
          headlinePost.author,
          {
            ID: cowriter.ID,
            display_name: cowriter.display_name,
            user_nicename: cowriter.user_nicename,
          },
        ];
      }
    }

    let parsedHeadlinePost = toIPost(headlinePost);

    if (parsedHeadlinePost.featuredMediaId) {
      parsedHeadlinePost = await getPostFeaturedImage(parsedHeadlinePost);
    }
    return NextResponse.json(toSafeJSON<IPost>(parsedHeadlinePost));
  } else {
    return Response.json(null);
  }
  } catch (error) {
    console.error('Headline API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch headline post',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
