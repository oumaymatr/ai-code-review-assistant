"""
Configuration - Code Analysis Service
Centralized configuration management with environment variables
"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Application
    ENV: str = Field(default="development")
    PORT: int = Field(default=3003)
    DEBUG: bool = Field(default=True)
    
    # Ollama Configuration
    OLLAMA_HOST: str = Field(default="http://localhost:11434", alias="OLLAMA_BASE_URL")
    OLLAMA_MODEL: str = Field(default="codellama")
    OLLAMA_TIMEOUT: int = Field(default=600)  # 10 minutes pour analyses complexes
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = Field(default="")
    OPENAI_MODEL: str = Field(default="gpt-3.5-turbo")
    OPENAI_MAX_TOKENS: int = Field(default=2000)
    OPENAI_TEMPERATURE: float = Field(default=0.3)
    
    # LLM Provider
    LLM_PROVIDER: str = Field(default="ollama")
    LLM_FALLBACK: str = Field(default="openai")
    
    # Database
    DB_HOST: str = Field(default="localhost")
    DB_PORT: int = Field(default=5432)
    DB_NAME: str = Field(default="code_review_db")
    DB_USER: str = Field(default="code_review_user")
    DB_PASSWORD: str = Field(default="code_review_password")
    
    @property
    def DATABASE_URL(self) -> str:
        """PostgreSQL connection URL"""
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    # Redis
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_DB: int = Field(default=1)
    REDIS_PASSWORD: str = Field(default="")
    
    @property
    def REDIS_URL(self) -> str:
        """Redis connection URL"""
        auth = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{auth}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    # Security
    API_KEY_HEADER: str = Field(default="X-API-Key")
    JWT_SECRET: str = Field(default="your_jwt_secret_change_in_production")
    
    # Analysis Settings
    MAX_CODE_LENGTH: int = Field(default=50000)
    MAX_FILE_SIZE: int = Field(default=1048576)  # 1MB
    SUPPORTED_LANGUAGES: str = Field(default="python,javascript,typescript,java,go,rust,cpp,c")
    
    @property
    def SUPPORTED_LANGUAGES_LIST(self) -> List[str]:
        """List of supported programming languages"""
        return [lang.strip() for lang in self.SUPPORTED_LANGUAGES.split(",")]
    
    # Code Analysis Options
    ANALYSIS_TIMEOUT: int = Field(default=60)
    ENABLE_SECURITY_SCAN: bool = Field(default=True)
    ENABLE_COMPLEXITY_ANALYSIS: bool = Field(default=True)
    ENABLE_STYLE_CHECK: bool = Field(default=True)
    
    # Test Generation
    TESTS_FRAMEWORK: str = Field(default="pytest")
    TESTS_COVERAGE_TARGET: int = Field(default=80)
    
    # CORS
    CORS_ORIGINS: str = Field(default="http://localhost:3000,http://localhost:3001,http://localhost:5000")
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        """List of allowed CORS origins"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # Logging
    LOG_LEVEL: str = Field(default="INFO")
    LOG_FILE: str = Field(default="logs/code-analysis.log")
    LOG_FORMAT: str = Field(default="json")
    
    # Performance
    CACHE_ENABLED: bool = Field(default=True)
    CACHE_TTL: int = Field(default=3600)
    MAX_CONCURRENT_REQUESTS: int = Field(default=10)
    
    # Health Check
    HEALTH_CHECK_INTERVAL: int = Field(default=30)
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        populate_by_name = True
        extra = "allow"


# Create global settings instance
settings = Settings()


# Export configuration summary
def get_config_summary() -> dict:
    """Get a summary of current configuration (safe for logging)"""
    return {
        "environment": settings.ENV,
        "port": settings.PORT,
        "debug": settings.DEBUG,
        "llm_provider": settings.LLM_PROVIDER,
        "ollama_model": settings.OLLAMA_MODEL,
        "openai_model": settings.OPENAI_MODEL,
        "database": {
            "host": settings.DB_HOST,
            "port": settings.DB_PORT,
            "name": settings.DB_NAME
        },
        "redis": {
            "host": settings.REDIS_HOST,
            "port": settings.REDIS_PORT
        },
        "supported_languages": settings.SUPPORTED_LANGUAGES_LIST,
        "cache_enabled": settings.CACHE_ENABLED
    }
