/**
 * Generate Apple App Store Server API JWT Token
 *
 * This script generates a JWT token for calling Apple's App Store Server API
 * including the test notification endpoint.
 *
 * Required environment variables:
 * - APPLE_KEY_ID: Your API Key ID from App Store Connect (10 characters)
 * - APPLE_ISSUER_ID: Your Issuer ID from App Store Connect (UUID format)
 * - APPLE_PRIVATE_KEY: Contents of your .p8 private key file
 * - APPLE_BUNDLE_ID: Your app's bundle ID (e.g., com.ecomatin.app)
 *
 * Usage:
 *   npx ts-node src/lib/apple/generateServerAPIToken.ts
 */

import { SignJWT } from 'jose';
import crypto from 'crypto';

// Configuration - set these in your .env file
const APPLE_KEY_ID = process.env.APPLE_KEY_ID || '';
const APPLE_ISSUER_ID = process.env.APPLE_ISSUER_ID || '';
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY || '';
const APPLE_BUNDLE_ID = process.env.APPLE_BUNDLE_ID || 'com.ecomatin.app';

/**
 * Generate JWT for Apple App Store Server API
 *
 * The token is valid for 1 hour (Apple's maximum)
 */
export async function generateAppleServerAPIToken(): Promise<string> {
  if (!APPLE_KEY_ID || !APPLE_ISSUER_ID || !APPLE_PRIVATE_KEY) {
    throw new Error(
      'Missing required environment variables. Please set:\n' +
      '- APPLE_KEY_ID\n' +
      '- APPLE_ISSUER_ID\n' +
      '- APPLE_PRIVATE_KEY'
    );
  }

  // Parse the private key
  const privateKey = crypto.createPrivateKey({
    key: APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    format: 'pem',
  });

  // Current time and expiration (1 hour max for Apple)
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + 3600; // 1 hour

  // Create the JWT
  const jwt = await new SignJWT({
    // Audience is always 'appstoreconnect-v1' for App Store Server API
    aud: 'appstoreconnect-v1',
    // Bundle ID is required for most endpoints
    bid: APPLE_BUNDLE_ID,
  })
    .setProtectedHeader({
      alg: 'ES256',
      kid: APPLE_KEY_ID,
      typ: 'JWT',
    })
    .setIssuer(APPLE_ISSUER_ID)
    .setIssuedAt(now)
    .setExpirationTime(expiration)
    .sign(privateKey);

  return jwt;
}

/**
 * Request a test notification from Apple
 */
export async function requestTestNotification(): Promise<void> {
  try {
    const token = await generateAppleServerAPIToken();

    console.log('Generated JWT Token:');
    console.log(token);
    console.log('\n');

    // Sandbox URL for testing
    const sandboxUrl = 'https://api.storekit-sandbox.itunes.apple.com/inApps/v1/notifications/test';

    console.log('Requesting test notification from Apple Sandbox...');
    console.log(`URL: ${sandboxUrl}`);
    console.log('\n');

    const response = await fetch(sandboxUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseText = await response.text();

    console.log('Response Status:', response.status);
    console.log('Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('Response Body:', responseText);

    if (response.ok) {
      console.log('\n✅ Test notification requested successfully!');
      console.log('Check your webhook endpoint for the incoming notification.');
    } else {
      console.log('\n❌ Failed to request test notification');

      // Common error codes
      if (response.status === 401) {
        console.log('Error: Invalid or expired JWT token. Check your credentials.');
      } else if (response.status === 403) {
        console.log('Error: Forbidden. Your API key may not have the required permissions.');
      } else if (response.status === 404) {
        console.log('Error: App not found or no sandbox data available.');
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly (ESM compatible)
const isMainModule = import.meta.url === `file://${process.argv[1]}` ||
                     process.argv[1]?.endsWith('generateServerAPIToken.ts');

if (isMainModule) {
  // Check if we should just generate token or also request test
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    requestTestNotification();
  } else {
    generateAppleServerAPIToken()
      .then(token => {
        console.log('Generated Apple App Store Server API JWT Token:\n');
        console.log(token);
        console.log('\n\nTo request a test notification, use:\n');
        console.log(`curl -X POST "https://api.storekit-sandbox.itunes.apple.com/inApps/v1/notifications/test" \\`);
        console.log(`  -H "Authorization: Bearer ${token.substring(0, 50)}..."`);
        console.log('\nOr run this script with --test flag:\n');
        console.log('npx tsx src/lib/apple/generateServerAPIToken.ts --test');
      })
      .catch(error => {
        console.error('Error generating token:', error.message);
        console.log('\n=== SETUP INSTRUCTIONS ===\n');
        console.log('1. Go to App Store Connect → Users and Access → Integrations');
        console.log('2. Under "In-App Purchase", click "+" to create a new key');
        console.log('3. Download the .p8 file and note the Key ID and Issuer ID');
        console.log('4. Add these to your .env file:\n');
        console.log('APPLE_KEY_ID=YOUR_KEY_ID');
        console.log('APPLE_ISSUER_ID=YOUR_ISSUER_ID');
        console.log('APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_KEY_CONTENT\\n-----END PRIVATE KEY-----"');
        console.log('APPLE_BUNDLE_ID=com.ecomatin.app');
      });
  }
}
