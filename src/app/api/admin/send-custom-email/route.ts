import adminMiddleware from "@/lib/auth/adminMiddleware";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import buildCustomMessageEmail from "@/lib/mail/emails/buildCustomMessageEmail";
import { EmailLogger } from "@/lib/utils/emailLogger";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const body = await request.json();
      const { userIds, subject, message, actionButton } = body;

      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return Response.json(
          { error: "userIds array is required" },
          { status: 400 }
        );
      }

      if (!message || typeof message !== "string") {
        return Response.json(
          { error: "message is required" },
          { status: 400 }
        );
      }

      const users = await prisma.user.findMany({
        where: {
          id: {
            in: userIds,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      const emailResults = [];
      const emailLogs = [];

      for (const user of users) {
        if (!user.email) {
          emailResults.push({
            userId: user.id,
            email: null,
            status: "skipped",
            error: "No email address",
          });
          continue;
        }

        try {
          const emailContent = buildCustomMessageEmail(user, {
            subject,
            message,
            actionButton,
          });

          await sendEmail({
            to: user.email,
            subject: emailContent.subject,
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
            templateType: "custom_message" as const,
            subject: emailContent.subject,
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
            templateType: "custom_message" as const,
            subject: subject || "Message personnalisé",
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
      console.error("Error sending custom emails:", error);
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}