const request = require("supertest");
const app = require("../src/server");

describe("Review Service", () => {
  let server;
  let authToken;

  beforeAll(async () => {
    server = app.listen(5002);
    authToken = "test-jwt-token";
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("POST /api/reviews", () => {
    it("should create a new code review", async () => {
      const reviewData = {
        title: "Test Review",
        description: "Testing review creation",
        language: "javascript",
        code: "function test() { return true; }",
      };

      const response = await request(app)
        .post("/api/reviews")
        .set("Authorization", `Bearer ${authToken}`)
        .send(reviewData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("success", true);
      expect(response.body.data).toHaveProperty("id");
    });

    it("should reject review without authentication", async () => {
      const reviewData = {
        title: "Test Review",
        code: "function test() {}",
      };

      const response = await request(app).post("/api/reviews").send(reviewData);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/reviews/:id", () => {
    it("should fetch a review by ID", async () => {
      const reviewId = "test-uuid-123";

      const response = await request(app)
        .get(`/api/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });

  describe("GET /api/reviews/:id/analyses", () => {
    it("should fetch analyses for a review", async () => {
      const reviewId = "test-uuid-123";

      const response = await request(app)
        .get(`/api/reviews/${reviewId}/analyses`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("analyses");
      expect(Array.isArray(response.body.analyses)).toBe(true);
    });
  });

  describe("PATCH /api/reviews/:id/status", () => {
    it("should update review status", async () => {
      const reviewId = "test-uuid-123";
      const statusUpdate = { status: "completed" };

      const response = await request(app)
        .patch(`/api/reviews/${reviewId}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(statusUpdate);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });

    it("should reject invalid status", async () => {
      const reviewId = "test-uuid-123";
      const statusUpdate = { status: "invalid-status" };

      const response = await request(app)
        .patch(`/api/reviews/${reviewId}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(statusUpdate);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health").expect(200);

      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty("service", "review-service");
    });
  });
});
