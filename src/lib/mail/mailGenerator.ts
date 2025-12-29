import Mailgen from "mailgen";

export default function getMailGenerator() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_FRONT_APP_URL || "https://ecomatin.net";
  const logoUrl = `${baseUrl}/logo.png`;
  
  return new Mailgen({
    theme: "default",
    product: {
      name: process.env.NEXT_PUBLIC_APP_NAME ?? "EcoMatin",
      link: process.env.NEXT_PUBLIC_FRONT_APP_URL ?? "https://ecomatin.net",
      logo: logoUrl,
      logoHeight: "54px",
      copyright: `© ${new Date().getFullYear()} ${process.env.NEXT_PUBLIC_APP_NAME ?? "EcoMatin"}. Tous droits réservés.`,
    },
  });
}
