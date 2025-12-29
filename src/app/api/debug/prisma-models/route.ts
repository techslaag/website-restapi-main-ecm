import { NextRequest } from 'next/server';
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/debug/prisma-models - Debug endpoint to check Prisma models
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Debugging Prisma models...');
    
    // Liste des modèles disponibles
    const availableModels = Object.keys(prisma).filter(key => 
      !key.startsWith('_') && 
      !key.startsWith('$') && 
      key !== 'constructor'
    );

    console.log('Available models:', availableModels);

    // Test des modèles d'automation
    const tests = [];

    // Test 1: Vérifier si automation existe
    try {
      const automationCount = await (prisma as any).automation?.count();
      tests.push({ model: 'automation', available: true, count: automationCount });
    } catch (error) {
      tests.push({ model: 'automation', available: false, error: (error as Error).message });
    }

    // Test 2: Vérifier si emailJob existe
    try {
      const emailJobCount = await (prisma as any).emailJob?.count();
      tests.push({ model: 'emailJob', available: true, count: emailJobCount });
    } catch (error) {
      tests.push({ model: 'emailJob', available: false, error: (error as Error).message });
    }

    // Test 3: Test direct SQL pour vérifier si les tables existent
    try {
      const tableCheck = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = DATABASE() 
        AND table_name IN ('Automation', 'EmailJob', 'EmailLog')
      `;
      tests.push({ test: 'sql_table_check', result: tableCheck });
    } catch (error) {
      tests.push({ test: 'sql_table_check', error: (error as Error).message });
    }

    return Response.json({
      availableModels,
      tests,
      clientInfo: {
        version: (prisma as any)._clientVersion,
        engineConfig: (prisma as any)._engineConfig
      }
    });

  } catch (error) {
    console.error('❌ Error debugging Prisma models:', error);
    return Response.json(
      { error: 'Failed to debug Prisma models', details: (error as Error).message },
      { status: 500 }
    );
  }
}