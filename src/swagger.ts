// src/swagger.ts
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerOptions from './swaggerOptions';

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export default swaggerDocs;