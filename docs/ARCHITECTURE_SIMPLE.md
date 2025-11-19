# 🌐 **FLUX DE COMMUNICATION ENTRE MICROSERVICES**

## 📊 **Diagramme des Connexions**

```
🌍 USER (Browser)
       │
       ▼
🎨 FRONTEND (React :3000)
       │ HTTP calls
       ▼
🚪 API GATEWAY (:5000) ◄─── 🔐 JWT Auth, Rate Limiting
       │
       ├─── /auth/* ────────► 👤 USER SERVICE (:5001)
       │                            │
       ├─── /api/reviews/* ─► 📝 REVIEW SERVICE (:5002)
       │                            │
       ├─── /api/analyze/* ─► 🤖 CODE ANALYSIS (:5003)
       │                            │
       └─── /ws (WebSocket) ─► 🔔 NOTIFICATION (:5004)
                                    │
                                    ▼
               🗄️ POSTGRESQL (:5432) ◄─── Toutes les données
                      ▲
                      │
               ⚡ REDIS (:6379) ◄─── Cache & Sessions
                      ▲
                      │
               🤖 OLLAMA (:11434) ◄─── LLMs locaux gratuits
```

## 🔄 **Exemple de Flux Complet**

### 1️⃣ **Utilisateur Upload du Code**

```
Frontend ──POST /api/reviews/upload──► API Gateway
    │                                        │
    │                                        ├─ Vérifie JWT token
    │                                        ├─ Rate limiting
    │                                        │
    │                                        ▼
    │                                  Review Service
    │                                        │
    │                                        ├─ Sauvegarde fichier
    │                                        ├─ Crée record en DB
    │                                        │
    │                                        ▼
    │                                  Code Analysis Service
    │                                        │
    │                                        ├─ Parse le code (AST)
    │                                        ├─ Appelle Ollama/OpenAI
    │                                        ├─ Génère optimisations
    │                                        ├─ Crée tests unitaires
    │                                        │
    │                                        ▼
    │                                  Notification Service
    │                                        │
    │                                        ├─ WebSocket notification
    │                                        │
    └────WebSocket────────────────────────────┘
```

## 🏗️ **Architecture Détaillée par Service**

### 🚪 **API GATEWAY** (Express.js - Port 5000)

```javascript
// Rôle: Router central + Sécurité
app.use("/auth", proxy("http://user-service:5001"));
app.use("/api/reviews", proxy("http://review-service:5002"));
app.use("/api/analyze", proxy("http://code-analysis-service:5003"));
```

**Responsabilités:**

- ✅ Authentification JWT
- ✅ Rate limiting (10 req/sec)
- ✅ CORS configuration
- ✅ Proxy vers microservices
- ✅ WebSocket pour notifications

---

### 👤 **USER SERVICE** (Node.js - Port 5001)

```javascript
// Endpoints
POST / register; // Inscription
POST / login; // Connexion + JWT
GET / profile; // Profil utilisateur
PUT / profile; // Modifier profil
```

**Base de données:**

- Table `users` (id, email, password_hash, role)
- Table `user_sessions` (token management)

---

### 📝 **REVIEW SERVICE** (Node.js - Port 5002)

```javascript
// Endpoints
POST /upload      // Upload fichier code
GET  /reviews     // Liste des reviews
GET  /reviews/:id // Détails d'une review
```

**Responsabilités:**

- ✅ Upload fichiers (max 10MB)
- ✅ Validation types (.js, .py, .java, etc.)
- ✅ Orchestration analyse → Code Analysis Service
- ✅ Stockage résultats

**Appelle:**

```javascript
// Appel vers Code Analysis Service
const response = await axios.post("http://code-analysis-service:5003/analyze", {
  code: fileContent,
  language: "javascript",
  filename: "app.js",
});
```

---

### 🤖 **CODE ANALYSIS SERVICE** (Python FastAPI - Port 5003)

```python
# Endpoints
POST /analyze           # Analyse complète
POST /optimize          # Optimisations seulement
POST /generate-tests    # Tests unitaires
```

**IA Intégrée:**

- 🤖 **Ollama** (gratuit, local) : `codellama:7b`, `llama2:7b`
- 🧠 **OpenAI** (quota gratuit) : `gpt-3.5-turbo`

**Pipeline d'analyse:**

```python
1. Parse AST (Abstract Syntax Tree)
2. Détecte patterns problématiques
3. Appelle LLM pour suggestions
4. Génère tests unitaires
5. Return résultats structurés
```

---

### 🔔 **NOTIFICATION SERVICE** (Node.js - Port 5004)

```javascript
// WebSocket temps réel
io.emit('analysis_complete', {
  reviewId: '123',
  status: 'completed',
  results: {...}
})
```

## 📦 **Configuration Docker Détaillée**

### 🗄️ **PostgreSQL Container**

```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_DB: ai_code_review_dev
    POSTGRES_USER: postgres
    POSTGRES_PASSWORD: postgres123
  ports: ["5432:5432"]
```

**Contient:**

- 12 tables (users, code_reviews, analysis_results, etc.)
- Extensions UUID + crypto
- Indexes optimisés
- Triggers auto-timestamp

### ⚡ **Redis Container**

```yaml
redis:
  image: redis:7-alpine
  ports: ["6379:6379"]
```

**Utilisation:**

- Sessions JWT
- Cache résultats analyse
- Rate limiting data
- Queue background jobs

### 🤖 **Ollama Container**

```yaml
ollama:
  image: ollama/ollama:latest
  ports: ["11434:11434"]
  environment:
    OLLAMA_KEEP_ALIVE: 5m
```

**Modèles gratuits:**

- `codellama:7b` - Analyse et optimisation code
- `llama2:7b` - Explications et documentation
- `phi:2.7b` - Tests unitaires rapides

## 🔗 **Communication Inter-Services**

### **HTTP REST** (Services Node.js)

```javascript
// Review Service → Code Analysis Service
const analysisResult = await axios.post(
  `${process.env.CODE_ANALYSIS_SERVICE_URL}/analyze`,
  { code, language, filename }
);
```

### **WebSocket** (Notifications temps réel)

```javascript
// Notification Service → Frontend
socket.emit("review_update", {
  reviewId: reviewId,
  status: "processing",
  progress: 45,
});
```

### **Database Sharing** (PostgreSQL)

Tous les services Node.js partagent la même DB avec des tables spécialisées :

- User Service → `users`, `user_sessions`
- Review Service → `code_reviews`, `projects`
- Code Analysis → `analysis_results`, `generated_tests`

---

## 🚀 **Démarrage Simple**

```bash
# 1. Cloner et aller dans le dossier
cd ai-code-review-assistant

# 2. Copier la config
cp .env.example .env

# 3. Lancer TOUT avec Docker
docker-compose -f docker-compose.dev.yml up --build

# 4. Attendre 2-3 minutes (téléchargement images)

# 5. Accès aux services
# Frontend: http://localhost:3000
# API: http://localhost:5000
# PgAdmin: http://localhost:5050
```

L'avantage de cette architecture est que **chaque service est indépendant** mais communique facilement via HTTP et partage les données via PostgreSQL/Redis.

Voulez-vous que je continue avec l'implémentation du **code réel** de l'API Gateway pour démarrer ? 🚀
