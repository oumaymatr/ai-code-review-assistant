const request = require("supertest");
const app = require("../src/server");

describe("Notification Service", () => {
  let server;
  let authToken;

  beforeAll(() => {
    server = app.listen(5004);
    authToken = "test-jwt-token";
  });

  afterAll((done) => {
    server.close(done);
  });

  describe("POST /api/notifications", () => {
    it("should create a notification", async () => {
      const notificationData = {
        userId: "user-123",
        type: "review_complete",
        title: "Review Completed",
        message: "Your code review is ready",
      };

      const response = await request(app)
        .post("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`)
        .send(notificationData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("success", true);
    });

    it("should reject notification without authentication", async () => {
      const notificationData = {
        userId: "user-123",
        type: "review_complete",
      };

      const response = await request(app)
        .post("/api/notifications")
        .send(notificationData);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/notifications", () => {
    it("should fetch user notifications", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("notifications");
      expect(Array.isArray(response.body.notifications)).toBe(true);
    });

    it("should support pagination", async () => {
      const response = await request(app)
        .get("/api/notifications?page=1&limit=10")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("page");
      expect(response.body).toHaveProperty("limit");
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("should mark notification as read", async () => {
      const notificationId = "notif-123";

      const response = await request(app)
        .patch(`/api/notifications/${notificationId}/read`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });

  describe("DELETE /api/notifications/:id", () => {
    it("should delete a notification", async () => {
      const notificationId = "notif-123";

      const response = await request(app)
        .delete(`/api/notifications/${notificationId}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);
    });
  });

  describe("WebSocket Connection", () => {
    it("should handle WebSocket connections", (done) => {
      const io = require("socket.io-client");
      const socket = io("http://localhost:5004", {
        auth: { token: authToken },
      });

      socket.on("connect", () => {
        expect(socket.connected).toBe(true);
        socket.disconnect();
        done();
      });
    });
  });

  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const response = await request(app).get("/api/health").expect(200);

      expect(response.body).toHaveProperty("status", "OK");
      expect(response.body).toHaveProperty("service", "notification-service");
    });
  });
});
