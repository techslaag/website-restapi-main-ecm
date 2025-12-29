import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/mail";
import buildSubscriptionReminderEmail from "@/lib/mail/emails/buildSubscriptionReminderEmail";
import moment from "moment";
import { NextRequest, NextResponse } from "next/server";

// Pour éviter les doublons, on pourrait stocker les rappels envoyés dans une table dédiée (non inclus ici)
export const dynamic = "force-dynamic";
export const maxDuration = 300; // 30 minutes (1800 seconds)

export async function GET(req: NextRequest) {
  console.log(`[${new Date().toISOString()}] Subscription reminder cron job started`);
  
  // Vérification de sécurité pour GitHub Actions
  // const authHeader = req.headers.get("authorization");
  // const expectedToken = `Bearer ${process.env.GITHUB_ACTIONS_TOKEN}`;
  
  // if (!authHeader || authHeader !== expectedToken) {
  //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // }

  const today = moment();
  const daysToCheck = [30, 7, 3];
  let remindersSent = 0;
  const emailsSent: string[] = []; // <-- Ajout

  // Utiliser select pour éviter l'erreur Prisma sur les relations manquantes
  const subscriptions = await prisma.subscription.findMany({
    where: {
      period: "year",
      expiresAt: {
        gt: today.toDate(),
      },
      payment: {
        status: "succeeded",
      },
      user: {
        // Ce filtre garantit que l'user existe
        NOT: {
          id: undefined,
        },
      },
      plan: {
        NOT: {
          id: undefined,
        },
      },
    },
    select: {
      id: true,
      expiresAt: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
      plan: {
        select: {
          title: true,
        },
      },
    },
  });

  // On ignore les abonnements orphelins (sans user ou plan)
  const validSubscriptions = subscriptions.filter(sub => sub.user && sub.plan);

  for (const sub of validSubscriptions) {
    const expiresAt = moment(sub.expiresAt);
    const daysLeft = expiresAt.diff(today, "days");

    if (daysToCheck.includes(daysLeft)) {
      // Adapter l'objet passé au template d'email (on ne garde que les champs ucommtilisés)
      const fakeSubscription = {
        expiresAt: sub.expiresAt,
        user: { name: sub.user.name, email: sub.user.email },
        plan: { title: sub.plan.title },
      };
      const { emailHtml, emailText } = buildSubscriptionReminderEmail(fakeSubscription as any, daysLeft);
      await sendEmail({
        to: sub.user.email!,
        subject: `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`,
        html: emailHtml,
        text: emailText,
      });
      remindersSent++;
      emailsSent.push(sub.user.email!); // <-- Ajout
    }
  }

  console.log(`[${new Date().toISOString()}] Subscription reminder cron job completed. Reminders sent: ${remindersSent}`);
  return Response.json({ remindersSent, emailsSent });
} 