/**
 * Apple App Store Server Notifications JWT Verification
 * 
 * Apple uses JWS (JSON Web Signatures) with x5c certificate chains
 * for App Store Server-to-Server notifications verification.
 * 
 * References:
 * - https://developer.apple.com/documentation/appstoreservernotifications
 * - https://www.apple.com/certificateauthority/
 */

import { jwtVerify, importX509, type JWTPayload } from 'jose';
import crypto from 'crypto';

/**
 * Apple Root CA G3 Certificate fingerprints for validation
 * Source: https://www.apple.com/certificateauthority/
 */
const APPLE_ROOT_CA_G3_FINGERPRINTS = [
  // Apple Root CA - G3 Root
  'C3846C24A8DA20C9252B9C5C6E12C13A38E83371AB61A8EFBCCBFDFFF2B8E9B5',
  // Backup/Alternative fingerprints can be added here
];

/**
 * Apple Intermediate CA patterns for App Store
 */
const APPLE_APP_STORE_INTERMEDIATE_PATTERNS = [
  /Apple Worldwide Developer Relations Certification Authority/,
  /Apple Intermediate/
];

export interface AppleJWTVerificationResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

/**
 * Verify Apple App Store Server Notification JWS
 */
export async function verifyAppleJWT(jws: string): Promise<AppleJWTVerificationResult> {
  try {
    console.log('[Apple JWT] Starting verification process');
    
    // Parse the JWS header to get the certificate chain
    const headerB64 = jws.split('.')[0];
    if (!headerB64) {
      return { valid: false, error: 'Invalid JWS format' };
    }

    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    
    if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
      return { valid: false, error: 'Missing or invalid x5c certificate chain' };
    }

    console.log('[Apple JWT] Found certificate chain with', header.x5c.length, 'certificates');

    // Validate the certificate chain
    const certificateValidation = await validateAppleCertificateChain(header.x5c);
    if (!certificateValidation.valid) {
      return { valid: false, error: certificateValidation.error };
    }

    // Extract the public key from the leaf certificate (first in x5c array)
    const leafCertPem = formatCertificatePEM(header.x5c[0]);
    
    // Import the public key
    const publicKey = await importX509(leafCertPem, header.alg || 'ES256');

    // Verify the JWS signature
    const { payload } = await jwtVerify(jws, publicKey, {
      algorithms: ['ES256'], // Apple uses ES256 for App Store notifications
    });

    console.log('[Apple JWT] Signature verification successful');

    return {
      valid: true,
      payload,
    };

  } catch (error) {
    console.error('[Apple JWT] Verification failed:', error);
    
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

/**
 * Validate Apple certificate chain
 */
async function validateAppleCertificateChain(x5cCerts: string[]): Promise<{ valid: boolean; error?: string }> {
  try {
    if (x5cCerts.length < 2) {
      return { valid: false, error: 'Certificate chain too short' };
    }

    // Convert all certificates to PEM format
    const pemCerts = x5cCerts.map(formatCertificatePEM);
    
    // Validate each certificate in the chain
    for (let i = 0; i < pemCerts.length; i++) {
      const cert = pemCerts[i];
      const certificate = crypto.X509Certificate ? new crypto.X509Certificate(cert) : null;
      
      if (!certificate) {
        return { valid: false, error: `Invalid certificate at position ${i}` };
      }

      // For the root certificate, check against Apple's known fingerprints
      if (i === pemCerts.length - 1) {
        const fingerprint = certificate.fingerprint256.replace(/:/g, '').toUpperCase();
        
        if (!APPLE_ROOT_CA_G3_FINGERPRINTS.includes(fingerprint)) {
          return { valid: false, error: 'Root certificate not from Apple CA' };
        }
      }

      // For intermediate certificates, check issuer patterns
      if (i > 0 && i < pemCerts.length - 1) {
        const subject = certificate.subject;
        const isAppleIntermediate = APPLE_APP_STORE_INTERMEDIATE_PATTERNS.some(
          pattern => pattern.test(subject)
        );
        
        if (!isAppleIntermediate) {
          console.warn('[Apple JWT] Warning: Intermediate certificate may not be Apple issued');
        }
      }

      // Validate certificate dates
      const now = new Date();
      const validFrom = new Date(certificate.validFrom);
      const validTo = new Date(certificate.validTo);
      
      if (now < validFrom || now > validTo) {
        return { valid: false, error: `Certificate at position ${i} is expired or not yet valid` };
      }
    }

    console.log('[Apple JWT] Certificate chain validation successful');
    return { valid: true };

  } catch (error) {
    console.error('[Apple JWT] Certificate validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Certificate validation failed',
    };
  }
}

/**
 * Format certificate to PEM format
 */
function formatCertificatePEM(base64Cert: string): string {
  const cert = base64Cert.replace(/\s/g, '');
  const formatted = cert.match(/.{1,64}/g)?.join('\n') || cert;
  return `-----BEGIN CERTIFICATE-----\n${formatted}\n-----END CERTIFICATE-----`;
}

/**
 * Simplified verification for development/testing
 * WARNING: This bypasses certificate chain validation
 */
export async function verifyAppleJWTUnsafe(jws: string): Promise<AppleJWTVerificationResult> {
  try {
    console.warn('[Apple JWT] Using UNSAFE verification - for development only!');
    
    const headerB64 = jws.split('.')[0];
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    
    if (!header.x5c || !Array.isArray(header.x5c) || header.x5c.length === 0) {
      return { valid: false, error: 'Missing x5c certificate chain' };
    }

    // Extract public key from leaf certificate without validation
    const leafCertPem = formatCertificatePEM(header.x5c[0]);
    const publicKey = await importX509(leafCertPem, header.alg || 'ES256');

    // Verify signature only
    const { payload } = await jwtVerify(jws, publicKey, {
      algorithms: ['ES256'],
    });

    return { valid: true, payload };

  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Verification failed',
    };
  }
}