import authMiddleware from "@/lib/auth/authMiddleware";
import mailchimp, { isMailchimpErrorResponse } from "@/lib/mailchimp";
import prisma from "@/lib/prisma";
import { errorResponse, getClientIp } from "@/lib/utils/index";
import { createHash } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params: { id: newsletterId } }: { params: { id: string } },
) {
  return authMiddleware(request, async (user) => {
    try {
      // newsletter instance
      const newsletter = await prisma.newsletter.findUnique({
        where: { id: newsletterId },
      });

      // newsletter exists
      if (newsletter) {
        // mailchimp audience id is required
        if (newsletter.mailchimpAudienceId) {
          // user email must be defined and verified
          if (user.email && user.emailVerified) {
            await prisma.$transaction(async (tsx) => {
              // user id
              const userIpAddress =
                request.headers.get("x-user-ip") ?? getClientIp(request);

              // // generate subscriber hash
              // const subscriberHash = createHash("md5")
              //   .update(user.email!)
              //   .digest("hex");

              // // add the user to
              // const response = await mailchimp.lists.updateListMember(
              //   newsletter.mailchimpAudienceId!,
              //   subscriberHash,
              //   {
              //     email_address: user.email!,
              //     status: "subscribed",
              //     language: user.locale ?? undefined,
              //     ip_opt: userIpAddress,
              //     ip_signup: userIpAddress,
              //     timestamp_opt: moment().format(),
              //     timestamp_signup: moment().format(),
              //     merge_fields: {
              //       FNAME: user.name!,
              //     },
              //   },
              // );

              const response = await mailchimp.lists.addListMember(
                newsletter.mailchimpAudienceId!,
                {
                  email_address: user.email!,
                  status: "subscribed",
                  language: user.locale ?? undefined,
                  ip_opt: userIpAddress,
                  ip_signup: userIpAddress,
                  timestamp_opt: moment().format(),
                  timestamp_signup: moment().format(),
                  merge_fields: {
                    FNAME: user.name!,
                  },
                },
              );

              if (isMailchimpErrorResponse(response)) {
                const { detail, ...restError } =
                  response as mailchimp.ErrorResponse;

                throw {
                  message: detail,
                  error: restError,
                };
              } else {
                // extract mailchimp list member id
                const { id: mailchimpMemberId } =
                  response as mailchimp.lists.MembersSuccessResponse;

                // connect user
                await tsx.newsletter.update({
                  where: { id: newsletter.id },
                  data: {
                    users: {
                      connectOrCreate: {
                        where: {
                          userId_newsletterId: {
                            newsletterId: newsletter.id,
                            userId: newsletter.id,
                          },
                        },
                        create: {
                          usedEmail: user.email!,
                          userId: user.id,
                          mailchimpMemberId,
                        },
                      },
                    },
                  },
                });
              }
            });

            return new Response(undefined, {
              status: 204,
            });
          } else {
            return Response.json(
              {
                message:
                  "Votre adresse email n'est pas vérifiée. Merci de réessayer après la verification.",
              },
              {
                status: 500,
              },
            );
          }
        } else {
          return Response.json(
            {
              message:
                "Impossible de souscrire à cette newsletter. Audience non définit, contactez le support.",
            },
            {
              status: 500,
            },
          );
        }
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
