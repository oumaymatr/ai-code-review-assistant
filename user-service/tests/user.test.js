const request = require("supertest");
const app = require("../src/server");
const { Pool } = require("pg");

jest.mock("pg", () => {
  const mClient = {
    query: jest.fn(),
    release: jest.fn(),
  };
  const mPool = {
    connect: jest.fn(() => mClient),
    query: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

describe("User Service", () => {
  let server;

  beforeAll(() => {
    server = app.listen(5001);
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user", async () => {
      const userData = {
        username: "testuser",
        email: "test@example.com",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect("Content-Type", /json/);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("success", true);
    });

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
  });

  describe("POST /api/auth/login", () => {
    it("should authenticate valid credentials", async () => {
      const credentials = {
        email: "test@example.com",
        password: "Test123!@#",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(credentials);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty("tokens");
      expect(response.body.data.tokens).toHaveProperty("accessToken");
    });

    it("should reject invalid credentials", async () => {
      const credentials = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(credentials);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health").expect(200);

      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty("service", "user-service");
    });
  });
});
