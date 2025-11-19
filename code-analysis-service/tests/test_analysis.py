import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock
from src.services.ollama_client import OllamaClient
from src.services.openai_client import OpenAIClient
from src.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

class TestCodeAnalysisService:
    
    def test_health_endpoint(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
        assert response.json()["service"] == "code-analysis-service"
    
    @pytest.mark.asyncio
    async def test_ollama_client_analyze(self):
        ollama_client = OllamaClient(base_url="http://localhost:11434", timeout=60)
        
        with patch('aiohttp.ClientSession.post') as mock_post:
            mock_response = AsyncMock()
            mock_response.status = 200
            mock_response.json = AsyncMock(return_value={
                "response": "Code analysis completed successfully"
            })
            mock_post.return_value.__aenter__.return_value = mock_response
            
            result = await ollama_client.analyze_code("function test() { return 1; }", "javascript")
            
            assert result is not None
            assert "analysis" in result or "response" in result
    
    def test_code_analysis_endpoint(self):
        payload = {
            "code": "function add(a, b) { return a + b; }",
            "language": "javascript"
        }
        
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/api/analyze", json=payload, headers=headers)
        
        assert response.status_code in [200, 202]
    
    def test_code_analysis_missing_code(self):
        payload = {
            "language": "javascript"
        }
        
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/api/analyze", json=payload, headers=headers)
        
        assert response.status_code == 422
    
    def test_test_generation_endpoint(self):
        payload = {
            "code": "def multiply(x, y):\n    return x * y",
            "language": "python"
        }
        
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/api/generate-tests", json=payload, headers=headers)
        
        assert response.status_code in [200, 202]
    
    def test_code_optimization_endpoint(self):
        payload = {
            "code": "for (let i = 0; i < arr.length; i++) { console.log(arr[i]); }",
            "language": "javascript"
        }
        
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/api/optimize", json=payload, headers=headers)
        
        assert response.status_code in [200, 202]
    
    @pytest.mark.asyncio
    async def test_openai_client_fallback(self):
        openai_client = OpenAIClient(api_key="test-key")
        
        with patch('openai.ChatCompletion.acreate') as mock_create:
            mock_create.return_value = Mock(
                choices=[Mock(message=Mock(content="Analysis result"))]
            )
            
            result = await openai_client.analyze_code("test code", "python")
            assert result is not None
    
    def test_rate_limiting(self):
        headers = {"Authorization": "Bearer test-token"}
        payload = {"code": "test", "language": "python"}
        
        responses = []
        for _ in range(10):
            response = client.post("/api/analyze", json=payload, headers=headers)
            responses.append(response.status_code)
        
        assert any(status in [200, 202, 429] for status in responses)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
