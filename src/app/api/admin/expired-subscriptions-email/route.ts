import adminMiddleware from "@/lib/auth/adminMiddleware";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import buildExpiredSubscriptionEmail from "@/lib/mail/emails/buildExpiredSubscriptionEmail";
import { EmailLogger } from "@/lib/utils/emailLogger";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const body = await request.json();
      const { userIds, customMessage, customSubject, buttonText, buttonLink } = body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return Response.json(
          { error: "userIds array is required" },
          { status: 400 }
        );
      }

      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
          subscriptions: {
            some: {
              expiresAt: {
                lt: new Date(),
              },
            },
          },
        },
        include: {
          subscriptions: {
            where: {
              expiresAt: {
                lt: new Date(),
              },
            },
            include: {
              plan: true,
            },
            orderBy: {
              expiresAt: "desc",
            },
            take: 1,
          },
        },
      });

      const emailResults = [];
      const emailLogs = [];

      for (const user of users) {
        if (!user.email || user.subscriptions.length === 0) {
          continue;
        }

        const subscription = user.subscriptions[0];
        let emailContent;
        let templateType: "expired_subscription" | "custom_message";

        if (customMessage) {
          const buildCustomMessageEmail = (await import("@/lib/mail/emails/buildCustomMessageEmail")).default;
          
          const frontendUrl = process.env.NEXT_PUBLIC_FRONT_APP_URL || "https://ecomatin.net";
          const actionButton = {
            text: buttonText || "Renouveler mon abonnement",
            link: buttonLink || `${frontendUrl}/offers`,
          };
          
          const emailOptions = {
            subject: customSubject || "Message important d'EcoMatin",
            message: customMessage,
            actionButton: actionButton,
          };
          
          emailContent = buildCustomMessageEmail(user, emailOptions);
          templateType = "custom_message";
        } else {
          emailContent = buildExpiredSubscriptionEmail({
            ...subscription,
            user,
          });
          templateType = "expired_subscription";
        }

        const subject = emailContent.subject || "Votre abonnement EcoMatin a expiré";

        try {
          await sendEmail({
            to: user.email,
            subject,
            html: emailContent.emailHtml,
            text: emailContent.emailText,
          });

          emailResults.push({
            userId: user.id,
            email: user.email,
            status: "sent",
          });

          emailLogs.push({
            userId: user.id,
            templateType,
            subject,
            result: { success: true },
          });
        } catch (emailError) {
          console.error("Failed to send email to:", user.email, emailError);
          const errorMessage = emailError instanceof Error ? emailError.message : "Unknown error";
          
          emailResults.push({
            userId: user.id,
            email: user.email,
            status: "failed",
            error: errorMessage,
          });

          emailLogs.push({
            userId: user.id,
            templateType,
            subject,
            result: { success: false, error: errorMessage },
          });
        }
      }

      // Log all emails in bulk
      if (emailLogs.length > 0) {
        await EmailLogger.logBulkEmails(emailLogs);
      }

      return Response.json({
        message: `Emails sent to ${emailResults.filter(r => r.status === "sent").length} users`,
        results: emailResults,
      });

    } catch (error) {
      console.error("Error sending expired subscription emails:", error);
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}