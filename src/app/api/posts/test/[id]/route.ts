import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id } }: { params: { id: string } },
) {
  const posts = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(id),
    },
    select: {
      ID: true,
      post_name: true,
      post_title: true,
      post_date: true,
      post_date_gmt: true,
      post_modified: true,
      post_modified_gmt: true,
      author: {
        select: {
          ID: true,
          display_name: true,
          user_nicename: true,
        },
      },
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
    },
  });

  if (posts == null) {
    return Response.json(
      {
        error: `Posts not found`,
      },
      {
        status: 404,
      },
    );
  }

  const formattedResponse = JSON.parse(
    JSON.stringify(
      posts,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
    ),
  );

  // const parsedPost = await Promise.all(formattedResponse.map(parsePost));

  return Response.json(formattedResponse);
}
