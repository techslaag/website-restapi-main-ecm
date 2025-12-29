import { jwtVerify, createRemoteJWKSet } from 'jose';

const JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export async function verifyAppleToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: 'https://appleid.apple.com',
    audience: 'com.ecomatin.ecomatinMobileApp',
  });

  return payload; // contient email, sub, etc.
}
