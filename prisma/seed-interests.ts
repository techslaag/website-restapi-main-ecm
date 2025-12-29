import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const interests = [
  {
    name: "Banques et Finance",
    slug: "banques-finance",
    groupeId: "rubriques",
    order: 0,
    description: "Actualités et analyses du secteur bancaire et financier"
  },
  {
    name: "Marchés Financiers",
    slug: "marches-financiers",
    groupeId: "rubriques",
    order: 1,
    description: "Évolution des marchés boursiers et financiers"
  },
  {
    name: "Politiques Publiques",
    slug: "politiques-publiques",
    groupeId: "rubriques",
    order: 2,
    description: "Décisions gouvernementales et politiques économiques"
  },
  {
    name: "Conjoncture Économique",
    slug: "conjoncture",
    groupeId: "rubriques",
    order: 3,
    description: "Analyses macroéconomiques et indicateurs"
  },
  {
    name: "Business et Entreprises",
    slug: "business-entreprises",
    groupeId: "rubriques",
    order: 4,
    description: "Actualités des entreprises et du monde des affaires"
  },
  {
    name: "Mines et Énergies",
    slug: "mines-energies",
    groupeId: "rubriques",
    order: 5,
    description: "Secteur minier et énergétique"
  },
  {
    name: "Télécoms et Tech",
    slug: "telecoms-tech",
    groupeId: "rubriques",
    order: 6,
    description: "Technologies et télécommunications"
  },
  {
    name: "Agriculture et Agrobusiness",
    slug: "agriculture",
    groupeId: "rubriques",
    order: 7,
    description: "Secteur agricole et agro-industriel"
  },
  {
    name: "Opinions et Analyses",
    slug: "opinions",
    groupeId: "rubriques",
    order: 8,
    description: "Tribunes et analyses d'experts"
  },
  {
    name: "Cameroun",
    slug: "cameroun",
    groupeId: "zones-geographiques",
    order: 0,
    description: "Actualités économiques du Cameroun"
  },
  {
    name: "Gabon",
    slug: "gabon",
    groupeId: "zones-geographiques",
    order: 1,
    description: "Actualités économiques du Gabon"
  },
  {
    name: "Tchad",
    slug: "tchad",
    groupeId: "zones-geographiques",
    order: 2,
    description: "Actualités économiques du Tchad"
  },
  {
    name: "RCA",
    slug: "rca",
    groupeId: "zones-geographiques",
    order: 3,
    description: "Actualités économiques de la République Centrafricaine"
  },
  {
    name: "Congo",
    slug: "congo",
    groupeId: "zones-geographiques",
    order: 4,
    description: "Actualités économiques du Congo"
  },
  {
    name: "Guinée Équatoriale",
    slug: "guinee-equatoriale",
    groupeId: "zones-geographiques",
    order: 5,
    description: "Actualités économiques de la Guinée Équatoriale"
  },
  {
    name: "Innovation",
    slug: "innovation",
    groupeId: "autres",
    order: 0,
    description: "Innovations et nouvelles technologies"
  }
];

async function seedInterests() {
  console.log('🌱 Début du seeding des centres d\'intérêt...');
  
  for (const interest of interests) {
    try {
      const created = await prisma.interest.upsert({
        where: { slug: interest.slug },
        update: {
          name: interest.name,
          description: interest.description,
          groupeId: interest.groupeId,
          order: interest.order,
          isActive: true,
        },
        create: interest,
      });
      console.log(`✅ Centre d'intérêt créé/mis à jour : ${created.name}`);
    } catch (error) {
      console.error(`❌ Erreur pour ${interest.name}:`, error);
    }
  }
  
  console.log('✨ Seeding terminé !');
}

seedInterests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });