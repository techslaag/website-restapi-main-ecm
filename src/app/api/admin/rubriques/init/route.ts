import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/rubriques/init
 * Initialize default rubriques
 */
export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      const defaultRubriques = [
        {
          name: "À la une",
          slug: "a-la-une",
          description: "Articles principaux et actualités importantes",
          color: "#dc2626", // red-600
          hasImageUrl: false,
          imageUrl: null,
          order: 1,
          isDefault: true
        },
        {
          name: "Personnalité EcoMatin de l'année",
          slug: "personnalite-ecomatin-annee",
          description: "Portraits et interviews des personnalités marquantes",
          color: "#7c3aed", // violet-600
          hasImageUrl: false,
          imageUrl: null,
          order: 2,
          isDefault: true
        },
        {
          name: "Business et entreprises",
          slug: "business-entreprises",
          description: "Actualités du monde des affaires et des entreprises",
          color: "#059669", // emerald-600
          hasImageUrl: false,
          imageUrl: null,
          order: 3,
          isDefault: true
        },
        {
          name: "Cameroun présidentielle",
          slug: "cameroun-presidentielle",
          description: "Actualités politiques et élections présidentielles",
          color: "#dc2626", // red-600
          hasImageUrl: false,
          imageUrl: null,
          order: 4,
          isDefault: true
        },
        {
          name: "Banques et finance",
          slug: "banques-finance",
          description: "Secteur bancaire et actualités financières",
          color: "#1d4ed8", // blue-700
          hasImageUrl: false,
          imageUrl: null,
          order: 5,
          isDefault: true
        },
        {
          name: "Politiques publiques",
          slug: "politiques-publiques",
          description: "Analyses des politiques gouvernementales",
          color: "#7c2d12", // orange-800
          hasImageUrl: false,
          imageUrl: null,
          order: 6,
          isDefault: true
        },
        {
          name: "Mine et énergie",
          slug: "mine-energie",
          description: "Secteur minier et énergétique",
          color: "#a3a3a3", // neutral-400
          hasImageUrl: false,
          imageUrl: null,
          order: 7,
          isDefault: true
        },
        {
          name: "Conjoncture",
          slug: "conjoncture",
          description: "Analyses économiques et conjoncturelles",
          color: "#6366f1", // indigo-500
          hasImageUrl: false,
          imageUrl: null,
          order: 8,
          isDefault: true
        },
        {
          name: "Opinions",
          slug: "opinions",
          description: "Tribunes libres et opinions d'experts",
          color: "#ea580c", // orange-600
          hasImageUrl: false,
          imageUrl: null,
          order: 9,
          isDefault: true
        }
      ];

      const results = [];

      for (const rubrique of defaultRubriques) {
        // Check if it already exists
        const existing = await prisma.rubrique.findFirst({
          where: {
            OR: [
              { name: rubrique.name },
              { slug: rubrique.slug }
            ]
          }
        });

        if (!existing) {
          const result = await prisma.rubrique.create({
            data: rubrique
          });
          results.push(result);
        } else {
          console.log(`Rubrique "${rubrique.name}" already exists, skipping...`);
        }
      }

      return Response.json({
        rubriques: results,
        message: `Initialized ${results.length} default rubriques`
      });

    } catch (error) {
      console.error("Error initializing rubriques:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}