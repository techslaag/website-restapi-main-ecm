import { toIPostCategory } from "@/interfaces/IPostCategory";
import { getPaginationMetaData } from "@/lib/utils/databaseUtils";
import prisma from "@/lib/prisma";
import {
  extractQueryParams,
  forceNumberOrDefault,
  toSafeJSON,
} from "@/lib/utils/index";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // extract query parameters
  const queryParams = extractQueryParams(req);

  // query
  const whereInput: Prisma.mod180_term_taxonomyWhereInput = {
    taxonomy: "classement",
  };

  const page = forceNumberOrDefault(queryParams.page, 1),
    limit = forceNumberOrDefault(queryParams.limit, 25);

  // get the pagination meta data (page, limit, total pages)
  const paginationMeta = await getPaginationMetaData(
    "mod180_term_taxonomy",
    page,
    limit,
    whereInput,
  );

  const categories = await prisma.mod180_term_taxonomy.findMany({
    ...paginationMeta.query,
    where: whereInput,
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

  const parsedCategories = await Promise.all(
    categories.map(async (item) => {
      const formattedItem = toSafeJSON(item);
      const categoryData = toIPostCategory(formattedItem);
      
      // Extract ACF metadata from term
      const meta = formattedItem.term.meta || [];
      const imageIdMeta = meta.find((m: any) => m.meta_key === "image");
      const publicationDateMeta = meta.find((m: any) => m.meta_key === "publication_date");
      
      // Initialize variables
      let image = null;
      let imageUrl = null;
      let date = null;
      let dateGmt = null;
      
      // Use publication_date as both date and dateGmt if available
      if (publicationDateMeta?.meta_value) {
        date = publicationDateMeta.meta_value;
        dateGmt = publicationDateMeta.meta_value;
      }
      
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
          
          // Only use image post dates if publication_date wasn't set
          if (!publicationDateMeta?.meta_value) {
            date = imagePost.post_date;
            dateGmt = imagePost.post_date_gmt;
          }
        }
      }
      
      return {
        ...categoryData,
        date: date,
        dateGmt: dateGmt,
        image: image,
        imageUrl: imageUrl,
      };
    })
  );

  return Response.json(
    toSafeJSON({
      ...paginationMeta.meta,
      items: parsedCategories,
    }),
  );
}