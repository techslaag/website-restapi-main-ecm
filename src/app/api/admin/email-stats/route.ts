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
        templateType: searchParams.get("templateType") as EmailTemplate || undefined,
        startDate: searchParams.get("startDate") 
          ? new Date(searchParams.get("startDate")!) 
          : undefined,
        endDate: searchParams.get("endDate") 
          ? new Date(searchParams.get("endDate")!) 
          : undefined,
      };

      const stats = await EmailLogger.getEmailStats(filters);

      return Response.json(stats);
    } catch (error) {
      console.error("Error fetching email stats:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}