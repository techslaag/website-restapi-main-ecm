// src/swaggerOptions.ts
const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'API Documentation',
        version: '1.0.0',
        description: 'Documentation de l\'API Next.js',
      },
      servers: [
        {
          url: 'http://localhost:3500', // Modifiez si nécessaire
        },
      ],
    },
    apis: ['./src/routes/**/*.ts'], // Chemin vers vos fichiers de routes
  };
  
  export default swaggerOptions;