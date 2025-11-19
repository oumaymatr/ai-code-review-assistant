-- Script d'initialisation de la base de données AI Code Review Assistant
-- Ce script est exécuté automatiquement lors du démarrage de PostgreSQL

-- Création de la base de données si elle n'existe pas
-- (déjà créée par POSTGRES_DB dans docker-compose.yml)

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    avatar_url TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    login_count INTEGER DEFAULT 0
);

-- Table des sessions utilisateur
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des projets/repositories
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    language VARCHAR(50),
    repository_url TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Table des reviews de code
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    file_size INTEGER,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Table des commentaires sur les reviews
CREATE TABLE IF NOT EXISTS review_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    line_number INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des analyses de code
CREATE TABLE IF NOT EXISTS code_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des résultats d'analyse
CREATE TABLE IF NOT EXISTS analysis_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('bugs', 'optimizations', 'security', 'style', 'complexity', 'tests')),
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    line_number INTEGER,
    column_number INTEGER,
    suggested_fix TEXT,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    ai_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des tests unitaires générés
CREATE TABLE IF NOT EXISTS generated_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    test_framework VARCHAR(50) NOT NULL,
    test_file_name VARCHAR(255) NOT NULL,
    test_content TEXT NOT NULL,
    test_description TEXT,
    coverage_estimate DECIMAL(5,2),
    ai_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des optimisations suggérées
CREATE TABLE IF NOT EXISTS code_optimizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    optimization_type VARCHAR(50) NOT NULL,
    original_code TEXT NOT NULL,
    optimized_code TEXT NOT NULL,
    description TEXT NOT NULL,
    performance_impact VARCHAR(20) CHECK (performance_impact IN ('high', 'medium', 'low', 'minimal')),
    complexity_reduction BOOLEAN DEFAULT FALSE,
    line_start INTEGER,
    line_end INTEGER,
    confidence_score DECIMAL(3,2),
    ai_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des corrections de code
CREATE TABLE IF NOT EXISTS code_corrections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    error_type VARCHAR(50) NOT NULL,
    original_code TEXT NOT NULL,
    corrected_code TEXT NOT NULL,
    explanation TEXT NOT NULL,
    line_number INTEGER,
    severity VARCHAR(20) DEFAULT 'medium',
    auto_fixable BOOLEAN DEFAULT TRUE,
    confidence_score DECIMAL(3,2),
    ai_model VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des métriques et statistiques
CREATE TABLE IF NOT EXISTS user_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    metric_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, metric_name, metric_date)
);

-- Table des tokens d'API
CREATE TABLE IF NOT EXISTS api_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '{}',
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Index pour les performances
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_project_id ON reviews(project_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_review_comments_review_id ON review_comments(review_id);
CREATE INDEX IF NOT EXISTS idx_code_analyses_review_id ON code_analyses(review_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_review_id ON analysis_results(review_id);
CREATE INDEX IF NOT EXISTS idx_analysis_results_severity ON analysis_results(severity);
CREATE INDEX IF NOT EXISTS idx_generated_tests_review_id ON generated_tests(review_id);
CREATE INDEX IF NOT EXISTS idx_code_optimizations_review_id ON code_optimizations(review_id);
CREATE INDEX IF NOT EXISTS idx_code_corrections_review_id ON code_corrections(review_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_user_metrics_user_id ON user_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);

-- Triggers pour updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_users
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_projects
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_code_reviews
    BEFORE UPDATE ON code_reviews
    FOR EACH ROW
    EXECUTE PROCEDURE trigger_set_timestamp();

-- Données de test (utilisateur admin par défaut)
INSERT INTO users (id, email, username, password_hash, full_name, role, email_verified)
VALUES (
    uuid_generate_v4(),
    'admin@ai-review.com',
    'admin',
    crypt('admin123', gen_salt('bf', 12)),
    'Administrator',
    'admin',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Vue pour les statistiques des reviews
CREATE OR REPLACE VIEW review_statistics AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(cr.id) as total_reviews,
    COUNT(CASE WHEN cr.status = 'completed' THEN 1 END) as completed_reviews,
    COUNT(CASE WHEN cr.status = 'failed' THEN 1 END) as failed_reviews,
    AVG(cr.processing_time_ms) as avg_processing_time,
    COUNT(ar.id) as total_issues_found,
    COUNT(CASE WHEN ar.severity IN ('critical', 'high') THEN 1 END) as critical_issues
FROM users u
LEFT JOIN code_reviews cr ON u.id = cr.user_id
LEFT JOIN analysis_results ar ON cr.id = ar.review_id
GROUP BY u.id, u.username;

COMMENT ON DATABASE ai_code_review IS 'Base de données pour l AI Code Review Assistant - Système d analyse automatique de code avec IA';
COMMENT ON TABLE users IS 'Utilisateurs du système';
COMMENT ON TABLE code_reviews IS 'Reviews de code soumises pour analyse';
COMMENT ON TABLE analysis_results IS 'Résultats d analyse de code (bugs, optimisations, etc.)';
COMMENT ON TABLE generated_tests IS 'Tests unitaires générés automatiquement';
COMMENT ON TABLE code_optimizations IS 'Optimisations de code suggérées par l IA';
COMMENT ON TABLE code_corrections IS 'Corrections de code suggérées par l IA';