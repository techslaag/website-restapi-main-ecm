import mailchimp, { isMailchimpErrorResponse } from "@/lib/mailchimp";
import prisma from "@/lib/prisma";
import { errorResponse, getClientIp } from "@/lib/utils/index";
import { createHash } from "crypto";
import moment from "moment";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, name, locale = "fr" } = body;

    // Validate required fields
    if (!email || !email.includes("@")) {
      return Response.json(
        { 
          message: "Adresse email valide requise",
          success: false 
        },
        { status: 400 }
      );
    }

    // Use the "Abonnés EcoMatin" audience directly
    const audienceId = "9edbc99452"; // Abonnés EcoMatin list ID

    // Get user IP address
    const userIpAddress = request.headers.get("x-user-ip") ?? getClientIp(request);
    
    // Check if Mailchimp is configured
    if (!process.env.MAILCHIMP_API_KEY || !process.env.MAILCHIMP_SERVER_PREFIX) {
      console.error("Mailchimp not configured - missing API key or server prefix");
      return Response.json(
        { 
          message: "Service de newsletter non configuré",
          success: false 
        },
        { status: 500 }
      );
    }
    
    try {
      // Subscribe to Mailchimp
      const response = await mailchimp.lists.addListMember(
        audienceId,
        {
          email_address: email,
          status: "subscribed",
          language: locale,
          ip_opt: userIpAddress,
          ip_signup: userIpAddress,
          timestamp_opt: moment().format(),
          timestamp_signup: moment().format(),
          merge_fields: {
            FNAME: name || "",
          },
        },
      );

      if (isMailchimpErrorResponse(response)) {
        const { detail, status } = response as mailchimp.ErrorResponse;
        
        // Handle already subscribed case
        if (status === 400 && detail?.includes("already subscribed")) {
          return Response.json(
            { 
              message: "Cette adresse email est déjà abonnée à notre newsletter",
              success: true 
            },
            { status: 200 }
          );
        }

        throw {
          message: detail || "Erreur lors de l'inscription",
          error: response,
        };
      }

      // Success response
      return Response.json(
        { 
          message: "Inscription réussie ! Vous recevrez notre briefing économique quotidien",
          success: true 
        },
        { status: 201 }
      );

    } catch (mailchimpError: any) {
      
      // Handle specific Mailchimp errors
      const errorDetail = mailchimpError?.response?.body?.detail || mailchimpError?.message || "";
      
      if (errorDetail.includes("already subscribed") || errorDetail.includes("already a list member")) {
        return Response.json(
          { 
            message: "Cette adresse email est déjà abonnée à notre newsletter",
            success: true 
          },
          { status: 200 }
        );
      }

      // More detailed error message
      const errorMessage = mailchimpError?.response?.body?.detail || 
                          mailchimpError?.message || 
                          "Erreur lors de l'inscription. Veuillez réessayer plus tard";
      
      return Response.json(
        { 
          message: errorMessage,
          success: false,
          debug: process.env.NODE_ENV === 'development' ? serializeError(mailchimpError) : undefined
        },
        { status: 500 }
      );
    }

  } catch (error) {
    
    return errorResponse(
      {
        message: "L'opération a échoué. Merci de réessayer plus tard",
        success: false,
        error: serializeError(error),
      },
      { status: 500 }
    );
  }
}