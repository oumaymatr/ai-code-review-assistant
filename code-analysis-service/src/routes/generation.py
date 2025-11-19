"""
Test Generation Routes - AI-powered test generation
"""

from fastapi import APIRouter, HTTPException, status, Query
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List

from src.config import settings
from src.services.llm_manager import llm_manager
from src.utils.logger import logger

router = APIRouter()


# Request/Response Models
class TestGenerationRequest(BaseModel):
    """Request model for test generation"""
    code: str = Field(..., max_length=settings.MAX_CODE_LENGTH)
    language: str
    framework: Optional[str] = None
    coverage_target: Optional[int] = Field(None, ge=0, le=100)
    include_edge_cases: bool = Field(default=True)
    include_mocks: bool = Field(default=True)
    
    @validator('language')
    def validate_language(cls, v):
        if v.lower() not in settings.SUPPORTED_LANGUAGES_LIST:
            raise ValueError(f"Unsupported language")
        return v.lower()


class TestGenerationResponse(BaseModel):
    """Response model for test generation"""
    success: bool
    language: str
    framework: str
    test_code: str
    test_cases: List[str]
    coverage_estimate: Optional[int] = None
    provider: str


class TestCase(BaseModel):
    """Individual test case"""
    name: str
    description: str
    test_type: str  # unit, integration, edge_case
    code: str


# Test Generation Endpoints

@router.post("/generate-tests", response_model=TestGenerationResponse)
async def generate_tests(request: TestGenerationRequest):
    """
    Generate unit tests for code
    
    Creates comprehensive test suite including:
    - Positive test cases
    - Negative test cases
    - Edge cases
    - Mocks and fixtures
    - Assertions for all code paths
    
    Supports multiple testing frameworks per language
    """
    try:
        framework = request.framework or _get_default_framework(request.language)
        
        logger.info(f"🧪 Generating tests for {request.language} using {framework}")
        
        result = await llm_manager.generate_tests(
            code=request.code,
            language=request.language,
            framework=framework
        )
        
        test_cases = []
        
        return TestGenerationResponse(
            success=True,
            language=request.language,
            framework=framework,
            test_code=result["text"],
            test_cases=test_cases,
            coverage_estimate=request.coverage_target or settings.TESTS_COVERAGE_TARGET,
            provider=result["provider"]
        )
    
    except Exception as e:
        logger.error(f"Test generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test generation failed: {str(e)}"
        )


@router.post("/generate-test-data")
async def generate_test_data(
    schema: Dict[str, Any],
    count: int = Query(default=10, ge=1, le=100),
    format: str = Query(default="json", pattern="^(json|csv|sql)$")
):
    """
    Generate test data based on schema
    
    Creates realistic test data for testing purposes
    """
    try:
        logger.info(f"📊 Generating {count} test data entries")
        
        system_prompt = """You are a test data generator.
Generate realistic, diverse test data based on the provided schema.
Ensure data is valid and covers various edge cases."""

        user_prompt = f"""Generate {count} test data entries in {format} format for this schema:

{schema}

Make the data realistic and diverse."""

        result = await llm_manager.generate(
            prompt=user_prompt,
            system_prompt=system_prompt
        )
        
        return {
            "success": True,
            "count": count,
            "format": format,
            "data": result["text"],
            "provider": result["provider"]
        }
    
    except Exception as e:
        logger.error(f"Test data generation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test data generation failed: {str(e)}"
        )


@router.post("/suggest-test-cases")
async def suggest_test_cases(
    code: str,
    language: str,
    existing_tests: Optional[str] = None
):
    """
    Suggest additional test cases
    
    Analyzes code and existing tests to suggest missing test cases
    """
    try:
        logger.info(f"💡 Suggesting test cases for {language} code")
        
        system_prompt = f"""You are an expert QA engineer specializing in {language}.
Analyze the code and suggest test cases that should be added.
Focus on:
- Untested code paths
- Edge cases
- Error scenarios
- Boundary conditions"""

        user_prompt = f"""Analyze this {language} code:

```{language}
{code}
```
"""
        
        if existing_tests:
            user_prompt += f"""
Existing tests:
```{language}
{existing_tests}
```
"""
        
        user_prompt += "\nSuggest additional test cases needed for comprehensive coverage."
        
        result = await llm_manager.generate(
            prompt=user_prompt,
            system_prompt=system_prompt
        )
        
        return {
            "success": True,
            "language": language,
            "suggestions": result["text"],
            "provider": result["provider"]
        }
    
    except Exception as e:
        logger.error(f"Test case suggestion failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Test case suggestion failed: {str(e)}"
        )


# Helper Functions

def _get_default_framework(language: str) -> str:
    """Get default testing framework for language"""
    frameworks = {
        "python": "pytest",
        "javascript": "jest",
        "typescript": "jest",
        "java": "junit",
        "go": "testing",
        "rust": "cargo test",
        "cpp": "googletest",
        "c": "unity"
    }
    return frameworks.get(language.lower(), "pytest")
