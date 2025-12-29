import prisma from "@/lib/prisma";
import { activeSubscriptionWhereInput, subscriptionPublicSelectInput } from "@/lib/utils/subscriptionUtils";
import { toSafeJSON, extractQueryParams } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Check API key authentication
    const apiKey = req.headers.get("x-api-key");
    const expectedApiKey = process.env.FINANCEWEEK_API_KEY;

    if (!apiKey || !expectedApiKey || apiKey !== expectedApiKey) {
      return Response.json(
        { message: "Unauthorized - Invalid or missing API key" },
        { status: 401 }
      );
    }

    const queryParams = extractQueryParams(req);
    const email = queryParams.email as string;

    if (!email) {
      return Response.json(
        { message: "Email parameter is required" },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return Response.json(
        toSafeJSON({
          user: null,
          hasActiveSubscription: false,
          subscription: null
        })
      );
    }

    // Check for active subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        ...activeSubscriptionWhereInput,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: subscriptionPublicSelectInput,
    });

    return Response.json(
      toSafeJSON({
        user,
        hasActiveSubscription: !!subscription,
        subscription
      })
    );
  } catch (error) {
    console.error("Subscription status API error:", error);
    return Response.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}