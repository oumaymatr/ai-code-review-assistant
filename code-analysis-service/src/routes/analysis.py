"""
Code Analysis Routes - AI-powered code analysis endpoints
"""

from fastapi import APIRouter, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List

from src.config import settings
from src.services.llm_manager import llm_manager
from src.utils.logger import logger

router = APIRouter()


# Request/Response Models
class CodeAnalysisRequest(BaseModel):
    """Request model for code analysis"""
    code: str = Field(..., description="Code to analyze", max_length=settings.MAX_CODE_LENGTH)
    language: str = Field(..., description="Programming language")
    analysis_type: str = Field(default="full", description="Type of analysis: full, security, performance, style")
    context: Optional[str] = Field(None, description="Additional context about the code")
    
    @validator('language')
    def validate_language(cls, v):
        if v.lower() not in settings.SUPPORTED_LANGUAGES_LIST:
            raise ValueError(f"Unsupported language. Supported: {', '.join(settings.SUPPORTED_LANGUAGES_LIST)}")
        return v.lower()
    
    @validator('analysis_type')
    def validate_analysis_type(cls, v):
        allowed_types = ["full", "security", "performance", "style", "bugs"]
        if v.lower() not in allowed_types:
            raise ValueError(f"Invalid analysis type. Allowed: {', '.join(allowed_types)}")
        return v.lower()


class Issue(BaseModel):
    """Code issue model"""
    severity: str  # critical, high, medium, low
    type: str      # bug, security, performance, style
    line: Optional[int] = None
    message: str
    suggestion: Optional[str] = None


class CodeAnalysisResponse(BaseModel):
    """Response model for code analysis"""
    success: bool
    language: str
    analysis_type: str
    issues: List[Issue]
    summary: Dict[str, Any]
    provider: str
    processing_time: float


class OptimizationRequest(BaseModel):
    """Request model for code optimization"""
    code: str = Field(..., max_length=settings.MAX_CODE_LENGTH)
    language: str
    focus: str = Field(default="performance", description="Optimization focus: performance, readability, memory")
    
    @validator('language')
    def validate_language(cls, v):
        if v.lower() not in settings.SUPPORTED_LANGUAGES_LIST:
            raise ValueError(f"Unsupported language")
        return v.lower()


class OptimizationResponse(BaseModel):
    """Response model for code optimization"""
    success: bool
    original_code: str
    optimized_code: str
    changes: List[str]
    impact: Dict[str, Any]
    provider: str


# Analysis Endpoints

@router.post("/analyze", response_model=CodeAnalysisResponse)
async def analyze_code(request: CodeAnalysisRequest):
    """
    Analyze code for issues, bugs, security vulnerabilities, and improvements
    
    This endpoint uses AI to perform comprehensive code analysis including:
    - Bug detection
    - Security vulnerability scanning
    - Performance issues
    - Code style violations
    - Best practices recommendations
    """
    try:
        logger.info(f"Analyzing {request.language} code ({request.analysis_type})")
        
        import time
        start_time = time.time()
        
        # Perform analysis using LLM
        result = await llm_manager.analyze_code(
            code=request.code,
            language=request.language,
            analysis_type=request.analysis_type
        )
        
        processing_time = time.time() - start_time
        
        # Extract parsed data from result
        parsed_data = result.get("parsed_data", {})
        issues_data = parsed_data.get("issues", [])
        summary_data = parsed_data.get("summary", {})
        recommendations = parsed_data.get("recommendations", [])
        raw_analysis = parsed_data.get("raw_analysis", result.get("text", ""))
        
        # Convert parsed issues to Issue objects
        issues = []
        for issue_dict in issues_data:
            try:
                issues.append(Issue(
                    severity=issue_dict.get("severity", "low"),
                    type=issue_dict.get("type", "general"),
                    line=issue_dict.get("line"),
                    message=issue_dict.get("message", ""),
                    suggestion=issue_dict.get("suggestion")
                ))
            except Exception as e:
                logger.warning(f"Failed to parse issue: {e}")
                continue
        
        return CodeAnalysisResponse(
            success=True,
            language=request.language,
            analysis_type=request.analysis_type,
            issues=issues,
            summary={
                "total_issues": summary_data.get("total_issues", len(issues)),
                "critical": summary_data.get("critical", 0),
                "high": summary_data.get("high", 0),
                "medium": summary_data.get("medium", 0),
                "low": summary_data.get("low", 0),
                "raw_analysis": raw_analysis,
                "recommendations": recommendations
            },
            provider=result["provider"],
            processing_time=processing_time
        )
    
    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )


@router.post("/optimize", response_model=OptimizationResponse)
async def optimize_code(request: OptimizationRequest):
    """
    Optimize code for performance, readability, or memory usage
    
    Returns optimized version of the code with explanations of changes
    """
    try:
        logger.info(f"⚡ Optimizing {request.language} code ({request.focus})")
        
        result = await llm_manager.optimize_code(
            code=request.code,
            language=request.language,
            focus=request.focus
        )
        
        optimized_code = result["text"]
        
        return OptimizationResponse(
            success=True,
            original_code=request.code,
            optimized_code=optimized_code,
            changes=["Placeholder - parse from LLM response"],
            impact={
                "estimated_improvement": "Parse from LLM response",
                "raw_response": result["text"]
            },
            provider=result["provider"]
        )
    
    except Exception as e:
        logger.error(f"Optimization failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Optimization failed: {str(e)}"
        )


@router.post("/document")
async def document_code(
    code: str,
    language: str,
    style: str = "detailed"
):
    """
    Generate documentation for code
    
    Creates comprehensive documentation including:
    - Function/class descriptions
    - Parameter documentation
    - Return value documentation
    - Usage examples
    """
    try:
        logger.info(f"Documenting {language} code")
        
        system_prompt = f"""You are an expert technical writer specializing in {language}.
Generate comprehensive documentation for the provided code including:
- Clear function/class descriptions
- Parameter documentation with types
- Return value documentation
- Usage examples
- Notes about edge cases or important behavior

Follow {language} documentation conventions."""

        user_prompt = f"""Generate documentation for this {language} code:

```{language}
{code}
```

Provide {style} documentation following best practices."""

        result = await llm_manager.generate(
            prompt=user_prompt,
            system_prompt=system_prompt
        )
        
        return {
            "success": True,
            "language": language,
            "documentation": result["text"],
            "provider": result["provider"]
        }
    
    except Exception as e:
        logger.error(f"Documentation generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Documentation generation failed: {str(e)}"
        )


@router.post("/explain")
async def explain_code(
    code: str,
    language: str,
    level: str = "intermediate"
):
    """
    Explain what code does in natural language
    
    Provides clear explanations suitable for different skill levels:
    - beginner: Simple, high-level explanation
    - intermediate: Detailed explanation with examples
    - advanced: In-depth technical analysis
    """
    try:
        logger.info(f"Explaining {language} code ({level} level)")
        
        system_prompt = f"""You are an expert {language} developer and teacher.
Explain the provided code clearly for a {level} developer.
Include:
- What the code does (high-level)
- How it works (step-by-step)
- Key concepts used
- Potential use cases

Use clear, accessible language appropriate for {level} level."""

        user_prompt = f"""Explain this {language} code:

```{language}
{code}
```

Provide a {level}-level explanation."""

        result = await llm_manager.generate(
            prompt=user_prompt,
            system_prompt=system_prompt
        )
        
        return {
            "success": True,
            "language": language,
            "level": level,
            "explanation": result["text"],
            "provider": result["provider"]
        }
    
    except Exception as e:
        logger.error(f"Code explanation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Code explanation failed: {str(e)}"
        )
