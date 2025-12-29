import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const posts = await prisma.mod180_posts.findMany({
    take: 10,
    skip: 0,
    orderBy: {
      post_date_gmt: "desc",
    },
    select: {
      ID: true,
      meta: true,
    },
  });

  const formattedResponse = toSafeJSON(posts);

  const postsResult = Promise.all(
    formattedResponse?.map(async (post: any) => {
      const metaValue = post?.meta?.find(
        (meta: any) => meta.meta_key === "tie_views",
      )?.meta_value;
      const metaId = post?.meta?.find(
        (meta: any) => meta.meta_key === "view_count",
      )?.meta_id;

      if (Boolean(metaId)) {
        await prisma.mod180_postmeta.update({
          where: {
            meta_id: Number(metaId),
          },
          data: {
            meta_value: metaValue ? String(metaValue) : null,
          },
        });
      } else {
        await prisma.mod180_postmeta.create({
          data: {
            post_id: Number(post.ID),
            meta_key: "view_count",
            meta_value: metaValue ? String(metaValue) : null,
          },
        });
      }
    }),
  );

  return Response.json({
    data: toSafeJSON(postsResult),
    response: { status: 200 },
  });
}
