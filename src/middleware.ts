import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  // retrieve the current response
  const res = NextResponse.next();

  // add the CORS headers to the response
  res.headers.append("Access-Control-Allow-Origin", "*");
  res.headers.append(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  );
  res.headers.append(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, Accept, Accept-Version, Content-Length, Content-MD5, Date, X-Api-Version",
  );
  res.headers.append("Access-Control-Max-Age", "86400");

  return res;
}

export const config = {
  matcher: "/api/:path*",
};
