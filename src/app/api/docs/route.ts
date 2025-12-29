import { NextRequest, NextResponse } from 'next/server';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerDefinition from '@/lib/utils/swaggerConfig';

const options = {
  definition: swaggerDefinition,
  apis: ['./app/api/**/*.ts'], // Fichiers où tu écris tes routes
};

const swaggerSpec = swaggerJsdoc(options);

export async function GET(req: NextRequest) {
  const html = swaggerUi.generateHTML(swaggerSpec);
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
}
