# 🚪 API Gateway - AI Code Review Assistant

Point d'entrée central pour tous les microservices avec authentification JWT, rate limiting et proxy intelligent.

## 🎯 Fonctionnalités

- ✅ **Authentification JWT** sécurisée avec blacklist
- ✅ **Rate limiting** intelligent et adaptatif  
- ✅ **Proxy routing** vers microservices
- ✅ **WebSocket** pour notifications temps réel
- ✅ **CORS** et sécurité avancée
- ✅ **Logging** structuré avec Winston
- ✅ **Health checks** complets
- ✅ **Métriques** de performance
- ✅ **Tests** unitaires et d'intégration

## 📋 Routes Principales

### 🔐 Authentification
- `POST /auth/register` - Inscription
- `POST /auth/login` - Connexion
- `POST /auth/logout` - Déconnexion
- `POST /auth/refresh` - Refresh token
- `GET /auth/me` - Informations utilisateur

### 🔀 Proxy vers Microservices
- `/api/users/*` → User Service
- `/api/reviews/*` → Review Service  
- `/api/analyze/*` → Code Analysis Service
- `/api/notifications/*` → Notification Service

### 🏥 Monitoring
- `GET /health` - Health check simple
- `GET /health/detailed` - Health check détaillé
- `GET /metrics` - Métriques du service
- `GET /api/services/health` - Health de tous les services

## 🚀 Démarrage

### Développement local
```bash
cd api-gateway
npm install
npm run dev
```

### Avec Docker
```bash
docker-compose -f docker-compose.dev.yml up api-gateway
```

### Tests
```bash
npm test
npm run test:watch
```

## ⚙️ Configuration

Variables d'environnement importantes :
```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-secret-key
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
USER_SERVICE_URL=http://user-service:5001
REVIEW_SERVICE_URL=http://review-service:5002
CODE_ANALYSIS_SERVICE_URL=http://code-analysis-service:5003
NOTIFICATION_SERVICE_URL=http://notification-service:5004
```

## 🔒 Sécurité

- **JWT** avec expiration et blacklist
- **Rate limiting** par IP/utilisateur
- **CORS** configuré
- **Helmet** pour headers sécurisés
- **Input validation** sur toutes les routes
- **Logs** de sécurité détaillés

## 📊 Monitoring

- **Winston** pour logs structurés
- **Métriques** de performance temps réel
- **Health checks** avec dépendances
- **Rate limiting** metrics
- **Proxy** performance tracking

## 🔗 Architecture

```
Client Request
     ↓
API Gateway :5000
     ├── Auth Middleware (JWT)
     ├── Rate Limiter (Redis)
     ├── Proxy Router
     └── Error Handler
     ↓
Microservices
     ├── User Service :5001
     ├── Review Service :5002  
     ├── Code Analysis :5003
     └── Notifications :5004
```