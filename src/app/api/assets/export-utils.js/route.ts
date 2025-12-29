import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = "force-dynamic";

// Serve the export utilities JavaScript file
export async function GET() {
  try {
    const filePath = join(process.cwd(), 'public', 'js', 'export-utils.js');
    const fileContent = readFileSync(filePath, 'utf8');
    
    return new Response(fileContent, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  } catch (error) {
    console.error('Error serving export utils:', error);
    return new Response('console.error("Failed to load export utilities");', {
      status: 500,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}