import { NextRequest, NextResponse } from 'next/server';
import { generateMobileAppPromotionMessage, shouldShowMobileAppPromotion } from '@/lib/utils/mobileAppPromotionUtils';
import IPost from '@/interfaces/IPost';

export const dynamic = "force-dynamic";

/**
 * Test endpoint for mobile app promotion feature
 * GET /api/posts/mobile-app-promotion/test
 */
export async function GET(req: NextRequest) {
  try {
    // Create test posts with different prestige levels
    const testPosts: Partial<IPost>[] = [
      {
        id: '1',
        title: 'Article Premium Test',
        postPrestige: 'premium',
        price: '3'
      },
      {
        id: '2', 
        title: 'Article EcoMembre Test',
        postPrestige: 'ecomembre',
        price: '5'
      },
      {
        id: '3',
        title: 'Article Gratuit Test',
        postPrestige: 'gratuit',
        price: '0'
      },
      {
        id: '4',
        title: 'Article Payant Test',
        postPrestige: null,
        price: '2'
      }
    ];

    const results = testPosts.map(post => ({
      post,
      shouldShowPromotion: shouldShowMobileAppPromotion(post as IPost),
      promotion: shouldShowMobileAppPromotion(post as IPost) 
        ? generateMobileAppPromotionMessage(post as IPost)
        : null
    }));

    return NextResponse.json({
      success: true,
      message: "Mobile app promotion test results",
      data: {
        testResults: results,
        summary: {
          totalPosts: testPosts.length,
          postsWithPromotion: results.filter(r => r.shouldShowPromotion).length,
          postsWithoutPromotion: results.filter(r => !r.shouldShowPromotion).length
        }
      }
    });

  } catch (error) {
    console.error('[MobileAppPromotionTest] Error testing mobile app promotion:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to test mobile app promotion feature',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}