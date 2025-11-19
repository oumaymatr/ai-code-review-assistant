const request = require("supertest");

jest.mock("pg", () => {
  const mClient = {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    release: jest.fn(),
  };
  const mPool = {
    connect: jest.fn(() => mClient),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    on: jest.fn(),
    end: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

jest.mock("redis", () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(true),
    on: jest.fn(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue("PONG"),
  })),
}));

const app = require("../src/server");

describe("User Service", () => {
  let server;

  beforeAll(() => {
    server = app.listen(5001);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("POST /api/auth/register", () => {
    it("should reject invalid email", async () => {
      const userData = {
        username: "testuser",
        email: "invalid-email",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.status).toBe(400);
    });

    it("should reject missing fields", async () => {
      const userData = {
        email: "test@example.com",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData);

      expect(response.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("should reject missing credentials", async () => {
      const credentials = {
        email: "test@example.com",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(credentials);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health");

      expect([200, 500, 503]).toContain(response.status);
      expect(response.body).toHaveProperty("service");
    });
  });
});
