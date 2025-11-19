/**
 * 🔧 Setup pour les tests Jest
 */

// Variables d'environnement pour les tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.DATABASE_URL = 'postgresql://postgres:postgres123@localhost:5432/ai_code_review_test';

// Mock Redis pour les tests
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn().mockResolvedValue(),
    ping: jest.fn().mockResolvedValue(),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(),
    setEx: jest.fn().mockResolvedValue(),
    incr: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(3600),
    isReady: true
  }))
}));

// Timeout pour les tests
jest.setTimeout(10000);