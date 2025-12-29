import prisma from "@/lib/prisma";
import { extractQueryParams } from "@/lib/utils/index";

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const queryParams = extractQueryParams(req);
  const post_id = Number(params.id);

  if (queryParams.action) {
    if (
      queryParams.action === "increment" ||
      queryParams.action === "decrement"
    ) {
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
            error: `Cannot PUT unresolved post : Post of ID ${post_id} not found`,
          },
          {
            status: 404,
          },
        );
      }

      const viewsMeta = post.meta.find((m) => m.meta_key === "tie_views");

      if (viewsMeta) {
        // views count
        const viewsCount = Number(viewsMeta.meta_value);

        await prisma.mod180_postmeta.update({
          where: {
            meta_id: viewsMeta.meta_id,
          },
          data: {
            meta_value:
              queryParams.action === "increment"
                ? (viewsCount + 1).toString()
                : queryParams.action === "decrement"
                  ? (viewsCount - 1).toString()
                  : viewsCount.toString(),
          },
        });
      } else {
        await prisma.mod180_postmeta.create({
          data: {
            post_id,
            meta_key: "tie_views",
            meta_value: "1",
          },
        });
      }

      return Response.json(
        {
          success: "Action Success",
        },
        {
          status: 200,
        },
      );
    } else {
      return Response.json(
        {
          error: "Invalid action",
        },
        {
          status: 400,
        },
      );
    }
  } else {
    return Response.json(
      {
        error: "Missing action",
      },
      {
        status: 400,
      },
    );
  }
}
