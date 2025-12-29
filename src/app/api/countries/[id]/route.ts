import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";
import ICountry, { toICountry } from "@/interfaces/ICountry";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params: { id: countryId } }: { params: { id: string } },
) {
  const country = await prisma.country.findUnique({
    where: { id: countryId },
  });

  // plan exists
  if (country) {
    return Response.json(toSafeJSON<ICountry>(toICountry(country)));
  } else {
    return Response.json(
      {
        message: "Pays introuvable.",
      },
      { status: 200 },
    );
  }
}
