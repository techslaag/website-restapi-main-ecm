import { NextRequest, NextResponse } from "next/server";
import { getPaymentsDueForRetry, processPaymentRetry } from "@/lib/utils/paymentRetryUtils";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 1800; // 30 minutes (1800 seconds)

/**
 * Cron job to process payment retries
 * Should be called periodically (e.g., every 5-10 minutes)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization (basic security)
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    console.log('Starting payment retry processing...');

    // Get payments that are due for retry
    const paymentsDue = await getPaymentsDueForRetry();
    
    if (paymentsDue.length === 0) {
      console.log('No payments due for retry');
      return NextResponse.json({
        success: true,
        message: 'No payments due for retry',
        processed: 0
      });
    }

    console.log(`Found ${paymentsDue.length} payments due for retry`);

    let successCount = 0;
    let failureCount = 0;
    const results = [];

    // Process each payment retry
    for (const payment of paymentsDue) {
      try {
        const success = await processPaymentRetry(payment);
        
        if (success) {
          successCount++;
          results.push({
            paymentId: payment.id,
            reference: payment.reference,
            status: 'retry_scheduled'
          });
        } else {
          failureCount++;
          results.push({
            paymentId: payment.id,
            reference: payment.reference,
            status: 'retry_failed'
          });
        }
      } catch (error) {
        failureCount++;
        console.error(`Failed to process retry for payment ${payment.id}:`, error);
        results.push({
          paymentId: payment.id,
          reference: payment.reference,
          status: 'retry_error',
          error: (error as Error).message
        });
      }
    }

    console.log(`Payment retry processing completed: ${successCount} successful, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      message: 'Payment retry processing completed',
      processed: paymentsDue.length,
      successful: successCount,
      failed: failureCount,
      results
    });

  } catch (error) {
    console.error('Error in payment retry cron job:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error",
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}

/**
 * Manual trigger for payment retry processing
 * Can be used for testing or manual intervention
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentId } = await request.json();
    
    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    // For manual triggers, you might want additional authentication
    // For now, we'll use the same cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get specific payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: { user: true }
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Process the retry
    const success = await processPaymentRetry(payment);

    return NextResponse.json({
      success,
      message: success ? 'Payment retry processed successfully' : 'Payment retry failed',
      paymentId,
      reference: payment.reference
    });

  } catch (error) {
    console.error('Error in manual payment retry:', error);
    
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: (error as Error).message
      },
      { status: 500 }
    );
  }
}