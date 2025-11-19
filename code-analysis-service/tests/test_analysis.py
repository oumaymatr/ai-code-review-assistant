import pytest
import sys
from pathlib import Path

# Add parent directory to path to import src modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

class TestCodeAnalysisService:
    
    def test_health_endpoint(self):
        """Test health check endpoint returns status"""
        response = client.get("/health")
        assert response.status_code == 200
        assert "status" in response.json()
        assert response.json()["service"] == "code-analysis-service"
    
    def test_code_analysis_missing_code(self):
        """Test that missing code field returns validation error"""
        payload = {
            "language": "javascript"
        }
        
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/api/analyze", json=payload, headers=headers)
        
        assert response.status_code == 422
    
    def test_test_generation_missing_fields(self):
        """Test that missing required fields returns validation error"""
        payload = {
            "language": "python"
        }
        
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/api/generate-tests", json=payload, headers=headers)
        
        assert response.status_code == 422
    
    def test_optimization_missing_fields(self):
        """Test that missing required fields returns validation error"""
        payload = {
            "language": "javascript"
        }
        
        headers = {"Authorization": "Bearer test-token"}
        response = client.post("/api/optimize", json=payload, headers=headers)
        
        assert response.status_code == 422

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
