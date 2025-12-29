import { NextRequest } from 'next/server';
import mailchimpService from "@/lib/services/mailchimpService";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/mailchimp/lists - Récupérer toutes les listes Mailchimp
export async function GET(req: NextRequest) {
  try {
    const lists = await mailchimpService.getLists();

    return Response.json(toSafeJSON({
      lists: lists.map((list: any) => ({
        id: list.id,
        name: list.name,
        stats: list.stats,
        date_created: list.date_created,
        list_rating: list.list_rating
      }))
    }));

  } catch (error) {
    console.error('Error fetching Mailchimp lists:', error);
    return Response.json(
      { error: 'Failed to fetch Mailchimp lists' },
      { status: 500 }
    );
  }
}