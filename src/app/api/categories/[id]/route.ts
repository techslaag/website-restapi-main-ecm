import IPostCategory, { toIPostCategory } from "@/interfaces/IPostCategory";
import prisma from "@/lib/prisma";
import { isNumeric, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: idOrSlug } }: { params: { id: string } }
) {
  const category = await prisma.mod180_term_taxonomy.findFirst({
    where: {
      OR: [
        isNumeric(idOrSlug)
          ? { term_id: BigInt(idOrSlug) }
          : { term: { slug: idOrSlug } },
      ],
      taxonomy: "category",
    },
    select: {
      taxonomy: true,
      count: true,
      description: true,
      term: {
        select: {
          term_id: true,
          name: true,
          slug: true,
        },
      },
    },
  });

  if (category) {
    return Response.json(toSafeJSON<IPostCategory>(toIPostCategory(category)));
  } else {
    return Response.json({ message: "Category  not found." }, { status: 404 });
  }
}
