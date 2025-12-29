/**
 * Test script for Apple JWT verification
 * 
 * This script allows testing the JWT verification implementation
 * with sample Apple App Store Server Notification JWTs.
 */

import { verifyAppleJWT, verifyAppleJWTUnsafe } from './jwtVerification';

/**
 * Test the JWT verification with a sample JWT
 * 
 * Note: This is a placeholder for testing. In real scenarios,
 * you would need actual Apple S2S notification JWTs to test with.
 */
export async function testAppleJWTVerification() {
  console.log('🧪 Testing Apple JWT Verification...');
  
  // This is a mock JWT for testing structure
  // Real Apple JWTs would come from actual notifications
  const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  
  console.log('Testing with mock JWT (expected to fail)...');
  
  try {
    // Test strict verification
    const strictResult = await verifyAppleJWT(mockJWT);
    console.log('Strict verification result:', strictResult);
    
    // Test unsafe verification
    const unsafeResult = await verifyAppleJWTUnsafe(mockJWT);
    console.log('Unsafe verification result:', unsafeResult);
    
  } catch (error) {
    console.error('Test error:', error);
  }
  
  console.log('✅ Test completed');
}

/**
 * Validate JWT structure without verification
 */
export function validateJWTStructure(jwt: string): { valid: boolean; error?: string } {
  try {
    const parts = jwt.split('.');
    
    if (parts.length !== 3) {
      return { valid: false, error: 'JWT must have 3 parts' };
    }
    
    // Try to decode header
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    
    // Check for Apple-specific requirements
    if (!header.x5c) {
      return { valid: false, error: 'Missing x5c certificate chain in header' };
    }
    
    if (!Array.isArray(header.x5c) || header.x5c.length === 0) {
      return { valid: false, error: 'x5c must be a non-empty array' };
    }
    
    if (header.alg !== 'ES256') {
      console.warn('⚠️ Algorithm is not ES256:', header.alg);
    }
    
    return { valid: true };
    
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Extract certificate information from JWT header for debugging
 */
export function extractCertificateInfo(jwt: string): any {
  try {
    const parts = jwt.split('.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    
    if (!header.x5c || !Array.isArray(header.x5c)) {
      return { error: 'No certificate chain found' };
    }
    
    return {
      algorithm: header.alg,
      certificateCount: header.x5c.length,
      certificates: header.x5c.map((cert: string, index: number) => ({
        index,
        length: cert.length,
        preview: cert.substring(0, 50) + '...'
      }))
    };
    
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to extract info'
    };
  }
}

// Export for use in other test files
export default {
  testAppleJWTVerification,
  validateJWTStructure,
  extractCertificateInfo
};