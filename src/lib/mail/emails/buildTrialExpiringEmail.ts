import { Subscription, Plan, User } from "@prisma/client";
import mailGenerator from "../mailGenerator";
import moment from "moment";

interface TrialSubscription extends Subscription {
  plan: Plan;
  user: User;
}

export async function buildTrialExpiringEmail(subscription: TrialSubscription) {
  const { plan, user, trialEnd } = subscription;
  
  const trialEndFormatted = moment(trialEnd).format("DD/MM/YYYY à HH:mm");
  const daysRemaining = moment(trialEnd).diff(moment(), 'days');
  const hoursRemaining = moment(trialEnd).diff(moment(), 'hours');

  let timeMessage = "";
  if (daysRemaining > 0) {
    timeMessage = `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`;
  } else if (hoursRemaining > 0) {
    timeMessage = `${hoursRemaining} heure${hoursRemaining > 1 ? 's' : ''}`;
  } else {
    timeMessage = "quelques minutes";
  }

  const email = {
    body: {
      name: user.name || "Cher lecteur",
      intro: [
        `⏰ <strong>Rappel important :</strong> Votre essai gratuit EcoMatin Premium expire dans <strong>${timeMessage}</strong>.`,
        `Ne manquez pas l'occasion de continuer à profiter de tous nos contenus exclusifs !`
      ],
      table: {
        data: [
          {
            item: "Plan d'abonnement",
            description: plan.title,
          },
          {
            item: "Fin de l'essai", 
            description: trialEndFormatted,
          },
          {
            item: "Temps restant",
            description: timeMessage,
          },
          {
            item: "Prix mensuel",
            description: `${plan.monthlyPrice} FCFA/mois`,
          },
          {
            item: "Prix annuel",
            description: `${plan.yearlyPrice} FCFA/an (2 mois offerts)`,
          }
        ],
        columns: {
          customWidth: {
            item: "35%",
            description: "65%",
          },
        },
      },
      action: {
        instructions: "Continuez votre expérience premium dès maintenant :",
        button: {
          color: "#d11952", // Couleur EcoMatin
          text: "Continuer avec Premium",
          link: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/convert-trial?sub=${subscription.id}`,
        },
      },
      outro: [
        `🎯 <strong>Pourquoi continuer avec EcoMatin Premium ?</strong>`,
        `• Accès illimité aux articles exclusifs et analyses approfondies`,
        `• Magazines numériques en avant-première chaque mois`,
        `• Newsletters spécialisées sur l'économie camerounaise`,
        `• Support de notre équipe éditoriale`,
        `<br><br>`,
        `💰 <strong>Offre spéciale :</strong> Économisez 2 mois avec l'abonnement annuel !`,
        `<br>`,
        `📅 <strong>Attention :</strong> Après le ${trialEndFormatted}, vous n'aurez plus accès aux contenus premium.`,
        `<br><br>`,
        `Questions ? Répondez simplement à cet email, nous sommes là pour vous aider !`
      ],
      signature: "L'équipe EcoMatin",
    },
  };

  const emailBody = mailGenerator().generate(email);
  const emailText = mailGenerator().generatePlaintext(email);

  return {
    emailSubject: `⏰ Votre essai EcoMatin Premium expire ${daysRemaining <= 1 ? 'aujourd\'hui' : `dans ${timeMessage}`} !`,
    emailHtml: emailBody,
    emailText: emailText,
  };
}