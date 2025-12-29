import { toIPostCategory } from "@/interfaces/IPostCategory";
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
      taxonomy: "classement",
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
    },
  });

  if (category) {
    const formattedItem = toSafeJSON(category);
    const categoryData = toIPostCategory(formattedItem);
    
    // Extract ACF metadata from term
    const meta = formattedItem.term.meta || [];
    const imageIdMeta = meta.find((m: any) => m.meta_key === "image");
    
    // Initialize variables
    let image = null;
    let imageUrl = null;
    let date = null;
    let dateGmt = null;
    
    // Fetch image details if image_id exists
    if (imageIdMeta?.meta_value) {
      const imagePost = await prisma.mod180_posts.findUnique({
        where: {
          ID: Number(imageIdMeta.meta_value),
        },
        select: {
          ID: true,
          guid: true,
          post_type: true,
          post_excerpt: true,
          post_mime_type: true,
          post_title: true,
          post_date: true,
          post_date_gmt: true,
          meta: {
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
          mediaType: imagePost.post_mime_type?.split("/")[0] ?? "file",
          mimeType: imagePost.post_mime_type,
          title: imagePost.post_title,
          altText: imagePost.meta?.find(
            (item) => item.meta_key === "_wp_attachment_image_alt",
          )?.meta_value,
          caption: imagePost.post_excerpt,
          sourceUrl: imagePost.guid,
          mediaPath: imagePost.meta?.find(
            (item) => item.meta_key === "_wp_attached_file",
          )?.meta_value,
          date: imagePost.post_date,
          dateGmt: imagePost.post_date_gmt,
        };
        // Override imageUrl with the fetched image URL
        imageUrl = imagePost.guid;
        date = imagePost.post_date;
        dateGmt = imagePost.post_date_gmt;
      }
    }
    
    return Response.json({
      ...categoryData,
      taxonomy: categoryData.taxonomy,
      date: date,
      dateGmt: dateGmt,
      image: image,
      imageUrl: imageUrl,
    });
  } else {
    return Response.json({ message: "Classement not found." }, { status: 404 });
  }
}