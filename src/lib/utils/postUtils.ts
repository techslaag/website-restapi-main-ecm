import IPost from "@/interfaces/IPost";
import { Prisma, User } from "@prisma/client";
import prisma from "../prisma";
import {
  getActiveSubscription,
  isActiveSubscription,
} from "./subscriptionUtils";
import { isNumeric } from ".";

export const POST_SELECT_INPUT = {
  ID: true,
  post_name: true,
  post_status: true,
  post_excerpt: true,
  post_title: true,
  post_content: true,
  post_date: true,
  post_date_gmt: true,
  post_modified: true,
  post_modified_gmt: true,
  archived: true,
  archivedAt: true,
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
  meta: true,
  author: {
    select: {
      ID: true,
      display_name: true,
      user_nicename: true,
    },
  },
} as const satisfies Prisma.mod180_postsSelect;

export async function hasBoughtThePost(post: IPost, user: User) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      userId: user.id,
      postId: Number(post.id),
      payment: {
        status: "succeeded",
      },
    },
  });

  return !!purchase;
}

/**
 * Check if a user have have access to a post
 * @param user user
 * @param post post
 * @returns
 */
export async function canAccessPost(post: IPost, user?: User) {
  // has bought the post
  const hasBought = user ? await hasBoughtThePost(post, user) : false;

  // get the user subscription
  const sub = user ? await getActiveSubscription(user) : null;

  switch (post.postPrestige) {
    case "ecomembre":
      return hasBought || (isActiveSubscription(sub) && (sub as any)?.plan?.exclusivity);

    case "premium":
      return (
        hasBought || (isActiveSubscription(sub) && (sub as any)?.plan?.premiumPosts)
      );

    default:
      return isNumeric(post.price) ? hasBought : true;
  }
}
