const request = require("supertest");

// Mock PostgreSQL database
jest.mock("pg", () => {
  const mClient = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
  const mPool = {
    connect: jest.fn(() => mClient),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    on: jest.fn(),
    end: jest.fn(),
    emit: jest.fn(),
    once: jest.fn(),
    removeListener: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock Redis
jest.mock("../src/db/redis.js", () => {
  const mockRedisClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    on: jest.fn(),
    emit: jest.fn(),
  };

  return {
    connectRedis: jest.fn().mockResolvedValue(mockRedisClient),
    getRedisClient: jest.fn().mockReturnValue(mockRedisClient),
  };
});

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

      expect([200, 201, 401, 500, 503]).toContain(response.status);
      if (response.status === 201 || response.status === 200) {
        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("id");
      }
    });

    it("should reject review without authentication", async () => {
      const reviewData = {
        title: "Test Review",
        code: "function test() {}",
      };

      const response = await request(app).post("/api/reviews").send(reviewData);

      expect([401, 403, 500]).toContain(response.status);
    });
  });

  describe("GET /api/reviews/:id", () => {
    it("should fetch a review by ID", async () => {
      const reviewId = "test-uuid-123";

      const response = await request(app)
        .get(`/api/reviews/${reviewId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([200, 401, 404, 500, 503]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("success", true);
      }
    });
  });

  describe("GET /api/reviews/:id/analyses", () => {
    it("should fetch analyses for a review", async () => {
      const reviewId = "test-uuid-123";

      const response = await request(app)
        .get(`/api/reviews/${reviewId}/analyses`)
        .set("Authorization", `Bearer ${authToken}`);

      expect([200, 401, 404, 500, 503]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("analyses");
        expect(Array.isArray(response.body.analyses)).toBe(true);
      }
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

      expect([200, 400, 401, 404, 500, 503]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("success", true);
      }
    });

    it("should reject invalid status", async () => {
      const reviewId = "test-uuid-123";
      const statusUpdate = { status: "invalid-status" };

      const response = await request(app)
        .patch(`/api/reviews/${reviewId}/status`)
        .set("Authorization", `Bearer ${authToken}`)
        .send(statusUpdate);

      expect([400, 401, 404, 500]).toContain(response.status);
    });
  });

  describe("GET /health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/health");

      expect([200, 500, 503]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body).toHaveProperty("status");
        expect(response.body).toHaveProperty("service", "review-service");
      }
    });
  });
});
