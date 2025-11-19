const axios = require("axios");
const config = require("../config");
const logger = require("../utils/logger");

class CodeAnalysisClient {
  constructor() {
    this.baseURL = config.codeAnalysisServiceUrl;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 300000, // 5 minutes for model loading
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
  }

  async analyzeCode(code, language, analysisType = "full") {
    try {
      logger.info(`Requesting code analysis: ${language} (${analysisType})`);

      const response = await this.client.post("/api/analyze", {
        code,
        language,
        analysis_type: analysisType,
      });

      return response.data;
    } catch (error) {
      logger.error("Code analysis request failed:", error.message);
      throw new Error(`Code analysis failed: ${error.message}`);
    }
  }

  async optimizeCode(code, language, focus = "performance") {
    try {
      logger.info(`Requesting code optimization: ${language} (${focus})`);

      const response = await this.client.post("/api/optimize", {
        code,
        language,
        focus,
      });

      return response.data;
    } catch (error) {
      logger.error("Code optimization request failed:", error.message);
      throw new Error(`Code optimization failed: ${error.message}`);
    }
  }

  async generateTests(code, language, framework = null) {
    try {
      logger.info(`Requesting test generation: ${language}`);

      const response = await this.client.post("/api/generate-tests", {
        code,
        language,
        framework,
        include_edge_cases: true,
        include_mocks: true,
      });

      return response.data;
    } catch (error) {
      logger.error("Test generation request failed:", error.message);
      throw new Error(`Test generation failed: ${error.message}`);
    }
  }

  async checkHealth() {
    try {
      const response = await this.client.get("/health");
      return response.data;
    } catch (error) {
      logger.error("Code Analysis Service health check failed:", error.message);
      return { status: "unhealthy", error: error.message };
    }
  }
}

module.exports = new CodeAnalysisClient();
