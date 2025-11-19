"""
Code Analysis Service - Main Application
FastAPI service for AI-powered code analysis using Ollama & OpenAI
"""

import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from src.config import settings
from src.utils.logger import setup_logger, logger
from src.routes import analysis, generation, health
from src.middleware.auth import verify_jwt_token
from src.middleware.rate_limit import RateLimitMiddleware
from src.services.llm_manager import llm_manager

# Setup logging
setup_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for application startup and shutdown"""
    logger.info("Starting Code Analysis Service...")
    
    # Initialize LLM providers
    try:
        await llm_manager.initialize()
        logger.info("LLM providers initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize LLM providers: {e}")
    
    yield
    
    # Cleanup
    logger.info("Shutting down Code Analysis Service...")
    await llm_manager.cleanup()


# Create FastAPI application
app = FastAPI(
    title="AI Code Review - Analysis Service",
    description="AI-powered code analysis, optimization, and test generation service",
    version="1.0.0",
    docs_url="/api/docs" if settings.DEBUG else None,
    redoc_url="/api/redoc" if settings.DEBUG else None,
    lifespan=lifespan
)


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Compression middleware
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    """Add processing time to response headers"""
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(round(process_time, 3))
    return response


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming requests"""
    logger.info(
        f"{request.method} {request.url.path}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host if request.client else "unknown"
        }
    )
    response = await call_next(request)
    logger.info(
        f"{request.method} {request.url.path} - {response.status_code}",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code
        }
    )
    return response


# Error handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors"""
    logger.warning(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error": "Validation error",
            "details": exc.errors()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle general exceptions"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": "Internal server error",
            "message": str(exc) if settings.DEBUG else "An error occurred"
        }
    )


# Root endpoint
@app.get("/")
async def root():
    """Root endpoint - service information"""
    return {
        "service": "Code Analysis Service",
        "version": "1.0.0",
        "status": "running",
        "providers": {
            "primary": settings.LLM_PROVIDER,
            "fallback": settings.LLM_FALLBACK
        },
        "docs": "/api/docs" if settings.DEBUG else None
    }


# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(analysis.router, prefix="/api", tags=["Analysis"])
app.include_router(generation.router, prefix="/api", tags=["Generation"])


if __name__ == "__main__":
    import uvicorn
    
    logger.info(f"Starting server on port {settings.PORT}")
    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )
