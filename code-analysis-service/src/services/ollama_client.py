"""
Ollama Client - Local LLM integration (100% gratuit)
Interface pour interagir avec Ollama (CodeLlama, Llama2, Mistral)
"""

import aiohttp
import asyncio
from typing import Optional, Dict, Any, List

from src.utils.logger import logger


class OllamaClient:
    """Client for Ollama local LLM server"""
    
    def __init__(
        self,
        host: str = "http://localhost:11434",
        model: str = "codellama:7b",
        timeout: int = 600
    ):
        self.host = host.rstrip("/")
        self.model = model
        self.timeout = timeout
        self.session: Optional[aiohttp.ClientSession] = None
        logger.info(f"OllamaClient initialized with timeout: {timeout}s")
    
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get or create aiohttp session"""
        if self.session is None or self.session.closed:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self.session = aiohttp.ClientSession(timeout=timeout)
        return self.session
    
    async def close(self):
        """Close the aiohttp session"""
        if self.session and not self.session.closed:
            await self.session.close()
    
    async def health_check(self) -> bool:
        """Check if Ollama server is running"""
        try:
            session = await self._get_session()
            async with session.get(f"{self.host}/api/tags") as response:
                if response.status == 200:
                    logger.info("Ollama server is healthy")
                    return True
                else:
                    logger.warning(f"Ollama server returned status {response.status}")
                    return False
        except Exception as e:
            logger.error(f"Ollama health check failed: {e}")
            raise
    
    async def list_models(self) -> List[Dict[str, Any]]:
        """List available models"""
        try:
            session = await self._get_session()
            async with session.get(f"{self.host}/api/tags") as response:
                response.raise_for_status()
                data = await response.json()
                return data.get("models", [])
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
            raise
    
    async def pull_model(self, model: Optional[str] = None) -> bool:
        """Pull a model from Ollama library"""
        model_name = model or self.model
        
        try:
            logger.info(f"Pulling model: {model_name}")
            session = await self._get_session()
            
            async with session.post(
                f"{self.host}/api/pull",
                json={"name": model_name}
            ) as response:
                response.raise_for_status()
                
                async for line in response.content:
                    if line:
                        data = line.decode('utf-8').strip()
                
                logger.info(f"Model pulled successfully: {model_name}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to pull model: {e}")
            raise
    
    async def generate(
        self,
        prompt: str,
        system: Optional[str] = None,
        model: Optional[str] = None,
        temperature: float = 0.3,
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Generate text using Ollama
        
        Args:
            prompt: User prompt
            system: System prompt
            model: Model to use (defaults to self.model)
            temperature: Temperature for generation
            stream: Whether to stream the response
            **kwargs: Additional generation parameters
            
        Returns:
            Generated response
        """
        model_name = model or self.model
        
        payload = {
            "model": model_name,
            "prompt": prompt,
            "stream": stream,
            "options": {
                "temperature": temperature,
                **kwargs
            }
        }
        
        if system:
            payload["system"] = system
        
        try:
            logger.info(f"Generating with Ollama ({model_name})...")
            session = await self._get_session()
            
            # Créer un timeout spécifique pour cette requête
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            
            async with session.post(
                f"{self.host}/api/generate",
                json=payload,
                timeout=timeout
            ) as response:
                response.raise_for_status()
                
                if stream:
                    pass
                else:
                    result = await response.json()
                    logger.info("Generation complete")
                    return result
                    
        except asyncio.TimeoutError as e:
            logger.error(f"Ollama timeout after {self.timeout}s: {e}")
            raise RuntimeError(f"Ollama generation timed out after {self.timeout} seconds. Try a smaller model or increase timeout.")
        except aiohttp.ClientError as e:
            logger.error(f"Ollama API error: {type(e).__name__} - {str(e)}")
            raise RuntimeError(f"Ollama API request failed: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in Ollama generate: {type(e).__name__} - {str(e)}")
            raise RuntimeError(f"Ollama error: {type(e).__name__} - {str(e)}")
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.3,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Chat completion using Ollama
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: Model to use
            temperature: Temperature for generation
            **kwargs: Additional parameters
            
        Returns:
            Chat response
        """
        model_name = model or self.model
        
        payload = {
            "model": model_name,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                **kwargs
            }
        }
        
        try:
            logger.info(f"Chat with Ollama ({model_name})...")
            session = await self._get_session()
            
            async with session.post(
                f"{self.host}/api/chat",
                json=payload
            ) as response:
                response.raise_for_status()
                result = await response.json()
                logger.info("Chat complete")
                return result
                
        except Exception as e:
            logger.error(f"Ollama chat error: {e}")
            raise
    
    async def embed(
        self,
        text: str,
        model: Optional[str] = None
    ) -> List[float]:
        """
        Generate embeddings
        
        Args:
            text: Text to embed
            model: Model to use
            
        Returns:
            Embedding vector
        """
        model_name = model or self.model
        
        try:
            session = await self._get_session()
            
            async with session.post(
                f"{self.host}/api/embeddings",
                json={"model": model_name, "prompt": text}
            ) as response:
                response.raise_for_status()
                result = await response.json()
                return result.get("embedding", [])
                
        except Exception as e:
            logger.error(f"Ollama embeddings error: {e}")
            raise
