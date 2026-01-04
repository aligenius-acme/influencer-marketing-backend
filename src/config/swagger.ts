/**
 * Swagger/OpenAPI Configuration
 *
 * API documentation configuration
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Influencer Marketing Platform API',
      version: '1.0.0',
      description: `
# Influencer Marketing Platform API

Complete API documentation for the Influencer Marketing Platform.

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-access-token>
\`\`\`

## Rate Limiting

- Standard endpoints: 100 requests/minute
- Search endpoints: 30 requests/minute
- Auth endpoints: 10 requests/minute

## Response Format

All responses follow this format:

\`\`\`json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
\`\`\`

Error responses:

\`\`\`json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
\`\`\`
      `,
      contact: {
        name: 'API Support',
        email: 'support@influencerplatform.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['BRAND', 'ADMIN'] },
            emailVerified: { type: 'boolean' },
            avatarUrl: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Influencer: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            platform: { type: 'string', enum: ['instagram', 'tiktok', 'youtube', 'twitter'] },
            profile: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                displayName: { type: 'string' },
                bio: { type: 'string' },
                followers: { type: 'integer' },
                engagementRate: { type: 'number' },
                verified: { type: 'boolean' },
              },
            },
            tags: { type: 'array', items: { type: 'string' } },
            isFavorite: { type: 'boolean' },
          },
        },
        Campaign: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: {
              type: 'string',
              enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'],
            },
            platform: { type: 'string' },
            budget: { type: 'number' },
            currency: { type: 'string' },
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Invoice: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            invoiceNumber: { type: 'string' },
            status: { type: 'string', enum: ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOID'] },
            subtotal: { type: 'number' },
            tax: { type: 'number' },
            total: { type: 'number' },
            dueDate: { type: 'string', format: 'date' },
          },
        },
        Contract: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            status: {
              type: 'string',
              enum: ['DRAFT', 'PENDING_SIGNATURE', 'SIGNED', 'ACTIVE', 'EXPIRED', 'CANCELLED'],
            },
            content: { type: 'string' },
            effectiveDate: { type: 'string', format: 'date' },
            expirationDate: { type: 'string', format: 'date' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            totalPages: { type: 'integer' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                success: false,
                error: { message: 'Access token is required', code: 'UNAUTHORIZED' },
              },
            },
          },
        },
        Forbidden: {
          description: 'Permission denied',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Users', description: 'User management' },
      { name: 'Influencers', description: 'Influencer discovery and search' },
      { name: 'Saved Influencers', description: 'Saved influencers and lists' },
      { name: 'Campaigns', description: 'Campaign management' },
      { name: 'Analytics', description: 'Analytics and reporting' },
      { name: 'Messages', description: 'Messaging system' },
      { name: 'Contracts', description: 'Contract management' },
      { name: 'Payments', description: 'Payment and invoicing' },
      { name: 'Webhooks', description: 'Webhook subscriptions' },
      { name: 'AI', description: 'AI-powered features' },
      { name: 'Social Listening', description: 'Brand monitoring' },
      { name: 'CRM', description: 'CRM integrations' },
      { name: 'Export', description: 'Data export' },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);

// Export HTML for standalone documentation page
export const swaggerHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Influencer Platform API</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/v1/docs/json",
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        deepLinking: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>
`;
