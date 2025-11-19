"""
LLM Manager - Orchestrates multiple LLM providers
Manages Ollama (local) and OpenAI (cloud) with automatic fallback
"""

from typing import Dict, Any, Optional, List
from enum import Enum

from src.config import settings
from src.services.ollama_client import OllamaClient
from src.services.openai_client import OpenAIClient
from src.utils.logger import logger


class LLMProvider(str, Enum):
    """Available LLM providers"""
    OLLAMA = "ollama"
    OPENAI = "openai"


class LLMManager:
    """Manager for multiple LLM providers with fallback support"""
    
    def __init__(self):
        self.ollama_client: Optional[OllamaClient] = None
        self.openai_client: Optional[OpenAIClient] = None
        self.primary_provider = LLMProvider(settings.LLM_PROVIDER.lower())
        self.fallback_provider = LLMProvider(settings.LLM_FALLBACK.lower()) if settings.LLM_FALLBACK else None
        self.initialized = False
    
    async def initialize(self):
        """Initialize LLM clients"""
        logger.info("Initializing LLM providers...")
        
        # Initialize Ollama
        if self.primary_provider == LLMProvider.OLLAMA or self.fallback_provider == LLMProvider.OLLAMA:
            try:
                self.ollama_client = OllamaClient(
                    host=settings.OLLAMA_HOST,
                    model=settings.OLLAMA_MODEL,
                    timeout=settings.OLLAMA_TIMEOUT
                )
                await self.ollama_client.health_check()
                logger.info(f"Ollama initialized ({settings.OLLAMA_MODEL})")
            except Exception as e:
                logger.warning(f"Ollama initialization failed: {e}")
                if self.primary_provider == LLMProvider.OLLAMA and not self.fallback_provider:
                    raise RuntimeError("Primary LLM provider (Ollama) unavailable and no fallback configured")
        
        # Initialize OpenAI
        if self.primary_provider == LLMProvider.OPENAI or self.fallback_provider == LLMProvider.OPENAI:
            try:
                if settings.OPENAI_API_KEY and settings.OPENAI_API_KEY != "your_openai_api_key_here":
                    self.openai_client = OpenAIClient(
                        api_key=settings.OPENAI_API_KEY,
                        model=settings.OPENAI_MODEL,
                        max_tokens=settings.OPENAI_MAX_TOKENS,
                        temperature=settings.OPENAI_TEMPERATURE
                    )
                    await self.openai_client.health_check()
                    logger.info(f"OpenAI initialized ({settings.OPENAI_MODEL})")
                else:
                    logger.warning("OpenAI API key not configured")
            except Exception as e:
                logger.warning(f"OpenAI initialization failed: {e}")
                if self.primary_provider == LLMProvider.OPENAI and not self.fallback_provider:
                    raise RuntimeError("Primary LLM provider (OpenAI) unavailable and no fallback configured")
        
        self.initialized = True
        logger.info(f"LLM Manager ready (primary: {self.primary_provider}, fallback: {self.fallback_provider})")
    
    async def cleanup(self):
        """Cleanup LLM clients"""
        logger.info("Cleaning up LLM providers...")
        
        if self.ollama_client:
            await self.ollama_client.close()
        
        if self.openai_client:
            await self.openai_client.close()
        
        logger.info("LLM cleanup complete")
    
    def get_status(self) -> Dict[str, Any]:
        """Get status of all LLM providers"""
        return {
            "initialized": self.initialized,
            "primary_provider": self.primary_provider.value,
            "fallback_provider": self.fallback_provider.value if self.fallback_provider else None,
            "providers": {
                "ollama": {
                    "available": self.ollama_client is not None,
                    "model": settings.OLLAMA_MODEL if self.ollama_client else None
                },
                "openai": {
                    "available": self.openai_client is not None,
                    "model": settings.OPENAI_MODEL if self.openai_client else None
                }
            }
        }
    
    async def _generate_with_provider(
        self,
        prompt: str,
        system_prompt: Optional[str],
        provider: LLMProvider,
        **kwargs
    ) -> Dict[str, Any]:
        """Generate using specific provider"""
        
        if provider == LLMProvider.OLLAMA:
            if not self.ollama_client:
                raise RuntimeError("Ollama client not available")
            
            result = await self.ollama_client.generate(
                prompt=prompt,
                system=system_prompt,
                **kwargs
            )
            
            # Normalize Ollama response format
            return {
                "text": result.get("response", ""),
                "provider": "ollama",
                "model": result.get("model", settings.OLLAMA_MODEL)
            }
        
        elif provider == LLMProvider.OPENAI:
            if not self.openai_client:
                raise RuntimeError("OpenAI client not available")
            
            result = await self.openai_client.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                **kwargs
            )
            
            # Normalize OpenAI response format
            return {
                "text": result.get("content", ""),
                "provider": "openai",
                "model": result.get("model", settings.OPENAI_MODEL),
                "usage": result.get("usage")
            }
        
        else:
            raise ValueError(f"Unknown provider: {provider}")
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate text using primary provider with automatic fallback
        
        Args:
            prompt: User prompt
            system_prompt: System prompt
            **kwargs: Additional generation parameters
            
        Returns:
            Generated response with metadata
        """
        if not self.initialized:
            raise RuntimeError("LLM Manager not initialized")
        
        # Try primary provider
        try:
            logger.info(f"Generating with primary provider: {self.primary_provider}")
            result = await self._generate_with_provider(
                prompt=prompt,
                system_prompt=system_prompt,
                provider=self.primary_provider,
                **kwargs
            )
            return result
        
        except Exception as e:
            error_msg = f"{type(e).__name__}: {str(e)}" if str(e) else type(e).__name__
            logger.warning(f"Primary provider failed: {error_msg}")
            
            # Try fallback if available
            if self.fallback_provider:
                try:
                    logger.info(f"Trying fallback provider: {self.fallback_provider}")
                    result = await self._generate_with_provider(
                        prompt=prompt,
                        system_prompt=system_prompt,
                        provider=self.fallback_provider,
                        **kwargs
                    )
                    logger.info("Fallback successful")
                    return result
                
                except Exception as fallback_error:
                    fallback_msg = f"{type(fallback_error).__name__}: {str(fallback_error)}" if str(fallback_error) else type(fallback_error).__name__
                    logger.error(f"Fallback provider also failed: {fallback_msg}")
                    raise RuntimeError(f"All LLM providers failed. Primary: {error_msg}, Fallback: {fallback_msg}")
            
            raise RuntimeError(f"LLM generation failed: {error_msg}")
    
    async def analyze_code(
        self,
        code: str,
        language: str,
        analysis_type: str = "full"
    ) -> Dict[str, Any]:
        """
        Analyze code for issues, bugs, and improvements
        
        Args:
            code: Source code to analyze
            language: Programming language
            analysis_type: Type of analysis (full, security, performance, style, bugs)
            
        Returns:
            Analysis results with structured data
        """
        
        system_prompt = f"""You are an expert {language} code reviewer."""

        # Limiter la taille du code pour éviter les timeouts
        code_lines = code.split('\n')
        if len(code_lines) > 200:
            logger.warning(f"Code too long ({len(code_lines)} lines), truncating to first 200 lines")
            code = '\n'.join(code_lines[:200]) + '\n\n# ... (code truncated for analysis)'
        
        if len(code) > 8000:
            logger.warning(f"Code too long ({len(code)} chars), truncating to 8000 chars")
            code = code[:8000] + '\n\n# ... (code truncated for analysis)'

        user_prompt = f"""Analyze this {language} code and list specific issues in numbered format.

For each issue, provide:
- Severity (CRITICAL, HIGH, MEDIUM, or LOW)
- Type (bug, security, performance, or style)
- Line: [line number] (ALWAYS specify the line number where the issue occurs)
- Description
- Fix suggestion

Code with line numbers:
```{language}
{code}
```

IMPORTANT: Always include "Line: X" where X is the actual line number in the code above.

List all issues found."""
        
        result = await self.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.1
        )
        
        # Parse markdown-style response into structured data
        import re
        
        response_text = result.get("text", "")
        issues = []
        
        # Extract issues from markdown/text response
        # Look for severity indicators
        severity_patterns = {
            'critical': re.compile(r'(?:critical|🔴|CRITICAL)', re.IGNORECASE),
            'high': re.compile(r'(?:high|HIGH|🟠)', re.IGNORECASE),
            'medium': re.compile(r'(?:medium|MEDIUM|🟡)', re.IGNORECASE),
            'low': re.compile(r'(?:low|LOW|🔵)', re.IGNORECASE)
        }
        
        type_patterns = {
            'security': re.compile(r'(?:security|vulnerability|vulnerabilities|XSS|SQL injection|authentication)', re.IGNORECASE),
            'bug': re.compile(r'(?:bug|error|logic error|incorrect)', re.IGNORECASE),
            'performance': re.compile(r'(?:performance|latency|slow|N\+1|resource|optimization)', re.IGNORECASE),
            'style': re.compile(r'(?:style|readability|maintainability|naming|convention)', re.IGNORECASE)
        }
        
        # Split by numbered sections or headers
        sections = re.split(r'\n(?:#+\s+|\d+\.\s+|[\*\-]\s+)', response_text)
        
        for section in sections:
            if len(section.strip()) < 20:  # Skip very short sections
                continue
            
            # Detect severity
            severity = 'medium'  # default
            for sev, pattern in severity_patterns.items():
                if pattern.search(section):
                    severity = sev
                    break
            
            # Detect type
            issue_type = 'bug'  # default
            for itype, pattern in type_patterns.items():
                if pattern.search(section):
                    issue_type = itype
                    break
            
            # Extract line number (support multiple formats: "Line: 5", "line 5", "Line 5:", "at line 5")
            line_match = re.search(r'(?:at\s+)?line[:\s]+(\d+)|line\s*:\s*(\d+)', section, re.IGNORECASE)
            line_num = None
            if line_match:
                line_num = int(line_match.group(1) or line_match.group(2))
            
            # Extract message (first sentence or paragraph)
            message_lines = [l.strip() for l in section.split('\n') if l.strip() and not l.strip().startswith('#')]
            message = message_lines[0][:1000] if message_lines else section[:1000].strip()
            
            # Extract suggestion
            suggestion = None
            if 'recommendation' in section.lower() or 'fix' in section.lower() or 'should' in section.lower():
                suggestion_match = re.search(r'(?:recommendation|fix|should|use|implement)[:\s]+([^\n]+)', section, re.IGNORECASE)
                if suggestion_match:
                    suggestion = suggestion_match.group(1).strip()[:1000]
            
            if message:
                issues.append({
                    "severity": severity,
                    "type": issue_type,
                    "line": line_num,
                    "message": message,
                    "suggestion": suggestion
                })
        
        # Count by severity
        summary = {
            "total_issues": len(issues),
            "critical": len([i for i in issues if i["severity"] == "critical"]),
            "high": len([i for i in issues if i["severity"] == "high"]),
            "medium": len([i for i in issues if i["severity"] == "medium"]),
            "low": len([i for i in issues if i["severity"] == "low"])
        }
        
        # Extract recommendations
        recommendations = []
        rec_section = re.search(r'(?:recommendation|improve|suggest)s?[:\s]+(.+?)(?:\n\n|\Z)', response_text, re.IGNORECASE | re.DOTALL)
        if rec_section:
            rec_lines = [l.strip('- •*') for l in rec_section.group(1).split('\n') if l.strip()]
            recommendations = [r[:150] for r in rec_lines[:5] if len(r) > 10]
        
        result["parsed_data"] = {
            "issues": issues,
            "summary": summary,
            "recommendations": recommendations,
            "raw_analysis": response_text
        }
        
        return result
    
    async def optimize_code(
        self,
        code: str,
        language: str,
        focus: str = "performance"
    ) -> Dict[str, Any]:
        """
        Optimize code for performance, readability, or memory usage
        
        Args:
            code: Source code to optimize
            language: Programming language
            focus: Optimization focus (performance, readability, memory)
            
        Returns:
            Optimized code with explanations
        """
        focus_prompts = {
            "performance": "Optimize this code for maximum performance and efficiency.",
            "readability": "Refactor this code for better readability and maintainability.",
            "memory": "Optimize this code to reduce memory usage and prevent leaks."
        }
        
        system_prompt = f"""You are an expert {language} developer specializing in code optimization.
