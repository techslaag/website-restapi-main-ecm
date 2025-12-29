import adminMiddleware from "@/lib/auth/adminMiddleware";
import { EmailLogger } from "@/lib/utils/emailLogger";
import { EmailTemplate } from "@prisma/client";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const url = new URL(request.url);
      const searchParams = url.searchParams;

      const filters = {
        userId: searchParams.get("userId") || undefined,
        templateType: searchParams.get("templateType") as EmailTemplate || undefined,
        status: searchParams.get("status") || undefined,
        startDate: searchParams.get("startDate") 
          ? new Date(searchParams.get("startDate")!) 
          : undefined,
        endDate: searchParams.get("endDate") 
          ? new Date(searchParams.get("endDate")!) 
          : undefined,
        page: searchParams.get("page") 
          ? parseInt(searchParams.get("page")!) 
          : 1,
        limit: searchParams.get("limit") 
          ? parseInt(searchParams.get("limit")!) 
          : 50,
      };

      const emailLogs = await EmailLogger.getEmailLogs(filters);

      return Response.json(emailLogs);
    } catch (error) {
      console.error("Error fetching email logs:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}