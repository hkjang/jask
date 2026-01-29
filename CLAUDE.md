# Jask - Project Guide for Claude

## 개발 규칙 (Development Rules)

- **기본 언어**: 웹페이지 UI 텍스트, 라벨, 메시지, placeholder 등은 **한국어**로 작성
- 코드 주석, 변수명, 함수명은 영어 사용
- API 에러 메시지는 한국어로 반환
- 사용자에게 보여지는 모든 텍스트는 한국어 우선

## Project Overview

Jask is an enterprise AI platform that enables natural language to SQL (NL2SQL) generation, execution, and visualization. Users can query databases using natural language without knowing SQL syntax.

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, shadcn/ui, React Query, Recharts
- **Backend**: NestJS, TypeScript, Prisma ORM
- **Database**: PostgreSQL with pgvector extension
- **Cache**: Redis (via ioredis, Bull queues)
- **AI/LLM**: Ollama, vLLM (configurable providers)
- **Supported DB Connectors**: PostgreSQL, MySQL, Oracle, MSSQL

## Project Structure

```
jask/
├── frontend/          # Next.js 14 App (port 3000)
│   └── src/
│       ├── app/       # Next.js app router pages
│       ├── components/# React components
│       ├── hooks/     # Custom React hooks
│       └── lib/       # Utilities
├── backend/           # NestJS API Server (port 4000)
│   ├── src/
│   │   ├── admin/     # Admin management endpoints
│   │   ├── audit/     # Security audit logging
│   │   ├── auth/      # JWT authentication
│   │   ├── datasources/ # Database connection management
│   │   ├── embedding/ # Vector embeddings (pgvector)
│   │   ├── evolution/ # AI evolution & user action tracking
│   │   ├── execution/ # SQL execution engine
│   │   ├── llm/       # LLM provider abstraction
│   │   ├── metadata/  # Schema metadata management
│   │   ├── nl2sql/    # Natural language to SQL conversion
│   │   ├── prisma/    # Prisma service
│   │   ├── query/     # Query history & management
│   │   ├── thread/    # Conversation threads
│   │   └── validation/# SQL validation & security
│   └── prisma/
│       └── schema.prisma  # Database schema
├── docs/              # User/Admin documentation
└── docker-compose.yml # Development environment (Postgres, Redis)
```

## Commands

### Development
```bash
npm run dev              # Start both frontend and backend
npm run dev:frontend     # Start frontend only (port 3000)
npm run dev:backend      # Start backend only (port 4000)
```

### Build
```bash
npm run build            # Build both workspaces
npm run build:frontend   # Build frontend only
npm run build:backend    # Build backend only
```

### Database (Prisma)
```bash
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run migrations (dev)
npm run db:push          # Push schema to DB
npm run db:studio        # Open Prisma Studio (backend workspace)
npm run db:seed          # Seed database (backend workspace)
```

### Testing
```bash
npm run test             # Run tests in all workspaces
npm run lint             # Lint all workspaces
```

### Docker
```bash
docker-compose up -d     # Start PostgreSQL (pgvector) and Redis
```

## Key Patterns

### Backend Architecture
- NestJS modules follow domain-driven structure
- Services use dependency injection
- Guards for authentication (`JwtAuthGuard`) and authorization (`RolesGuard`)
- Prisma for database access via `PrismaService`
- Global exception filter for consistent error handling

### Frontend Architecture
- Next.js App Router with TypeScript
- React Query for server state management
- shadcn/ui components with Radix primitives
- TailwindCSS for styling

### Authentication
- JWT-based authentication with Passport
- User roles: `USER`, `ADMIN`
- Data source access roles: `VIEWER`, `EDITOR`, `ADMIN`

### Database Schema Highlights
- `DataSource`: External database connections (encrypted credentials)
- `TableMetadata` / `ColumnMetadata`: Schema introspection cache
- `QueryHistory`: User query logs with feedback
- `SampleQuery`: RAG training data with embeddings
- `Thread` / `Message`: Conversation history
- `AuditLog` / `SecurityAlert`: Comprehensive audit trail

## Environment Variables

Backend requires:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`: Redis connection
- `JWT_SECRET`: JWT signing key
- LLM provider configuration (Ollama/vLLM/OpenAI)

## API Documentation

Swagger docs available at: `http://localhost:4000/api/docs`

## Important Notes

- SQL execution is restricted to `SELECT` statements by default
- Destructive queries (DROP, DELETE) require admin approval
- All queries are logged for audit compliance
- Sensitive data columns can be marked with sensitivity levels
- Vector embeddings use pgvector for semantic search (hybrid search supported)
