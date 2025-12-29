import IPostAuthor, { toIPostAuthor } from "@/interfaces/IPostAuthor";
import prisma from "@/lib/prisma";
import { isNumeric, toSafeJSON } from "@/lib/utils/index";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { idOrSlug } }: { params: { idOrSlug: string } }
) {
  const data = await prisma.mod180_users.findFirst({
    where: {
      OR: [
        isNumeric(idOrSlug)
          ? { ID: BigInt(idOrSlug) }
          : { user_nicename: idOrSlug },
      ],
    },
    select: {
      ID: true,
      display_name: true,
      user_nicename: true,
    },
  });

  if (data) {
    return Response.json(toSafeJSON<IPostAuthor>(toIPostAuthor(data)));
  } else {
    return Response.json({ message: "Tag  not found." }, { status: 404 });
  }
}
