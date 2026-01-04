/**
 * API Documentation Routes
 *
 * Serves Swagger/OpenAPI documentation
 */

import { Router, Request, Response } from 'express';
import { swaggerSpec, swaggerHtml } from '../config/swagger.js';

const router = Router();

/**
 * @swagger
 * /docs:
 *   get:
 *     summary: API Documentation UI
 *     description: Interactive Swagger UI for exploring the API
 *     tags: [Documentation]
 *     security: []
 *     responses:
 *       200:
 *         description: Swagger UI HTML page
 */
router.get('/', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(swaggerHtml);
});

/**
 * @swagger
 * /docs/json:
 *   get:
 *     summary: OpenAPI Specification
 *     description: Raw OpenAPI 3.0 specification in JSON format
 *     tags: [Documentation]
 *     security: []
 *     responses:
 *       200:
 *         description: OpenAPI specification
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/json', (req: Request, res: Response) => {
  res.json(swaggerSpec);
});

/**
 * @swagger
 * /docs/yaml:
 *   get:
 *     summary: OpenAPI Specification (YAML)
 *     description: Raw OpenAPI 3.0 specification in YAML format
 *     tags: [Documentation]
 *     security: []
 *     responses:
 *       200:
 *         description: OpenAPI specification in YAML
 */
router.get('/yaml', (req: Request, res: Response) => {
  const yaml = require('yaml');
  res.setHeader('Content-Type', 'text/yaml');
  res.send(yaml.stringify(swaggerSpec));
});

export default router;
