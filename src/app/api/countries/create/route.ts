import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { errorResponse, requestJsonBody } from "@/lib/utils/index";
import { Continent, Currency, PlanType } from "@prisma/client";
import { serializeError } from "serialize-error";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  countryName: z
    .string({ required_error: "Le nom est requis" })
    .min(5, "Le nom est requis")
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  isoCode2: z
    .string({ required_error: "Le code ISO2 est requis" })
    .length(2, "Le code ISO2 est doit être de deux caractères."),
  isoCode3: z
    .string({ required_error: "Le code ISO3 est requis" })
    .length(3, "Le code ISO3 est doit être de trois caractères."),
  numericCode: z
    .number({ required_error: "Le code numérique du pays est requis" })
    .positive("Un code numérique doit être un nombre positif."),
  capital: z.string().max(100, "La valeur ne peut pas excéder 100 caractères."),
  population: z
    .number()
    .positive("Une population  doit être un nombre positive."),
  area: z.number().positive("Une superficie doit être un nombre positive."),
  currencyCode: z
    .string({ required_error: "Le code de monnaie est requis" })
    .length(3, "Le code de monnaie doit être de trois caractères."),
  officialLanguage: z
    .string()
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  continent: z.enum([
    Continent.Europe,
    Continent.NordAmerica,
    Continent.SouthAmerica,
    Continent.Asia,
    Continent.Africa,
    Continent.Antarctica,
    Continent.Oceania,
  ]),
  timeZone: z
    .string()
    .max(100, "La valeur ne peut pas excéder 100 caractères."),
  callingCode: z
    .string()
    .max(10, "La valeur ne peut pas excéder 10 caractères."),
  internetTLD: z
    .string()
    .max(10, "La valeur ne peut pas excéder 10 caractères."),
  gdp: z
    .number()
    .positive("Un Produit intérieur brut doit être un nombre positive."),
  hdi: z.number(),
});

export async function POST(req: Request) {
  return adminMiddleware(req, async (user) => {
    try {
      const bodyPayload = createSchema.parse(await requestJsonBody(req));

      // create the plan
      const country = await prisma.country.create({
        data: {
          countryName: bodyPayload.countryName,
          isoCode2: bodyPayload.isoCode2,
          isoCode3: bodyPayload.isoCode3,
          numericCode: bodyPayload.numericCode,
          capital: bodyPayload.capital,
          population: bodyPayload.population,
          area: bodyPayload.area,
          currencyCode: bodyPayload.currencyCode,
          officialLanguage: bodyPayload.officialLanguage,
          continent: bodyPayload.continent,
          timeZone: bodyPayload.timeZone,
          callingCode: bodyPayload.callingCode,
          internetTLD: bodyPayload.internetTLD,
          gdp: bodyPayload.gdp,
          hdi: bodyPayload.hdi,
          updatedAt: new Date(),
        },
      });

      return Response.json(country);
    } catch (error) {
      return errorResponse(serializeError(error), { status: 500 });
    }
  });
}
