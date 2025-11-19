"""
OpenAI Client - Cloud LLM integration (avec quota gratuit)
Interface pour interagir avec l'API OpenAI
"""

import asyncio
from typing import Optional, Dict, Any, List
import openai
from openai import AsyncOpenAI

from src.utils.logger import logger


class OpenAIClient:
    """Client for OpenAI API"""
    
    def __init__(
        self,
        api_key: str,
        model: str = "gpt-3.5-turbo",
        max_tokens: int = 2000,
        temperature: float = 0.3
    ):
        self.api_key = api_key
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.client: Optional[AsyncOpenAI] = None
        
        if api_key and api_key != "your_openai_api_key_here":
            self.client = AsyncOpenAI(api_key=api_key)
    
    async def close(self):
        """Cleanup client resources"""
        if self.client:
            await self.client.close()
    
    async def health_check(self) -> bool:
        """Check if OpenAI API is accessible"""
        if not self.client:
            raise RuntimeError("OpenAI client not configured (missing API key)")
        
        try:
            # Simple test to verify API key and connectivity
            models = await self.client.models.list()
            logger.info("OpenAI API is accessible")
            return True
        except openai.AuthenticationError:
            logger.error("OpenAI authentication failed (invalid API key)")
            raise
        except Exception as e:
            logger.error(f"OpenAI health check failed: {e}")
            raise
    
    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate text using OpenAI
        
        Args:
            prompt: User prompt
            system_prompt: System prompt
            model: Model to use
            temperature: Temperature for generation
            max_tokens: Maximum tokens to generate
            **kwargs: Additional parameters
            
        Returns:
            Generated response with metadata
        """
        if not self.client:
            raise RuntimeError("OpenAI client not configured")
        
        messages = []
        
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        
        messages.append({"role": "user", "content": prompt})
        
        try:
            logger.info(f"Generating with OpenAI ({model or self.model})...")
            
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                temperature=temperature or self.temperature,
                max_tokens=max_tokens or self.max_tokens,
                **kwargs
            )
            
            logger.info("Generation complete")
            
            # Extract response
            choice = response.choices[0]
            
            return {
                "content": choice.message.content,
                "finish_reason": choice.finish_reason,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                },
                "model": response.model
            }
            
        except openai.RateLimitError as e:
            logger.error(f"OpenAI rate limit exceeded: {e}")
            raise RuntimeError("OpenAI rate limit exceeded")
        except openai.APIError as e:
            logger.error(f"OpenAI API error: {e}")
            raise RuntimeError(f"OpenAI API error: {e}")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: Optional[float] = None,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Chat completion using OpenAI
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use
            temperature: Temperature
            max_tokens: Max tokens
            **kwargs: Additional parameters
            
        Returns:
            Chat response
        """
        if not self.client:
            raise RuntimeError("OpenAI client not configured")
        
        try:
            logger.info(f"Chat with OpenAI ({model or self.model})...")
            
            response = await self.client.chat.completions.create(
                model=model or self.model,
                messages=messages,
                temperature=temperature or self.temperature,
                max_tokens=max_tokens or self.max_tokens,
                **kwargs
            )
            
            logger.info("Chat complete")
            
            choice = response.choices[0]
            
            return {
                "content": choice.message.content,
                "finish_reason": choice.finish_reason,
                "usage": {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens
                }
            }
            
        except Exception as e:
            logger.error(f"OpenAI chat error: {e}")
            raise
    
    async def embed(
        self,
        text: str,
        model: str = "text-embedding-ada-002"
    ) -> List[float]:
        """
        Generate embeddings
        
        Args:
            text: Text to embed
            model: Embedding model
            
        Returns:
            Embedding vector
        """
        if not self.client:
            raise RuntimeError("OpenAI client not configured")
        
        try:
            response = await self.client.embeddings.create(
                model=model,
                input=text
            )
            
            return response.data[0].embedding
            
        except Exception as e:
            logger.error(f"OpenAI embeddings error: {e}")
            raise
