import IDirect, { toIDirect } from "@/interfaces/IDirect";
import { injectDirectFeaturedImages } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { idOrSlug: string } }
) {
  const { idOrSlug } = params;

  let whereQuery: Prisma.mod180_postsWhereInput = {
    post_type: "directs",
    post_status: "publish",
    meta: {
      some: {
        meta_key: "actif",
        meta_value: "1",
      },
    },
  };

  // Check if idOrSlug is a number (ID) or string (slug)
  if (!isNaN(Number(idOrSlug))) {
    whereQuery = {
      ...whereQuery,
      ID: Number(idOrSlug),
    };
  } else {
    whereQuery = {
      ...whereQuery,
      post_name: idOrSlug,
    };
  }

  const direct = await prisma.mod180_posts.findFirst({
    where: whereQuery,
    select: {
      ID: true,
      post_name: true,
      post_title: true,
      post_content: true,
      post_excerpt: true,
      post_status: true,
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
      meta: {
        select: {
          meta_key: true,
          meta_value: true,
        },
      },
    },
  });

  if (direct == null) {
    return Response.json(
      {
        error: `Direct not found`,
      },
      {
        status: 404,
      },
    );
  }

  const directItem = toIDirect(direct);
  const [directWithFeaturedImage] = await injectDirectFeaturedImages([directItem]);

  return Response.json(toSafeJSON<IDirect>(directWithFeaturedImage));
}