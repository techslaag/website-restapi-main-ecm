import { toIPost } from "@/interfaces/IPost";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: Number } },
) {
  const post = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(params.id),
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
      post,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
    ),
  );

  const parsedPost = toIPost(formattedResponse);

  return Response.json(parsedPost);
}
