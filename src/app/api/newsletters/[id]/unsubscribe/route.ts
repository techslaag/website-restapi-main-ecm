import authMiddleware from "@/lib/auth/authMiddleware";
import mailchimp, { isMailchimpErrorResponse } from "@/lib/mailchimp";
import prisma from "@/lib/prisma";
import { errorResponse } from "@/lib/utils/index";
import { createHash } from "crypto";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params: { id: newsletterId } }: { params: { id: string } },
) {
  return authMiddleware(request, async (user) => {
    try {
      // newsletter instance
      const newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletterId },
        include: {
          users: {
            where: { userId: user.id },
          },
        },
      });

      // newsletter exists
      if (newsletter) {
        // user email must be defined
        if (newsletter.users.length === 0) {
          return Response.json(
            {
              message: `Vous n'êtes pas abonné à la newsletter "${newsletter.name}"`,
            },
            { status: 400 },
          );
        } else {
          // mailchimp audience id is required
          if (newsletter.mailchimpAudienceId) {
            // extract the connection
            const connection = newsletter.users.find(
              (item) => item.userId === user.id,
            );

            if (connection) {
              await prisma.$transaction(async (tsx) => {
                // disconnect user
                await prisma.userNewsletter.delete({
                  where: {
                    userId_newsletterId: {
                      newsletterId: newsletter.id,
                      userId: user.id,
                    },
                  },
                });

                // unsubscribe the user on mailchimp if the member id exists
                if (connection.mailchimpMemberId) {
                  // generate subscriber hash
                  const subscriberHash = createHash("md5")
                    .update(connection.usedEmail)
                    .digest("hex");

                  // update member on mailchimp
                  const response = await mailchimp.lists.deleteListMember(
                    newsletter.mailchimpAudienceId!,
                    subscriberHash,
                  );

                  if (isMailchimpErrorResponse(response)) {
                    const { detail, ...restError } =
                      response as mailchimp.ErrorResponse;

                    throw {
                      message: detail,
                      error: restError,
                    };
                  }
                }
              });
            }
          } else {
            return Response.json({
              message:
                "Impossible de souscrire à cette newsletter. Audience non définit, contactez le support.",
            });
          }
        }

        return new Response(undefined, {
          status: 204,
        });
      } else {
        return Response.json(
          { message: "Newsletter introuvable" },
          {
            status: 404,
          },
        );
      }
    } catch (error) {
      return errorResponse(
        {
          message: "L'opération a échoué. Merci de réessayer plus tard.",
          error: serializeError(error),
        },
        {
          status: 500,
        },
      );
    }
  });
}
