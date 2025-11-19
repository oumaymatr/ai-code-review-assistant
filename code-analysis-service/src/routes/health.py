"""
Health Check Routes - Service health monitoring
"""

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
from typing import Dict, Any

from src.services.llm_manager import llm_manager
from src.utils.logger import logger

router = APIRouter()


@router.get("", response_model=Dict[str, Any])
async def health_check():
    """
    Health check endpoint
    Returns service status and LLM provider availability
    """
    try:
        llm_status = llm_manager.get_status()
        
        is_healthy = (
            llm_status["initialized"] and
            (llm_status["providers"]["ollama"]["available"] or 
             llm_status["providers"]["openai"]["available"])
        )
        
        return {
            "status": "healthy" if is_healthy else "degraded",
            "service": "code-analysis-service",
            "version": "1.0.0",
            "llm_providers": llm_status["providers"],
            "primary_provider": llm_status["primary_provider"],
            "fallback_provider": llm_status["fallback_provider"]
        }
    
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "code-analysis-service",
                "error": str(e)
            }
        )


@router.get("/ready")
async def readiness_check():
    """Readiness check for Kubernetes/Docker"""
    try:
        llm_status = llm_manager.get_status()
        
        if not llm_status["initialized"]:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"ready": False, "reason": "LLM providers not initialized"}
            )
        
        # Check if at least one provider is available
        if not (llm_status["providers"]["ollama"]["available"] or 
                llm_status["providers"]["openai"]["available"]):
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"ready": False, "reason": "No LLM providers available"}
            )
        
        return {"ready": True}
    
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False, "error": str(e)}
        )


@router.get("/live")
async def liveness_check():
    """Liveness check for Kubernetes/Docker"""
    return {"alive": True}
