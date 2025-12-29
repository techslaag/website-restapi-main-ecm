import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

// validation schema
const schema = z.object({
  posts: z
    .array(
      z.object({
        postId: z.string(),
        order: z.number(),
      }),
    )
    .max(15)
    .nonempty({ message: "Vous devez soumettre au moins 1 post." }),
});

export async function POST(request: Request) {
  return adminMiddleware(request, async () => {
    try {
      // register information
      const payload = schema.parse(await requestJsonBody(request));

      // existing heading posts
      const headingPosts = await prisma.headingPost.findMany({});

      for (
        let index = 0;
        index < payload.posts.sort((a, b) => a.order - b.order).length;
        index++
      ) {
        const input = payload.posts[index];

        // Check if already exists
        const existing = headingPosts.find(
          (item) => item.postId === BigInt(input.postId),
        );

        // exists and order has changed
        if (existing && input.order !== existing.order) {
          // update the heading post
          await prisma.headingPost.update({
            where: { id: existing.id },
            data: {
              order: input.order,
            },
          });
        } else {
          // add the heading post to the list
          await prisma.headingPost.create({
            data: {
              postId: BigInt(input.postId),
              order: index + 1,
            },
          });
        }
      }

      return new Response(undefined, { status: 204 });
    } catch (error) {
      return errorResponse(serializeError(error), {
        status: 500,
      });
    }
  });
}
