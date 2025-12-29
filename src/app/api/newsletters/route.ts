import adminMiddleware from "@/lib/auth/adminMiddleware";
import { getPaginatedResult } from "@/lib/utils/databaseUtils";
import { extractQueryParams } from "@/lib/utils/index";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminMiddleware(request, async (user) => {
    try {
      const queryParams: { page: string; limit: string } =
        extractQueryParams(request);

      const paginatedResponse = await getPaginatedResult(
        "Newsletter",
        Number(queryParams.page ?? 1),
        Number(queryParams.limit ?? 10),
        {
          orderBy: {
            name: "asc",
          },
        },
      );

      return Response.json(paginatedResponse);
    } catch (error) {
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}
