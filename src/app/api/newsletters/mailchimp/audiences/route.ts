import IPaginateResponse from "@/interfaces/IPaginateResponse";
import adminMiddleware from "@/lib/auth/adminMiddleware";
import mailchimp, { isMailchimpErrorResponse } from "@/lib/mailchimp";
import { extractQueryParams } from "@/lib/utils/index";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return adminMiddleware(request, async (user) => {
    try {
      const queryParams: { page?: string; limit?: string } =
        extractQueryParams(request);
      const page = Number(queryParams.page ?? 1);
      const limit = Number(queryParams.limit ?? 100);

      const response = await mailchimp.lists.getAllLists({
        count: limit,
        offset: (page - 1) * limit,
      });

      // request has failed
      if (isMailchimpErrorResponse(response)) {
        const { detail, ...restError } = response as mailchimp.ErrorResponse;

        return Response.json({
          message: detail,
          error: restError,
        });
      } else {
        const data = response as mailchimp.lists.ListsSuccessResponse;

        return Response.json({
          page,
          limit,
          total: data.total_items,
          items: data.lists.map(({ id, name }) => ({
            id,
            name,
          })),
        } as IPaginateResponse<any>);
      }
    } catch (error) {
      return Response.json(serializeError(error), {
        status: 500,
      });
    }
  });
}
