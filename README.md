# 🎁 VibeList Backend

> **Wishlist sharing platform with intelligent product parsing and social features**

A modern NestJS-based monolithic backend for creating, sharing, and managing wishlists with friends and family. Features intelligent URL parsing powered by AI, real-time notifications, and a personalized social feed.

[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E?logo=nestjs)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)](https://redis.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Project Structure](#-project-structure)
- [API Documentation](#-api-documentation)
- [Parser Module](#-parser-module)
- [Configuration](#-configuration)
- [Development](#-development)
- [Testing](#-testing)
- [Deployment](#-deployment)

---

## ✨ Features

### 🎯 Core Features

- **Wishlist Management** - Create, update, and organize wishlist items with priorities
- **Smart URL Parsing** - Automatically extract product info from any e-commerce URL
- **Social Following** - Follow friends and see their wishlists
- **Item Reservation** - Reserve items to avoid duplicate gifts
- **Personalized Feed** - See wishlist updates from people you follow
- **Push Notifications** - Real-time notifications for followers, reservations, and updates
- **Email Notifications** - Welcome emails and notification digests

### 🤖 Intelligent Parser Module

- **Ozon-Specific Parser** - Direct API access for fast and accurate Ozon.ru parsing
- **Universal Parser** - AI-powered parsing for any website using Claude Sonnet 4.5
- **Scrapfly Integration** - Professional web scraping with anti-bot protection
- **Automatic Retry** - Exponential backoff for failed parsing attempts
- **Background Processing** - Async job queue for parsing operations
- **Price Monitoring** - Nightly price checks with notifications on price drops

### 🔐 Authentication & Security

- **JWT Authentication** - Secure token-based auth with refresh tokens
- **Password Hashing** - Bcrypt with configurable salt rounds
- **Role-Based Access** - Fine-grained permissions system
- **Rate Limiting** - Protection against API abuse
- **CORS Configuration** - Secure cross-origin resource sharing

### 📊 Performance & Scalability

- **Redis Caching** - 5-minute TTL for feed data
- **Database Indexing** - Optimized queries with proper indexes
- **Connection Pooling** - Efficient database connection management
- **Bull Queue** - Redis-backed job queue for async tasks
- **Event-Driven Architecture** - Decoupled modules via event emitter

---

## 🏗️ Architecture

### Monolith Design

VibeList Backend follows a **modular monolithic architecture** for simplicity and performance:

```
┌─────────────────────────────────────────────────┐
│            VibeList Backend (Port 3000)         │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │   Auth   │  │  Users   │  │ Wishlist │     │
│  │  Module  │  │  Module  │  │  Module  │     │
│  └──────────┘  └──────────┘  └────┬─────┘     │
│  ┌──────────┐  ┌──────────┐       │           │
│  │   Feed   │  │Notifica- │       │           │
│  │  Module  │  │   tions  │       │           │
│  └──────────┘  └──────────┘       ▼           │
│  ┌─────────────────────────────────────┐       │
│  │        Parser Module                │       │
│  │  ┌──────────┐  ┌────────────────┐  │       │
│  │  │  Ozon    │  │   Universal    │  │       │
│  │  │  Parser  │  │   Parser (AI)  │  │       │
│  │  └──────────┘  └────────────────┘  │       │
│  │  ┌──────────────────────────────┐  │       │
│  │  │   Scrapfly Service           │  │       │
│  │  └──────────────────────────────┘  │       │
│  └─────────────────────────────────────┘       │
└─────────────────────────────────────────────────┘
              │               │
              ▼               ▼
      ┌──────────────┐  ┌──────────┐
      │  PostgreSQL  │  │  Redis   │
      │   (Port      │  │  (Port   │
      │    5432)     │  │   6379)  │
      └──────────────┘  └──────────┘
```

### Module Overview

| Module | Description | Key Features |
|--------|-------------|--------------|
| **Auth** | Authentication & authorization | JWT, Refresh tokens, Password hashing |
| **Users** | User management & social features | Profiles, Following system, Search |
| **Wishlist** | Wishlist CRUD operations | Items, Priorities, Reservations, Stats |
| **Parser** | Intelligent URL parsing | Ozon API, AI extraction, Background jobs |
| **Feed** | Personalized social feed | Redis caching, Pagination, Filters |
| **Notifications** | Push & email notifications | FCM, Resend, Event-driven |

---

## 🛠️ Tech Stack

### Core Framework
- **[NestJS](https://nestjs.com/)** 10.x - Progressive Node.js framework
- **[TypeScript](https://www.typescriptlang.org/)** 5.4 - Type-safe JavaScript
- **[Node.js](https://nodejs.org/)** 20+ - JavaScript runtime

### Database & Caching
- **[PostgreSQL](https://www.postgresql.org/)** 16 - Primary database
- **[TypeORM](https://typeorm.io/)** 0.3 - Object-relational mapping
- **[Redis](https://redis.io/)** 7 - Caching & job queue

### Queue & Background Jobs
- **[Bull](https://github.com/OptimalBits/bull)** 4.x - Redis-backed job queue
- **[Bull Board](https://github.com/felixmosh/bull-board)** - Queue monitoring UI

### Parser & Scraping
- **[Scrapfly](https://scrapfly.io/)** - Professional web scraping API
- **[Anthropic Claude](https://www.anthropic.com/)** - AI-powered data extraction
- **[Cheerio](https://cheerio.js.org/)** - HTML parsing (fallback)

### Authentication & Security
- **[Passport](http://www.passportjs.org/)** - Authentication middleware
- **[JWT](https://jwt.io/)** - JSON Web Tokens
- **[Bcrypt](https://github.com/kelektiv/node.bcrypt.js)** - Password hashing

### Notifications
- **[Firebase Admin](https://firebase.google.com/docs/admin/setup)** - Push notifications (FCM)
- **[Resend](https://resend.com/)** - Transactional emails

### API & Documentation
- **[Swagger](https://swagger.io/)** / **[OpenAPI](https://www.openapis.org/)** - API documentation
- **[Class Validator](https://github.com/typestack/class-validator)** - DTO validation
- **[Class Transformer](https://github.com/typestack/class-transformer)** - Object serialization

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x or higher
- **npm** 10.x or higher
- **Docker** & **Docker Compose**
- **Git**

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/vibelist-backend.git
cd vibelist-backend
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment**

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

**Required API Keys:**
- `SCRAPFLY_API_KEY` - Get from [scrapfly.io/dashboard](https://scrapfly.io/dashboard)
- `ANTHROPIC_API_KEY` - Get from [console.anthropic.com](https://console.anthropic.com/)
- `RESEND_API_KEY` - Get from [resend.com/api-keys](https://resend.com/api-keys)

4. **Start infrastructure**

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Check containers are running
docker-compose ps
```

5. **Run database migrations** *(if using migrations)*

```bash
npm run migration:run
```

6. **Start the application**

```bash
# Development mode (hot reload)
npm run dev

# Production mode
npm run build
npm run start:prod
```

7. **Verify setup**

Open your browser and navigate to:
- **API:** http://localhost:3000/api/v1
- **Swagger Docs:** http://localhost:3000/api/docs

---

## 📁 Project Structure

```
vibelist-backend/
├── src/
│   ├── modules/                  # Feature modules
│   │   ├── auth/                 # Authentication module
│   │   │   ├── dto/              # Data transfer objects
│   │   │   ├── guards/           # Auth guards (JWT, roles)
│   │   │   ├── strategies/       # Passport strategies
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── token.service.ts
│   │   │   └── auth.module.ts
│   │   │
│   │   ├── users/                # Users & social features
│   │   │   ├── dto/
│   │   │   ├── follow.service.ts
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   │
│   │   ├── wishlist/             # Wishlist management
│   │   │   ├── dto/
│   │   │   ├── services/
│   │   │   │   ├── wishlist.service.ts
│   │   │   │   ├── reservation.service.ts
│   │   │   │   ├── parser-gateway.service.ts
│   │   │   │   └── price-monitor.service.ts
│   │   │   ├── processors/
│   │   │   │   └── parser.processor.ts
│   │   │   ├── tasks/
│   │   │   │   └── nightly-price-check.task.ts
│   │   │   ├── wishlist.controller.ts
│   │   │   └── wishlist.module.ts
│   │   │
│   │   ├── parser/               # Intelligent URL parser
│   │   │   ├── interfaces/
│   │   │   │   └── parsed-product.interface.ts
│   │   │   ├── services/
│   │   │   │   ├── parser.service.ts
│   │   │   │   ├── scrapfly.service.ts
│   │   │   │   ├── universal.parser.ts
│   │   │   │   └── ozon.parser.ts
│   │   │   └── parser.module.ts
│   │   │
│   │   ├── feed/                 # Social feed
│   │   │   ├── dto/
│   │   │   ├── services/
│   │   │   │   ├── feed.service.ts
│   │   │   │   └── feed-cache.service.ts
│   │   │   ├── feed.controller.ts
│   │   │   └── feed.module.ts
│   │   │
│   │   └── notifications/        # Push & email notifications
│   │       ├── dto/
│   │       ├── services/
│   │       │   ├── notifications.service.ts
│   │       │   ├── fcm.service.ts
│   │       │   ├── email.service.ts
│   │       │   └── device-tokens.service.ts
│   │       ├── listeners/
│   │       │   └── notification.listener.ts
│   │       ├── templates/
│   │       │   └── email-templates.ts
│   │       ├── notifications.controller.ts
│   │       └── notifications.module.ts
│   │
│   ├── database/                 # Database configuration
│   │   ├── entities/             # TypeORM entities
│   │   │   ├── user.entity.ts
│   │   │   ├── wishlist-item.entity.ts
│   │   │   ├── follow.entity.ts
│   │   │   ├── notification.entity.ts
│   │   │   ├── refresh-token.entity.ts
│   │   │   └── device-token.entity.ts
│   │   └── database.module.ts
│   │
│   ├── config/                   # Configuration files
│   │   ├── queue.config.ts       # Bull queue configuration
│   │   └── typeorm.config.ts     # TypeORM configuration
│   │
│   ├── common/                   # Shared utilities
│   │   ├── utils/
│   │   │   └── currency-converter.util.ts
│   │   └── logger/
│   │       └── winston.config.ts
│   │
│   ├── app.module.ts             # Root application module
│   └── main.ts                   # Application entry point
│
├── test/                         # E2E tests
├── docker-compose.yml            # Docker services
├── .env.example                  # Environment template
├── nest-cli.json                 # NestJS CLI config
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── SETUP.md                      # Quick start guide
└── README.md                     # This file
```

---

## 📚 API Documentation

### Swagger UI

Once the application is running, visit http://localhost:3000/api/docs to explore the interactive API documentation.

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user

#### Users
- `GET /api/v1/users/me` - Get my profile
- `PUT /api/v1/users/me` - Update my profile
- `GET /api/v1/users/search` - Search users
- `GET /api/v1/users/:userId` - Get user by ID
- `POST /api/v1/users/:userId/follow` - Follow user
- `DELETE /api/v1/users/:userId/follow` - Unfollow user

#### Wishlist
- `POST /api/v1/wishlist` - Create wishlist item (manual or from URL)
- `GET /api/v1/wishlist/my-items` - Get my wishlist items
- `GET /api/v1/wishlist/:itemId` - Get item details
- `PUT /api/v1/wishlist/:itemId` - Update item
- `DELETE /api/v1/wishlist/:itemId` - Delete item
- `POST /api/v1/wishlist/:itemId/reserve` - Reserve item
- `DELETE /api/v1/wishlist/:itemId/reserve` - Unreserve item

#### Feed
- `GET /api/v1/feed` - Get personalized feed

#### Notifications
- `GET /api/v1/notifications` - Get user notifications
- `PATCH /api/v1/notifications/:id/read` - Mark as read

---

## 🤖 Parser Module

The Parser Module is the heart of VibeList's intelligent product parsing system.

### How It Works

```
User submits URL
    ↓
ParserGatewayService creates job
    ↓
Bull Queue (Redis)
    ↓
ParserProcessor picks up job
    ↓
ParserService routes to appropriate parser
    ↓
┌─────────────────────┬─────────────────────┐
│   Ozon Parser       │  Universal Parser   │
│   (API-based)       │  (Scrapfly + AI)    │
└─────────────────────┴─────────────────────┘
    ↓
Product data extracted
    ↓
Result returned to user
```

### Supported Platforms

#### 🟢 Tier 1: Native API Support
- **Ozon.ru** - Direct API access, fastest and most reliable

#### 🟡 Tier 2: Universal AI Parser
- **Any e-commerce site** - Scrapfly web scraping + Claude AI extraction
- Examples: Amazon, Wildberries, AliExpress, eBay, etc.

### Parser Features

**Ozon Parser:**
- Direct API endpoint access
- No HTML parsing required
- Extracts: title, price, currency, images, rating, reviews
- Average response time: 2-5 seconds

**Universal Parser:**
- Two-stage extraction:
  1. **Cheerio** - Fast meta tag and structured data extraction
  2. **AI (Claude Sonnet 4.5)** - Intelligent content analysis
- Confidence scoring system
- Fallback mechanisms
- Average response time: 5-10 seconds

**Price Monitoring:**
- Nightly cron job (3:00 AM UTC)
- Automatic re-parsing of enabled items
- Price drop notifications
- Configurable check frequency

---

## ⚙️ Configuration

### Environment Variables

See [.env.example](.env.example) for complete configuration options.

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/vibelist

# JWT
JWT_SECRET=your-secret-key-minimum-64-chars
JWT_REFRESH_SECRET=your-refresh-secret-minimum-64-chars

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Parser APIs
SCRAPFLY_API_KEY=your-scrapfly-key
ANTHROPIC_API_KEY=your-anthropic-key

# Email
RESEND_API_KEY=your-resend-key
```

---

## 💻 Development

### Available Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run start:debug      # Start with debugging

# Build
npm run build            # Compile TypeScript to JavaScript

# Production
npm run start:prod       # Run production build

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier

# Database
npm run migration:generate  # Generate migration
npm run migration:run       # Run migrations
npm run migration:revert    # Revert migration
```

### Hot Reload

The application uses NestJS watch mode for instant feedback during development:
- Changes to `.ts` files trigger automatic recompilation
- Server restarts automatically

---

## 🧪 Testing

```bash
# Unit tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:cov

# E2E tests
npm run test:e2e
```

---

## 🚢 Deployment

### Docker Deployment

```bash
# Build image
docker build -t vibelist-backend .

# Run with docker-compose
docker-compose up -d
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Set `DB_SYNCHRONIZE=false`
- [ ] Generate strong JWT secrets
- [ ] Configure production database
- [ ] Set up Redis with password
- [ ] Configure CORS origins
- [ ] Enable rate limiting

---

**Built with ❤️ using NestJS and TypeScript**