Provide optimized code that maintains functionality while improving {focus}."""
        
        user_prompt = f"""{focus_prompts.get(focus, focus_prompts["performance"])}

Original {language} code:
```{language}
{code}
```

Provide:
1. Optimized version of the code
2. Explanation of changes made
3. Expected impact/improvements

Format your response clearly with the optimized code in a code block."""
        
        return await self.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.2
        )
    
    async def generate_tests(
        self,
        code: str,
        language: str,
        framework: str
    ) -> Dict[str, Any]:
        """
        Generate unit tests for code
        
        Args:
            code: Source code to test
            language: Programming language
            framework: Testing framework to use
            
        Returns:
            Generated test code
        """
        system_prompt = f"""You are an expert {language} developer specializing in test-driven development.
Generate comprehensive unit tests using {framework}."""
        
        user_prompt = f"""Generate comprehensive unit tests for this {language} code using {framework}.

Code to test:
```{language}
{code}
```

Generate tests that cover:
- Happy path scenarios
- Edge cases
- Error conditions
- Boundary values
- All code paths

Provide complete, runnable test code with:
- Proper imports and setup
- Clear test names
- Assertions for expected behavior
- Mocks/fixtures where needed
- Comments explaining test purpose

Format the tests in a code block."""
        
        return await self.generate(
            prompt=user_prompt,
            system_prompt=system_prompt,
            temperature=0.3
        )


# Global LLM manager instance
llm_manager = LLMManager()
