import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 1800; // 30 minutes (1800 seconds)

export async function GET() {
  return NextResponse.json({ 
    message: "Test route accessible", 
    timestamp: new Date().toISOString() 
  });
}
