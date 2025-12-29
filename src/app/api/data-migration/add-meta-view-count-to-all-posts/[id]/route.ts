import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id } }: { params: { id: string } },
) {
  const post = await prisma.mod180_posts.findUnique({
    where: {
      ID: Number(id),
    },
    select: {
      meta: true,
    },
  });

  const metaValue = post?.meta?.find(
    (meta) => meta.meta_key === "tie_views",
  )?.meta_value;

  const result = await prisma.mod180_postmeta.create({
    data: {
      post_id: Number(id),
      meta_key: "view_count",
      meta_value: metaValue ? String(metaValue) : null,
    },
  });
  return new Response(toSafeJSON(result), { status: 200 });
}
