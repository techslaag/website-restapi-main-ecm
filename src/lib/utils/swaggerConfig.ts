import { OpenAPIV3 } from 'openapi-types';

const swaggerDefinition: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'API Documentation',
    version: '1.0.0',
    description: 'Documentation de l’API de votre application Next.js',
  },
  servers: [
    {
      url: 'http://localhost:3500/api',
      description: 'Serveur de développement',
    },
  ],
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '12345' },
          name: { type: 'string', example: 'Jean Dupont' },
          email: { type: 'string', example: 'jean.dupont@example.com' },
        },
      },
    },
  },
  paths: {
    '/users': {
      get: {
        summary: 'Récupère la liste des utilisateurs',
        responses: {
          '200': {
            description: 'Liste des utilisateurs récupérée avec succès',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },  
        },
      },
    },
  },
};

export default swaggerDefinition;
