# Influencer Marketing Backend

A TypeScript/Node.js REST API backend for an influencer marketing platform, built with Express, Prisma ORM, and Docker support.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Available Scripts](#available-scripts)
- [Docker](#docker)
- [API Reference](#api-reference)

---

## Overview

This is the backend service for the Influencer Marketing platform. It exposes a REST API that handles user authentication, influencer profiles, campaign management, and brand-influencer matching. The database layer is managed via **Prisma ORM**, and the entire service can be containerised with the included **Dockerfile**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Language | TypeScript |
| Framework | Express.js |
| ORM | Prisma |
| Database | PostgreSQL (via Prisma) |
| Containerisation | Docker |
| Auth | JWT |

---

## Features

- 🔐 **JWT Authentication** — secure signup, login, and protected routes
- 👤 **User Roles** — separate flows for brands and influencers
- 📋 **Campaign Management** — create, manage, and track influencer campaigns
- 🤝 **Influencer Matching** — match influencers to brand campaigns
- 🗄️ **Prisma ORM** — type-safe database access with migrations
- 🐳 **Docker Ready** — containerised for consistent local and production environments
- 📁 **TypeScript** — fully typed codebase throughout

---

## Project Structure

```
influencer-marketing-backend/
├── prisma/
│   ├── schema.prisma       # Database schema and models
│   └── migrations/         # Prisma migration history
├── src/
│   ├── controllers/        # Route handler logic
│   ├── middleware/         # Auth, validation, error handling
│   ├── models/             # Type definitions and interfaces
│   ├── routes/             # Express route definitions
│   ├── services/           # Business logic layer
│   └── index.ts            # App entry point
├── .env.example            # Environment variable template
├── .gitignore
├── .dockerignore
├── Dockerfile              # Docker build configuration
├── tsconfig.json           # TypeScript configuration
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm
- PostgreSQL database (local or hosted)
- Docker (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/aligenius-acme/influencer-marketing-backend.git
cd influencer-marketing-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Fill in your `.env` file (see [Environment Variables](#environment-variables)), then run the database migrations:

```bash
npx prisma migrate dev
```

Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. **Never commit `.env` to git.**

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/influencer_db

# JWT
JWT_SECRET=your_jwt_secret_min_64_chars
JWT_EXPIRY=12h

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# Email (optional)
SENDGRID_API_KEY=SG.your_sendgrid_api_key
SENDER_EMAIL=your_sender@yourdomain.com

# File Storage (optional)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### Generating secrets

```bash
# Generate a secure JWT_SECRET
openssl rand -hex 64
```

---

## Database

This project uses **Prisma ORM** with PostgreSQL.

```bash
# Run all pending migrations
npx prisma migrate dev

# Open Prisma Studio (visual database browser)
npx prisma studio

# Generate Prisma client after schema changes
npx prisma generate

# Reset the database (WARNING: deletes all data)
npx prisma migrate reset
```

The full database schema is defined in `prisma/schema.prisma`.

---

## Available Scripts

```bash
npm run dev        # Start development server with hot reload
npm run build      # Compile TypeScript to JavaScript
npm start          # Start production server (after build)
npm run lint       # Run ESLint
```

---

## Docker

The project includes a `Dockerfile` for containerised deployment.

### Build and run with Docker

```bash
# Build the image
docker build -t influencer-marketing-backend .

# Run the container
docker run -p 3000:3000 --env-file .env influencer-marketing-backend
```

### Using Docker Compose (recommended for local dev with database)

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: influencer_db
    ports:
      - "5432:5432"
```

```bash
docker-compose up
```

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user (brand or influencer) |
| POST | `/api/auth/login` | Login and receive JWT |
| POST | `/api/auth/forgot-password` | Request password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |

### Users / Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/me` | Get current user profile |
| PUT | `/api/users/me` | Update current user profile |

### Influencers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/influencers` | List all influencers |
| GET | `/api/influencers/:id` | Get influencer profile |
| PUT | `/api/influencers/:id` | Update influencer profile |

### Campaigns

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/campaigns` | List all campaigns |
| POST | `/api/campaigns` | Create a new campaign (brand) |
| GET | `/api/campaigns/:id` | Get campaign details |
| PUT | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |

### Applications

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/campaigns/:id/apply` | Influencer applies to campaign |
| GET | `/api/campaigns/:id/applications` | Get applications for campaign (brand) |
| PUT | `/api/applications/:id` | Accept or reject application |

> All protected routes require `Authorization: Bearer <token>` in the request header.

---

## License

Private repository. All rights reserved by [aligenius-acme](https://github.com/aligenius-acme).
