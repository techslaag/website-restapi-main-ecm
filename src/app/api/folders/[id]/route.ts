import IPostCategory, { toIPostCategory } from "@/interfaces/IPostCategory";
import prisma from "@/lib/prisma";
import { isNumeric, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: idOrSlug } }: { params: { id: string } },
) {
  const category = await prisma.mod180_term_taxonomy.findFirst({
    where: {
      OR: [
        isNumeric(idOrSlug)
          ? { term_id: BigInt(idOrSlug) }
          : { term: { slug: idOrSlug } },
      ],
      taxonomy: "affair",
    },
    select: {
      taxonomy: true,
      count: true,
      description: true,
      term: {
        select: {
          term_id: true,
          name: true,
          slug: true,
          meta: {
            select: {
              meta_key: true,
              meta_value: true,
            },
          },
        },
      },
      relationships: {
        take: 1,
        orderBy: { post: { post_date: "desc" } },
        select: {
          post: {
            select: {
              ID: true,
              post_date: true,
              post_date_gmt: true,
              meta: {
                where: {
                  meta_key: "_thumbnail_id",
                },
                select: {
                  meta_value: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (category) {
    const formattedCategory = toSafeJSON(category);
    const categoryData = toIPostCategory(formattedCategory);
    
    // Extract additional metadata
    const meta = formattedCategory.term.meta || [];
    const imageMeta = meta.find((m: any) => m.meta_key === "image_url");
    const dateMeta = meta.find((m: any) => m.meta_key === "date");
    const imageIdMeta = meta.find((m: any) => m.meta_key === "image_id");
    
    // Get image data if image_id exists from metadata
    let image = null;
    let imageUrl = imageMeta?.meta_value || null;
    
    if (imageIdMeta?.meta_value) {
      const imagePost = await prisma.mod180_posts.findUnique({
        where: {
          ID: Number(imageIdMeta.meta_value),
          post_type: "attachment",
        },
        select: {
          ID: true,
          guid: true,
          post_title: true,
          post_mime_type: true,
        },
      });
      
      if (imagePost) {
        image = {
          id: imagePost.ID.toString(),
          sourceUrl: imagePost.guid,
          title: imagePost.post_title,
          mimeType: imagePost.post_mime_type,
        };
        imageUrl = imageUrl || imagePost.guid;
      }
    }
    
    // If no image from metadata, try to get from latest post
    const latestPost = formattedCategory.relationships?.[0]?.post;
    if (!image && latestPost) {
      const thumbnailId = latestPost.meta?.[0]?.meta_value;
      
      if (thumbnailId) {
        const imagePost = await prisma.mod180_posts.findUnique({
          where: {
            ID: Number(thumbnailId),
            post_type: "attachment",
          },
          select: {
            ID: true,
            guid: true,
            post_title: true,
            post_mime_type: true,
            post_excerpt: true,
            meta: {
              where: {
                meta_key: { in: ["_wp_attachment_metadata", "_wp_attached_file"] },
              },
              select: {
                meta_key: true,
                meta_value: true,
              },
            },
          },
        });
        
        if (imagePost) {
          image = {
            id: imagePost.ID.toString(),
            sourceUrl: imagePost.guid,
            title: imagePost.post_title,
            caption: imagePost.post_excerpt,
            mimeType: imagePost.post_mime_type,
          };
          imageUrl = imageUrl || imagePost.guid;
        }
      }
    }
    
    // Use date from metadata or from latest post
    const date = dateMeta?.meta_value || latestPost?.post_date || null;
    const dateGmt = latestPost?.post_date_gmt || null;
    
    return Response.json({
      ...categoryData,
      imageUrl: imageUrl,
      date: date,
      dateGmt: dateGmt,
      image: image,
    });
  } else {
    return Response.json({ message: "Folder not found." }, { status: 404 });
  }
}
