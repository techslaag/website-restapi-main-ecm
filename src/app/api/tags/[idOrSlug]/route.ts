import IPostTag, { toIPostTag } from "@/interfaces/IPostTag";
import prisma from "@/lib/prisma";
import { isNumeric, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { idOrSlug } }: { params: { idOrSlug: string } },
) {
  const data = await prisma.mod180_term_taxonomy.findFirst({
    where: {
      OR: [
        isNumeric(idOrSlug)
          ? { term_id: BigInt(idOrSlug) }
          : { term: { slug: idOrSlug } },
      ],
      taxonomy: "post_tag",
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

  if (data) {
    return Response.json(toSafeJSON<IPostTag>(toIPostTag(data)));
  } else {
    return Response.json({ message: "Tag  not found." }, { status: 404 });
  }
}
