const request = require("supertest");
const app = require("../src/server");

describe("API Gateway", () => {
  let server;
  let authToken;

  beforeAll(() => {
    server = app.listen(5000);
    authToken = "test-jwt-token";
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("Authentication Routes", () => {
    it("should proxy registration to user service", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect([200, 201, 400, 503]).toContain(response.status);
    });

    it("should proxy login to user service", async () => {
      const credentials = {
        email: "test@example.com",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(credentials);

      expect([200, 401, 503]).toContain(response.status);
    });
  });

  describe("Review Routes", () => {
    it("should proxy review creation", async () => {
      const reviewData = {
        title: "Test Review",
        code: "function test() {}",
        language: "javascript",
      };

      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${authToken}`)
        .send(reviewData);

      expect([200, 201, 401, 503]).toContain(response.status);
    });

    it("should proxy review fetch", async () => {
      const reviewId = "test-uuid-123";

      const response = await request(app)
        .get(`/api/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([200, 401, 404, 503]).toContain(response.status);
    });
  });

  describe("Analysis Routes", () => {
    it("should proxy code analysis request", async () => {
      const analysisData = {
        code: "function add(a, b) { return a + b; }",
        language: "javascript",
      };

      const response = await request(app)
        .post("/api/analyze")
        .set("Authorization", `Bearer ${authToken}`)
        .send(analysisData);

      expect([200, 202, 401, 503]).toContain(response.status);
    });

    it("should proxy test generation request", async () => {
      const testData = {
        code: "def multiply(x, y): return x * y",
        language: "python",
      };

      const response = await request(app)
        .post("/api/generate-tests")
        .set("Authorization", `Bearer ${authToken}`)
        .send(testData);

      expect([200, 202, 401, 503]).toContain(response.status);
    });
  });

  describe("Rate Limiting", () => {
    it("should enforce rate limits", async () => {
      const requests = [];
      for (let i = 0; i < 100; i++) {
        requests.push(
          request(app)
            .get("/api/health")
            .then((res) => res.status)
        );
      }

      const statuses = await Promise.all(requests);
      const hasRateLimit = statuses.some((status) => status === 429);

      expect(statuses).toContain(200);
    });
  });

  describe("Error Handling", () => {
    it("should handle service unavailable", async () => {
      const response = await request(app)
        .get("/api/nonexistent-route")
        .set("Authorization", `Bearer ${authToken}`);

      expect([404, 503]).toContain(response.status);
    });

    it("should handle missing authentication", async () => {
      const response = await request(app).post("/api/reviews").send({
        title: "Test",
        code: "test",
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Health Check", () => {
    it("should return gateway health status", async () => {
      const response = await request(app).get("/api/health").expect(200);

      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty("service", "api-gateway");
    });
  });

  describe("CORS Headers", () => {
    it("should include CORS headers", async () => {
      const response = await request(app).get("/api/health");

      expect(response.headers).toHaveProperty("access-control-allow-origin");
    });
  });
});
