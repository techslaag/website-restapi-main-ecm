import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";
import { toSafeJSON } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/automations - Récupérer toutes les automations
export async function GET(req: NextRequest) {
  try {
    const automations = await prisma.automation.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    return Response.json(toSafeJSON({
      automations
    }));

  } catch (error) {
    console.error('Error fetching automations:', error);
    return Response.json(
      { error: 'Failed to fetch automations' },
      { status: 500 }
    );
  }
}

// POST /api/automations - Créer ou activer une automation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, active, settings } = body;

    // Vérifier si l'automation existe déjà
    const existingAutomation = await prisma.automation.findFirst({
      where: { type }
    });

    let automation;

    if (existingAutomation) {
      // Mettre à jour l'automation existante
      automation = await prisma.automation.update({
        where: { id: existingAutomation.id },
        data: {
          active,
          settings: settings ? JSON.stringify(settings) : undefined,
          updatedAt: new Date()
        }
      });
    } else {
      // Créer une nouvelle automation
      automation = await prisma.automation.create({
        data: {
          name,
          type,
          active,
          settings: settings ? JSON.stringify(settings) : undefined
        }
      });
    }

    return Response.json(toSafeJSON({
      automation,
      message: existingAutomation ? 'Automation updated' : 'Automation created'
    }));

  } catch (error) {
    console.error('Error creating/updating automation:', error);
    return Response.json(
      { error: 'Failed to create/update automation' },
      { status: 500 }
    );
  }
}