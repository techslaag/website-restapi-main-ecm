import adminMiddleware from "@/lib/auth/adminMiddleware";
import { EmailLogger } from "@/lib/utils/emailLogger";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const url = new URL(request.url);
      const searchParams = url.searchParams;

      const userId = params.id;
      
      const filters = {
        userId,
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
      console.error(`Error fetching email history for user ${params.id}:`, error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}