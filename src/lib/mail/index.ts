import { createTransport, SendMailOptions, SentMessageInfo } from "nodemailer";
import { serializeError } from "serialize-error";
import { sanitizeEmail } from "../utils";

const emailServerPort = Number(process.env.EMAIL_SERVER_PORT ?? 587);

const transporter = createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: emailServerPort,
  secure: emailServerPort === 465,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export async function sendEmail(
  mailOptions: SendMailOptions,
  callback?: (err: any, info?: SentMessageInfo) => void,
) {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.NEXT_PUBLIC_APP_NAME ?? "EcoMatin"}" <${
        process.env.EMAIL_FROM
      }>`,
      ...mailOptions,
      to:
        typeof mailOptions.to === "string"
          ? sanitizeEmail(mailOptions.to)
          : mailOptions.to,
    });

    callback?.(null, info);
  } catch (error) {
    console.error("Erreur d'envoi d'email :", error); // <-- Ajoute ceci

    callback?.(serializeError(error));
  }
}
