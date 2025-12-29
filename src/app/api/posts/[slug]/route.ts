import IPost, { toIPost } from "@/interfaces/IPost";
import prisma from "@/lib/prisma";
import { excludeProps, isNumeric, toSafeJSON } from "@/lib/utils/index";
import { getPostFeaturedImage } from "@/lib/utils/databaseUtils";
import { POST_SELECT_INPUT } from "@/lib/utils/postUtils";
import { generateMobileAppPromotionMessage, shouldShowMobileAppPromotion } from "@/lib/utils/mobileAppPromotionUtils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
) {
  // load the post
  const post = await prisma.mod180_posts.findFirst({
    where: {
      OR: [
        { post_name: { equals: String(params.slug) } },
        {
          ID: {
            equals: isNaN(Number(params.slug)) ? -1 : Number(params.slug),
          },
        },
      ],
    },
    select: POST_SELECT_INPUT,
  });

  if (!post) {
    return Response.json(
      {
        error: "Post not found",
      },
      {
        status: 404,
      },
    );
  } else {
    let parsedPost = toIPost(post);

    // the given user cannot read the post
    if (shouldShowMobileAppPromotion(parsedPost)) {
      // we delete the post content and add mobile app promotion
      parsedPost = excludeProps(parsedPost, ["content"]);
      (parsedPost as any).mobileAppPromotion = generateMobileAppPromotionMessage(parsedPost);
    }

    // check if media and insert if not
    if (parsedPost.featuredMediaId) {
      parsedPost = await getPostFeaturedImage(parsedPost);
    }

    return Response.json(toSafeJSON<IPost>(parsedPost));
  }
}
