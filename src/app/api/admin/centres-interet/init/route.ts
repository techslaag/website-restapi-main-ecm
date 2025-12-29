import adminMiddleware from "@/lib/auth/adminMiddleware";
import prisma from "@/lib/prisma";
import { serializeError } from "serialize-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/centres-interet/init
 * Initialize default centres d'intérêt
 */
export async function POST(request: Request) {
  return adminMiddleware(request, async (adminUser) => {
    try {
      // First, ensure category terms exist in WordPress taxonomy
      const categoryTerms = [
        {
          name: 'Rubriques',
          slug: 'rubriques',
          description: 'Rubriques éditoriales principales',
        },
        {
          name: 'Zones géographiques',
          slug: 'zones-geographiques',
          description: 'Couverture géographique par pays',
        },
        {
          name: 'Autres',
          slug: 'autres',
          description: 'Autres centres d\'intérêt',
        }
      ];

      // Create or update category terms and taxonomy entries
      const categoryIds: Record<string, bigint> = {};
      for (const termData of categoryTerms) {
        // Create or find the term
        let term = await prisma.mod180_terms.findFirst({
          where: { slug: termData.slug }
        });
        
        if (!term) {
          term = await prisma.mod180_terms.create({
            data: {
              name: termData.name,
              slug: termData.slug,
              term_group: BigInt(0),
            }
          });
        }

        // Create or find the taxonomy entry
        let taxonomy = await prisma.mod180_term_taxonomy.findFirst({
          where: {
            term_id: term.term_id,
            taxonomy: 'category'
          }
        });

        if (!taxonomy) {
          taxonomy = await prisma.mod180_term_taxonomy.create({
            data: {
              term_id: term.term_id,
              taxonomy: 'category',
              description: termData.description,
              parent: BigInt(0),
              count: BigInt(0),
            }
          });
        }

        categoryIds[termData.slug] = taxonomy.term_taxonomy_id;
      }

      // Default centres d'intérêt grouped by categories
      const defaultInterests = [
        // Rubriques
        {
          name: "Personnalité EcoMatin de l'année",
          slug: "personnalite-ecomatin-annee",
          description: "Personnalités marquantes de l'année selon EcoMatin",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Business et entreprises",
          slug: "business-entreprises",
          description: "Actualités du monde des affaires et des entreprises",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Cameroun présidentielle",
          slug: "cameroun-presidentielle",
          description: "Actualités et analyses sur les élections présidentielles au Cameroun",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Banques et finance",
          slug: "banques-finance",
          description: "Secteur bancaire et financier",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Politiques publiques",
          slug: "politiques-publiques",
          description: "Politiques et mesures gouvernementales",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Mine et énergie",
          slug: "mine-energie",
          description: "Secteur minier et énergétique",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Conjoncture",
          slug: "conjoncture",
          description: "Analyse de la situation économique",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Opinions",
          slug: "opinions",
          description: "Tribunes et points de vue",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Communiqués",
          slug: "communiques",
          description: "Communiqués officiels et annonces",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Agro-industrie",
          slug: "agro-industrie",
          description: "Agriculture et industrie agroalimentaire",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Les marchés",
          slug: "les-marches",
          description: "Actualités des marchés financiers et commerciaux",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Aujourd'hui dans le journal",
          slug: "aujourdhui-journal",
          description: "Sommaire et highlights du journal du jour",
          groupeId: "rubriques",
          isActive: true,
        },
        {
          name: "Transport et Logistique",
          slug: "transport-logistique",
          description: "Secteur des transports et de la logistique",
          groupeId: "rubriques",
          isActive: true,
        },
        // Zones géographiques
        {
          name: "Cameroun",
          slug: "cameroun",
          description: "Actualités du Cameroun",
          groupeId: "zones-geographiques",
          isActive: true,
        },
        {
          name: "Gabon",
          slug: "gabon",
          description: "Actualités du Gabon",
          groupeId: "zones-geographiques",
          isActive: true,
        },
        {
          name: "Tchad",
          slug: "tchad",
          description: "Actualités du Tchad",
          groupeId: "zones-geographiques",
          isActive: true,
        },
        {
          name: "RCA",
          slug: "rca",
          description: "Actualités de République Centrafricaine",
          groupeId: "zones-geographiques",
          isActive: true,
        },
        {
          name: "Congo",
          slug: "congo",
          description: "Actualités du Congo",
          groupeId: "zones-geographiques",
          isActive: true,
        },
        {
          name: "Guinée Équatoriale",
          slug: "guinee-equatoriale",
          description: "Actualités de Guinée Équatoriale",
          groupeId: "zones-geographiques",
          isActive: true,
        },
        // Autres
        {
          name: "International",
          slug: "international",
          description: "Actualités internationales hors zone CEMAC",
          groupeId: "autres",
          isActive: true,
        },
        {
          name: "Sport",
          slug: "sport",
          description: "Actualités sportives",
          groupeId: "autres",
          isActive: true,
        },
        {
          name: "Culture et société",
          slug: "culture-societe",
          description: "Arts, culture et faits de société",
          groupeId: "autres",
          isActive: true,
        },
        {
          name: "Technologie",
          slug: "technologie",
          description: "Innovation et nouvelles technologies",
          groupeId: "autres",
          isActive: true,
        },
        {
          name: "Non classé",
          slug: "non-classe",
          description: "Articles et contenus non classés dans une catégorie spécifique",
          groupeId: "autres",
          isActive: true,
        }
      ];

      let createdCount = 0;
      let updatedCount = 0;

      for (const interestData of defaultInterests) {
        try {
          const existing = await prisma.interest.findUnique({
            where: { slug: interestData.slug }
          });

          if (existing) {
            await prisma.interest.update({
              where: { slug: interestData.slug },
              data: {
                name: interestData.name,
                description: interestData.description,
                groupeId: interestData.groupeId,
                categoryId: categoryIds[interestData.groupeId],
                isActive: interestData.isActive,
              }
            });
            updatedCount++;
          } else {
            await prisma.interest.create({
              data: {
                ...interestData,
                categoryId: categoryIds[interestData.groupeId],
              }
            });
            createdCount++;
          }
        } catch (error) {
          console.error(`Error processing interest ${interestData.name}:`, error);
        }
      }

      return Response.json({
        message: `Centres d'intérêt initialisés avec succès. ${createdCount} créés, ${updatedCount} mis à jour.`,
        summary: {
          created: createdCount,
          updated: updatedCount,
          total: defaultInterests.length
        }
      });

    } catch (error) {
      console.error("Error initializing centres d'intérêt:", error);
      return Response.json(serializeError(error), { status: 500 });
    }
  });
}