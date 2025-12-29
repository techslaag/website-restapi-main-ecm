import { OAS3Options } from "swagger-jsdoc";

const swaggerConfig: OAS3Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API Documentation",
      version: "1.0.0",
      description: "Documentation pour l'API Next.js avec App Router",
    },
    servers: [
      {
        url: "http://localhost:3500/api",
        description: "Serveur local",
      },
    ],
  },
  apis: ["./src/app/api/**/*.ts"], // Incluez les routes API de votre projet
};

export default swaggerConfig;
