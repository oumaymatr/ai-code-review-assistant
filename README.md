# AI Code Review Assistant

An intelligent code review platform that uses AI to analyze your code, generate tests, and suggest improvements. Built with a microservices architecture for scalability and reliability.

## What does it do?

This tool helps developers improve their code quality by providing automated code reviews powered by local and cloud-based AI models. Upload your code, and get instant feedback on potential issues, best practices, security concerns, and performance optimizations.

## Key Features

- **Automated Code Analysis** - AI-powered analysis of code quality, security vulnerabilities, and performance issues
- **Test Generation** - Automatically generate unit tests for your functions
- **Code Optimization** - Get suggestions to improve code efficiency and readability
- **Multi-language Support** - Works with JavaScript, Python, TypeScript, Java, Go, and more
- **Real-time Notifications** - Get notified when your reviews are complete
- **User Authentication** - Secure login and user management
- **Dashboard** - Track all your code reviews in one place

## Tech Stack

### Frontend

- React 18 with Vite
- Tailwind CSS for styling
- Zustand for state management
- Monaco Editor for code display

### Backend Microservices

- **API Gateway** - Express.js with rate limiting and authentication
- **User Service** - User authentication and management (Node.js + PostgreSQL)
- **Review Service** - Code review management (Node.js + PostgreSQL)
- **Code Analysis Service** - AI-powered code analysis (Python + FastAPI + Ollama)
- **Notification Service** - Real-time notifications (Node.js + Socket.io)

### Infrastructure

- Docker & Docker Compose
- PostgreSQL for data persistence
- Redis for caching and queues
- Nginx as reverse proxy
- Ollama for local AI inference

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)
- Ollama installed (for AI features)

### Quick Start

1. Clone the repository

```bash
git clone https://github.com/oumaymatr/ai-code-review-assistant.git
cd ai-code-review-assistant
```

2. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start the services

```bash
docker-compose -f docker-compose.dev.yml up
```

4. Access the application

- Frontend: http://localhost:5173
- API Gateway: http://localhost:5000
- API Documentation: http://localhost:8000/api/docs

### Initial Setup

The first time you run the application, you'll need to:

1. Pull the Ollama model:

```bash
ollama pull qwen2.5-coder:0.5b
```

2. Initialize the databases (done automatically via Docker)

3. Create your first user account through the registration page

## Architecture

The system uses a microservices architecture where each service handles a specific domain:

```
┌─────────────┐
│   Frontend  │
│  (React)    │
└──────┬──────┘
       │
┌──────▼──────────┐
│  API Gateway    │
│  Port: 5000     │
└────────┬────────┘
         │
    ┌────┴────────────────────┬──────────────────┬────────────────┐
    │                         │                  │                │
┌───▼─────┐          ┌───────▼──────┐   ┌──────▼──────┐  ┌─────▼──────┐
│  User   │          │   Review     │   │   Code      │  │Notification│
│ Service │          │   Service    │   │  Analysis   │  │  Service   │
│Port:5001│          │  Port: 5002  │   │ Port: 8000  │  │ Port: 5004 │
└────┬────┘          └──────┬───────┘   └──────┬──────┘  └─────┬──────┘
     │                      │                  │                │
┌────▼──────┐         ┌─────▼──────┐      ┌───▼─────┐    ┌────▼─────┐
│PostgreSQL │         │ PostgreSQL │      │ Ollama  │    │PostgreSQL│
│  + Redis  │         │  + Redis   │      │ +OpenAI │    │  + Redis │
└───────────┘         └────────────┘      └─────────┘    └──────────┘
```

## Development

### Running Tests

```bash
# Node.js services
npm test

# Python service
pytest
```

### Project Structure

```
ai-code-review-assistant/
├── api-gateway/          # Request routing and authentication
├── user-service/         # User management and auth
├── review-service/       # Code review management
├── code-analysis-service/# AI-powered code analysis
├── notification-service/ # Real-time notifications
├── frontend/            # React application
├── nginx/               # Reverse proxy configuration
├── scripts/             # Utility scripts
└── docs/                # Additional documentation
```

## Configuration

Key configuration options in `.env`:

- `OLLAMA_BASE_URL` - Ollama server URL (default: http://localhost:11434)
- `OLLAMA_MODEL` - Model to use (default: qwen2.5-coder:0.5b)
- `OPENAI_API_KEY` - OpenAI API key for fallback (optional)
- `JWT_SECRET` - Secret for JWT token signing
- Database connection strings for each service

## Acknowledgments

- Ollama for providing local LLM inference
- OpenAI for fallback AI capabilities
- The open-source community for the amazing tools and libraries used in this project
