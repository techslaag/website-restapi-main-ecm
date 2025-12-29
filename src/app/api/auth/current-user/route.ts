import authMiddleware from "@/lib/auth/authMiddleware";
import { excludeProps } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return authMiddleware(request, (user) => {
    return Response.json(excludeProps(user, ["password"]));
  });
}
