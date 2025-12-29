import prisma from "@/lib/prisma";
import authMiddleware from "@/lib/auth/authMiddleware";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/(billing)/trial/audit
 * Endpoint administrateur pour auditer les essais gratuits
 * Affiche tous les essais par utilisateur/email/IP pour détecter les abus
 */
export async function GET(request: NextRequest) {
  return await authMiddleware(request, async (user) => {
    // Vérifier que l'utilisateur est admin
    if (!user.admin) {
      return NextResponse.json(
        { success: false, message: "Accès administrateur requis" },
        { status: 403 }
      );
    }

    // Récupérer les statistiques des essais
    const stats = await prisma.$transaction(async (tx) => {
      // Total des essais créés (abonnements d'essai)
      const totalTrials = await tx.subscription.count({
        where: { isTrial: true }
      });
      
      // Essais actifs (non expirés)
      const activeTrials = await tx.subscription.count({
        where: { 
          isTrial: true,
          trialEnd: {
            gte: new Date()
          }
        }
      });
      
      // Essais expirés
      const expiredTrials = await tx.subscription.count({
        where: { 
          isTrial: true,
          trialEnd: {
            lt: new Date()
          }
        }
      });
      
      // Essais convertis en abonnements payants
      const convertedTrials = await tx.subscription.count({
        where: { 
          isTrial: true,
          trialConvertedAt: {
            not: null
          }
        }
      });
      
      // Détection des emails en doublon pour les essais
      const emailDuplicates = await tx.subscription.groupBy({
        by: ['userId'],
        where: { isTrial: true },
        having: {
          userId: {
            _count: {
              gt: 1
            }
          }
        },
        _count: {
          userId: true
        }
      });
      
      return {
        totalTrials,
        activeTrials,
        expiredTrials,
        convertedTrials,
        emailDuplicates: emailDuplicates.length,
        ipDuplicates: 0 // IP tracking not available in current schema
      };
    });

    // Récupérer les détails des essais suspects (utilisateurs avec multiples essais)
    const suspiciousUserIds = (await prisma.subscription.groupBy({
      by: ['userId'],
      where: { isTrial: true },
      having: {
        userId: {
          _count: {
            gt: 1
          }
        }
      }
    })).map(g => g.userId);

    const suspiciousTrials = await prisma.subscription.findMany({
      where: {
        isTrial: true,
        userId: {
          in: suspiciousUserIds
        }
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            createdAt: true
          }
        },
        plan: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: [
        { user: { email: 'asc' } },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json({
      success: true,
      stats,
      suspiciousTrials,
      message: `Audit des essais gratuits - ${stats.totalTrials} essais au total, ${suspiciousTrials.length} suspects détectés`
    });
  });
}