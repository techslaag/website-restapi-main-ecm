import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const post_id = Number(params.id);

  const post = await prisma.mod180_posts.findUnique({
    where: {
      ID: post_id,
      post_type: "post",
      post_status: "publish",
    },
    include: {
      meta: true,
    },
  });

  if (post == null) {
    return Response.json(
      {
        error: `Post of ID ${post_id} not found`,
      },
      {
        status: 404,
      },
    );
  }

  const formattedResponse = JSON.parse(
    JSON.stringify(
      post,
      (key, value) => (typeof value === "bigint" ? value.toString() : value), // return everything else unchanged
    ),
  );

  const views = formattedResponse.meta.find(
    (m: { meta_key: string }) => m.meta_key === "tie_views",
  )?.meta_value;

  return Response.json({
    id: post_id,
    view_count: views,
  });
}
