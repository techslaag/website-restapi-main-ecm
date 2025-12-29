import { NextRequest, NextResponse } from 'next/server';

/**
 * @swagger
 * /test-env-vars:
 *   get:
 *     summary: Test environment variables configuration
 *     description: Checks if critical environment variables are properly set for development and testing
 *     tags:
 *       - Development
 *       - Testing
 *     responses:
 *       200:
 *         description: Environment variables status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 envVars:
 *                   type: object
 *                   properties:
 *                     STRIPE_SECRET_KEY:
 *                       type: string
 *                     STRIPE_WEBHOOK_SECRET:
 *                       type: string
 *                     DATABASE_URL:
 *                       type: string
 *                     MYCOOLPAY_API_URL:
 *                       type: string
 *                 systemInfo:
 *                   type: object
 *                   properties:
 *                     nodeVersion:
 *                       type: string
 *                     environment:
 *                       type: string
 *                     timestamp:
 *                       type: string
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return testEnvVars();
}

export async function POST() {
  return testEnvVars();
}

function testEnvVars() {
  try {
    // Check critical environment variables
    const envVars = {
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'SET' : 'NOT_SET',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ? 'SET' : 'NOT_SET',
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
      MYCOOLPAY_API_URL: process.env.MYCOOLPAY_API_URL ? 'SET' : 'NOT_SET',
      FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY ? 'SET' : 'NOT_SET',
      FLUTTERWAVE_PUBLIC_KEY: process.env.FLUTTERWAVE_PUBLIC_KEY ? 'SET' : 'NOT_SET',
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT_SET',
      EMAIL_SERVER_HOST: process.env.EMAIL_SERVER_HOST ? 'SET' : 'NOT_SET'
    };

    // Add partial values for debugging (first few chars only for security)
    const envVarsWithPartial = Object.entries(envVars).reduce((acc, [key, status]) => {
      if (status === 'SET') {
        const fullValue = process.env[key];
        if (fullValue) {
          const partialValue = fullValue.length > 10 
            ? `${fullValue.substring(0, 8)}...` 
            : `${fullValue.substring(0, 3)}...`;
          acc[key] = `SET (${partialValue})`;
        } else {
          acc[key] = 'SET';
        }
      } else {
        acc[key] = 'NOT_SET';
      }
      return acc;
    }, {} as Record<string, string>);

    const systemInfo = {
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      nextjsVersion: process.env.npm_package_version || 'unknown'
    };

    return NextResponse.json({
      success: true,
      envVars: envVarsWithPartial,
      systemInfo,
      debug: {
        totalEnvVars: Object.keys(process.env).length,
        criticalVarsSet: Object.values(envVars).filter(status => status === 'SET').length,
        criticalVarsTotal: Object.keys(envVars).length
      }
    });

  } catch (error) {
    console.error('Error testing environment variables:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check environment variables',
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}