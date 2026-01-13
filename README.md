# Jask - 자연어 기반 SQL 서비스

자연어로 SQL을 생성, 검증, 실행, 설명하는 엔터프라이즈급 서비스입니다.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- (Optional) NVIDIA GPU for Ollama

### 1. Start Development Environment

```bash
# Start PostgreSQL, Redis, Ollama
docker-compose up -d

# Install dependencies
npm install

# Setup database
npm run db:push

# Start development servers
npm run dev
```

### 2. Access

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Docs**: http://localhost:4000/api/docs

## 📁 Project Structure

```
jask/
├── frontend/          # Next.js 14 App
├── backend/           # NestJS API Server
├── docker-compose.yml # Development Environment
└── package.json       # Monorepo Configuration
```

## ✨ Features

- **NL2SQL**: 자연어 → SQL 변환
- **메타데이터 관리**: DB 스키마 자동 수집 및 설명
- **SQL 검증**: 보안 및 성능 검증
- **결과 시각화**: 테이블, 차트, 요약
- **쿼리 히스토리**: 이전 질문 조회 및 즐겨찾기

## 🔧 Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, shadcn/ui
- **Backend**: NestJS, Prisma, PostgreSQL
- **AI/LLM**: Ollama, vLLM
- **Vector DB**: pgvector

## 📝 License

MIT
