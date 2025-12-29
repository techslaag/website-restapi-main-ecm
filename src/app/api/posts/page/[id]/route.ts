import { toIPost } from "@/interfaces/IPost";
import prisma from "@/lib/prisma";
import { getPostFeaturedImage } from "@/lib/utils/databaseUtils";
export async function GET(
  req: Request,
  { params }: { params: { id: Number } },
) {
  const posts = await prisma.mod180_posts.findMany({
    take: 10,
    skip: (Number(params.id) - 1) * 10, // 10 posts per page
    orderBy: {
      post_date_gmt: "desc",
    },
    where: {
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
      termRelationships: {
        some: {
          taxonomy: {
            term_id: Number(params.id),
          },
        },
      },
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
          posts: true,
        },
      },
    },
  });
  const formattedResponse = JSON.parse(
    JSON.stringify(
      posts,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
    ),
  );

  const parsedPost = await Promise.all(
    formattedResponse.map(async (post: any) => {
      let parsedPost = toIPost(post);
      // check if media and insert if not
      if (parsedPost.featuredMediaId) {
        parsedPost = await getPostFeaturedImage(parsedPost);
      }
      return parsedPost;
    }),
  );

  return Response.json(parsedPost);
}
