# 🚀 Guide de Démarrage Rapide

## Prérequis

### Logiciels requis

- **Docker** & **Docker Compose** (version 3.8+)
- **Node.js** 18+ et **npm** (pour développement local)
- **Python** 3.9+ et **pip** (pour développement local)
- **Git**

### Optionnel

- **Ollama** (pour LLMs locaux gratuits)
- **pgAdmin** ou **DBeaver** (pour administration DB)

## 🏃‍♂️ Démarrage Rapide (5 minutes)

### 1. Clone et configuration

```bash
git clone <your-repo>
cd ai-code-review-assistant
cp .env.example .env
```

### 2. Configuration des variables (optionnel)

```bash
# Éditer .env avec vos clés API (optionnel)
# OpenAI API key pour analyses avancées
OPENAI_API_KEY=sk-...

# Email configuration (optionnel)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

### 3. Lancement avec Docker

```bash
docker-compose up --build
```

### 4. Accès aux services

- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000
- **PgAdmin**: http://localhost:5050 (admin@admin.com / admin123)

## 🔧 Développement Local

### Installation des dépendances

```bash
# Windows PowerShell
./scripts/install-deps.ps1

# Linux/Mac
chmod +x scripts/install-deps.sh
./scripts/install-deps.sh
```

### Lancement en mode développement

```bash
# Avec hot-reload
docker-compose -f docker-compose.dev.yml up
```

### Tests

```bash
# Tous les tests
./scripts/run-tests.sh

# Service spécifique
cd user-service && npm test
cd code-analysis-service && python -m pytest
```

## 🎯 Premier Test

### 1. Créer un compte

- Aller sur http://localhost:3000
- Cliquer "S'inscrire"
- Remplir le formulaire

### 2. Analyser du code

```javascript
// Exemple de code JavaScript avec des problèmes
function calculateTotal(items) {
  var total = 0;
  for (var i = 0; i < items.length; i++) {
    total = total + items[i].price;
  }
  return total;
}
```

### 3. Voir les résultats

L'IA va identifier :

- ✅ Optimisations possibles (const/let, reduce)
- ✅ Suggestions de style
- ✅ Tests unitaires générés
- ✅ Améliorations de performance

## 🛠️ Configuration Avancée

### Ollama (LLMs locaux gratuits)

```bash
# Installation d'Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Télécharger des modèles
ollama pull codellama:7b
ollama pull llama2:7b
ollama pull phi:2.7b
```

### Base de données

```sql
-- Connexion à PostgreSQL
psql -h localhost -p 5432 -U postgres -d ai_code_review

-- Voir les tables
\dt

-- Statistiques
SELECT * FROM review_statistics;
```

### Redis Cache

```bash
# Connexion à Redis
redis-cli -h localhost -p 6379

# Voir les clés
KEYS *

# Statistiques
INFO memory
```

## 🐛 Dépannage

### Problèmes courants

#### Docker: "Port already in use"

```bash
# Voir les ports utilisés
docker ps
netstat -tlnp | grep :5000

# Arrêter les conteneurs
docker-compose down
```

#### Base de données: "Connection refused"

```bash
# Vérifier PostgreSQL
docker logs ai-review-postgres

# Recréer la base
docker-compose down -v
docker-compose up postgres
```

#### Service non accessible

```bash
# Vérifier les logs
docker-compose logs api-gateway
docker-compose logs code-analysis-service

# Redémarrer un service
docker-compose restart user-service
```

### Logs et debugging

#### Voir tous les logs

```bash
docker-compose logs -f
```

#### Logs spécifique à un service

```bash
docker-compose logs -f code-analysis-service
```

#### Mode debug

```bash
# Ajouter dans .env
LOG_LEVEL=debug
NODE_ENV=development

# Redémarrer
docker-compose restart
```

## 🔍 API Testing

### Avec curl

```bash
# Inscription
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "username": "test", "password": "test123"}'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@test.com", "password": "test123"}'

# Analyse de code
curl -X POST http://localhost:5000/api/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"code": "function test() { return 1 + 1; }", "language": "javascript", "filename": "test.js"}'
```

### Avec Postman

Collection disponible dans `/docs/postman_collection.json`

## 📊 Monitoring

### Health checks

- **API Gateway**: http://localhost:5000/health
- **User Service**: http://localhost:5001/health
- **Review Service**: http://localhost:5002/health
- **Code Analysis**: http://localhost:5003/health

### Métriques

- **Database**: http://localhost:5050 (PgAdmin)
- **Redis**: `redis-cli info`
- **Logs**: `docker-compose logs`

## 🚀 Déploiement Production

### Variables d'environnement

```bash
# Production .env
NODE_ENV=production
JWT_SECRET=your-super-secure-secret
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
```

### SSL/HTTPS

```bash
# Générer certificats
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/key.pem \
  -out nginx/ssl/cert.pem
```

### Scaling

```bash
# Scaler les services
docker-compose up --scale user-service=3 \
                   --scale review-service=2 \
                   --scale code-analysis-service=2
```

## 🤝 Contribution

### Setup développeur

```bash
git clone <repo>
cd ai-code-review-assistant
npm install -g nodemon
pip install -r requirements-dev.txt
```

### Pre-commit hooks

```bash
# Installation
npm install -g husky lint-staged
npx husky install

# Tests avant commit
git commit -m "feature: add new analysis"
```

### Standards de code

- **JavaScript**: ESLint + Prettier
- **Python**: Black + Flake8
- **Tests**: Minimum 80% coverage
- **Documentation**: JSDoc + Sphinx
