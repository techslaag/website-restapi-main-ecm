import { Subscription, Plan, User } from "@prisma/client";
import mailGenerator from "../mailGenerator";
import moment from "moment";

interface TrialSubscription extends Subscription {
  plan: Plan;
  user: User;
}

export async function buildTrialStartedEmail(subscription: TrialSubscription) {
  const { plan, user, trialEnd } = subscription;
  
  const trialEndFormatted = moment(trialEnd).format("DD/MM/YYYY à HH:mm");
  const daysRemaining = moment(trialEnd).diff(moment(), 'days');

  const email = {
    body: {
      name: user.name || "Cher lecteur",
      intro: [
        `🎉 <strong>Félicitations !</strong> Votre essai gratuit EcoMatin Premium a été activé avec succès.`,
        `Vous avez maintenant accès à tous nos contenus exclusifs pendant <strong>${daysRemaining} jours</strong>.`
      ],
      table: {
        data: [
          {
            item: "Plan d'abonnement",
            description: plan.title,
          },
          {
            item: "Durée de l'essai", 
            description: `${daysRemaining} jours`,
          },
          {
            item: "Fin de l'essai",
            description: trialEndFormatted,
          },
          {
            item: "Accès premium",
            description: "Articles exclusifs, magazines numériques, analyses approfondies",
          }
        ],
        columns: {
          customWidth: {
            item: "30%",
            description: "70%",
          },
        },
      },
      action: {
        instructions: "Découvrez dès maintenant tous nos contenus premium :",
        button: {
          color: "#d11952", // Couleur EcoMatin
          text: "Accéder à mon espace premium",
          link: `${process.env.NEXT_PUBLIC_APP_URL}/member/dashboard`,
        },
      },
      outro: [
        `✨ <strong>Que pouvez-vous faire pendant votre essai ?</strong>`,
        `• Lire tous les articles premium et exclusifs`,
        `• Télécharger nos magazines numériques en avant-première`,
        `• Recevoir nos newsletters spécialisées`,
        `• Accéder aux analyses économiques approfondies`,
        `<br><br>`,
        `💡 <strong>Rappel important :</strong> Votre essai se termine automatiquement le ${trialEndFormatted}. Vous pourrez alors choisir de continuer avec un abonnement premium si vous le souhaitez.`,
        `<br>`,
        `📧 Vous recevrez un rappel quelques jours avant la fin de votre essai.`,
        `<br><br>`,
        `L'équipe EcoMatin vous souhaite une excellente découverte de nos contenus premium !`
      ],
      signature: "L'équipe EcoMatin",
    },
  };

  const emailBody = mailGenerator().generate(email);
  const emailText = mailGenerator().generatePlaintext(email);

  return {
    emailSubject: `🎉 Votre essai gratuit EcoMatin Premium a commencé !`,
    emailHtml: emailBody,
    emailText: emailText,
  };
}