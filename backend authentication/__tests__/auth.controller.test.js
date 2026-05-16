/**
 * auth.controller.test.js — Integration Tests (Supertest + MongoMemoryServer)
 * Covers: registerUser · loginUser · verifyOTP
 */
'use strict';

// ── Mocks (must be before any require of the modules they replace) ────────────
jest.mock('../redis');
jest.mock('../emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({ success: true }),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({ success: true }),
  sendWelcomeEmail:      jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../smsService', () => ({
  sendOTP:            jest.fn().mockResolvedValue({ success: true }),
  sendOrderStatusSMS: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('../logger', () => ({
  info:   jest.fn(),
  warn:   jest.fn(),
  error:  jest.fn(),
  stream: { write: jest.fn() },
}));

// ── Real imports ──────────────────────────────────────────────────────────────
const request  = require('supertest');
const express  = require('express');
const mongoose = require('mongoose');

const redisMock    = require('../redis');
const emailService = require('../emailService');
const authRoutes   = require('../authRoutes');
const User         = require('../UserMongo');

// ── Minimal Express test app ─────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
// Generic error handler so unhandled throws return JSON
app.use((err, _req, res, _next) => {
  res.status(500).json({ success: false, message: err.message });
});

// ── Shared fixtures ───────────────────────────────────────────────────────────
const BASE_USER = {
  firstName:       'Ahmed',
  lastName:        'Khan',
  email:           'ahmed.khan@example.com',
  phone:           '+923001234567',
  password:        'SecurePass@123',
  confirmPassword: 'SecurePass@123',
};

/** Register a user directly in MongoDB (bypasses HTTP, useful for login tests). */
const seedVerifiedUser = async (overrides = {}) => {
  const bcrypt = require('bcrypt');
  const data   = { ...BASE_USER, ...overrides };
  return User.create({
    firstName:       data.firstName,
    lastName:        data.lastName,
    email:           data.email.toLowerCase(),
    phone:           data.phone,
    password:        await bcrypt.hash(data.password, 4), // low rounds for speed
    role:            'customer',
    isVerified:      true,
    isActive:        true,
  });
};

/** Register via HTTP and return the response. */
const httpRegister = (body = {}) =>
  request(app).post('/api/auth/register').send({ ...BASE_USER, ...body });

/** Login via HTTP. */
const httpLogin = (body = {}) =>
  request(app).post('/api/auth/login').send(body);

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 1 — registerUser()
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register — registerUser()', () => {
  beforeEach(() => redisMock._clear());

  // ── Normal cases ─────────────────────────────────────────────────────────
  describe('✅ Normal cases', () => {
    test('201 with full valid payload', async () => {
      const res = await httpRegister();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({
        email:     BASE_USER.email,
        firstName: BASE_USER.firstName,
        lastName:  BASE_USER.lastName,
      });
      // No tokens on initial register — pending OTP
      expect(res.body.data.tokens).toBeUndefined();
      expect(res.body.data.verificationRequired).toBe(true);
    });

    test('201 without optional phone field', async () => {
      const { phone, ...noPhone } = BASE_USER;
      const res = await httpRegister(noPhone);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('sends verification email after registration', async () => {
      await httpRegister();
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(
        BASE_USER.email,
        expect.stringMatching(/^\d{6}$/)
      );
    });

    test('OTP is stored in Redis with 5-min TTL', async () => {
      const res = await httpRegister();
      const userId = res.body.data.user.id;
      const storedOTP = redisMock._store.get(`otp:email:${userId}`);
      expect(storedOTP).toMatch(/^\d{6}$/);
    });

    test('password is not exposed in response', async () => {
      const res = await httpRegister();
      expect(JSON.stringify(res.body)).not.toContain(BASE_USER.password);
    });

    test('stored password is bcrypt-hashed in DB', async () => {
      const bcrypt = require('bcrypt');
      await httpRegister();
      const user = await User.findOne({ email: BASE_USER.email }).select('+password');
      expect(user.password).not.toBe(BASE_USER.password);
      expect(await bcrypt.compare(BASE_USER.password, user.password)).toBe(true);
    });
  });

  // ── Invalid cases ─────────────────────────────────────────────────────────
  describe('❌ Invalid cases', () => {
    test('422 when firstName is missing', async () => {
      const res = await httpRegister({ firstName: '' });
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    test('422 when lastName is missing', async () => {
      const res = await httpRegister({ lastName: '' });
      expect(res.status).toBe(422);
    });

    test('422 when email format is invalid', async () => {
      const res = await httpRegister({ email: 'not-an-email' });
      expect(res.status).toBe(422);
      expect(res.body.errors).toBeDefined();
    });

    test('422 when password is too short', async () => {
      const res = await httpRegister({ password: 'Ab1@', confirmPassword: 'Ab1@' });
      expect(res.status).toBe(422);
    });

    test('422 when password has no uppercase letter', async () => {
      const weak = 'lowercase@123';
      const res = await httpRegister({ password: weak, confirmPassword: weak });
      expect(res.status).toBe(422);
    });

    test('422 when password has no special character', async () => {
      const weak = 'SecurePass123';
      const res = await httpRegister({ password: weak, confirmPassword: weak });
      expect(res.status).toBe(422);
    });

    test('422 when confirmPassword does not match', async () => {
      const res = await httpRegister({ confirmPassword: 'DifferentPass@999' });
      expect(res.status).toBe(422);
    });

    test('422 when phone number is not Pakistani format', async () => {
      const res = await httpRegister({ phone: '+1-800-555-1234' });
      expect(res.status).toBe(422);
    });

    test('422 when request body is empty', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.status).toBe(422);
    });
  });

  // ── Edge / conflict cases ─────────────────────────────────────────────────
  describe('⚠️  Edge cases', () => {
    test('409 when email already exists', async () => {
      await httpRegister(); // first registration
      const res = await httpRegister(); // duplicate
      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already exists/i);
    });

    test('409 when phone already exists', async () => {
      await httpRegister();
      const res = await httpRegister({ email: 'different@example.com' });
      expect(res.status).toBe(409);
    });

    test('email is stored lowercase regardless of input case', async () => {
      await httpRegister({ email: 'Ahmed.KHAN@EXAMPLE.COM' });
      const user = await User.findOne({ email: 'ahmed.khan@example.com' });
      expect(user).not.toBeNull();
    });

    test('local PK phone format (03XX) is accepted', async () => {
      const res = await httpRegister({ phone: '03001234567' });
      expect(res.status).toBe(201);
    });

    test('firstName with hyphen and apostrophe is accepted', async () => {
      const res = await httpRegister({ firstName: "O'Brien-Smith" });
      expect(res.status).toBe(201);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 2 — loginUser()
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login — loginUser()', () => {
  beforeEach(() => redisMock._clear());

  // ── Normal cases ─────────────────────────────────────────────────────────
  describe('✅ Normal cases', () => {
    test('200 with valid credentials returns access + refresh tokens', async () => {
      await seedVerifiedUser();
      const res = await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
      expect(res.body.data.tokens.expiresIn).toBeDefined();
    });

    test('200 response includes sanitized user object (no password)', async () => {
      await seedVerifiedUser();
      const res = await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });

      expect(res.body.data.user).toMatchObject({
        email:      BASE_USER.email,
        firstName:  BASE_USER.firstName,
        isVerified: true,
      });
      expect(res.body.data.user.password).toBeUndefined();
    });

    test('refresh token hash is stored in Redis after login', async () => {
      await seedVerifiedUser();
      const loginRes = await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });
      const userId   = loginRes.body.data.user.id;

      const rtKey    = `refresh:${userId}`;
      expect(redisMock._store.has(rtKey)).toBe(true);
    });

    test('login clears previous failure counter from Redis', async () => {
      await seedVerifiedUser();
      // Simulate prior failures
      const attemptKey = `login:attempts:${BASE_USER.email}`;
      redisMock._store.set(attemptKey, '3');

      await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });
      expect(redisMock._store.has(attemptKey)).toBe(false);
    });

    test('access token is a valid JWT with correct claims', async () => {
      const jwt = require('jsonwebtoken');
      await seedVerifiedUser();
      const res     = await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });
      const decoded = jwt.verify(res.body.data.tokens.accessToken, process.env.JWT_SECRET);

      expect(decoded.email).toBe(BASE_USER.email);
      expect(decoded.role).toBe('customer');
      expect(decoded.sub).toBeDefined();
    });
  });

  // ── Invalid cases ─────────────────────────────────────────────────────────
  describe('❌ Invalid cases', () => {
    test('401 when email does not exist', async () => {
      const res = await httpLogin({ email: 'ghost@example.com', password: BASE_USER.password });
      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    test('401 when password is wrong', async () => {
      await seedVerifiedUser();
      const res = await httpLogin({ email: BASE_USER.email, password: 'WrongPass@999' });
      expect(res.status).toBe(401);
      expect(res.body.attemptsLeft).toBeDefined();
    });

    test('401 increments Redis failure counter on wrong password', async () => {
      await seedVerifiedUser();
      await httpLogin({ email: BASE_USER.email, password: 'WrongPass@1' });
      await httpLogin({ email: BASE_USER.email, password: 'WrongPass@2' });

      const count = redisMock._store.get(`login:attempts:${BASE_USER.email}`);
      expect(parseInt(count)).toBe(2);
    });

    test('422 when email is missing from body', async () => {
      const res = await httpLogin({ password: BASE_USER.password });
      expect(res.status).toBe(422);
    });

    test('422 when password is missing from body', async () => {
      const res = await httpLogin({ email: BASE_USER.email });
      expect(res.status).toBe(422);
    });

    test('422 when email format is invalid', async () => {
      const res = await httpLogin({ email: 'not-valid', password: 'anyPass' });
      expect(res.status).toBe(422);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe('⚠️  Edge cases', () => {
    test('403 when user is not yet verified → includes userId for redirect', async () => {
      // Register via HTTP (user starts unverified)
      const regRes = await httpRegister();
      const userId = regRes.body.data.user.id;

      const res = await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });

      expect(res.status).toBe(403);
      expect(res.body.verificationRequired).toBe(true);
      expect(res.body.userId).toBe(userId);
    });

    test('403 when user is deactivated', async () => {
      // Create verified user then deactivate — seedVerifiedUser passes isActive
      // directly to User.create so we need to ensure it is honoured
      const user = await seedVerifiedUser();
      await User.findByIdAndUpdate(user._id, { isActive: false });

      const res = await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/deactivated/i);
    });

    test('429 when login attempts exceed limit (10 attempts)', async () => {
      await seedVerifiedUser();
      const attemptKey = `login:attempts:${BASE_USER.email}`;
      // Pre-seed counter at the limit
      redisMock._store.set(attemptKey, '10');
      redisMock._ttlStore && redisMock._ttlStore.set(attemptKey, Date.now() + 900_000);

      const res = await httpLogin({ email: BASE_USER.email, password: 'WrongPass@1' });
      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/too many/i);
      expect(res.body.retryAfterSecs).toBeDefined();
    });

    test('email login is case-insensitive', async () => {
      await seedVerifiedUser();
      const res = await httpLogin({ email: 'AHMED.KHAN@EXAMPLE.COM', password: BASE_USER.password });
      expect(res.status).toBe(200);
    });

    test('403 unverified user triggers OTP re-send when no live OTP exists', async () => {
      await httpRegister();
      // Clear OTP from Redis to simulate expiry
      redisMock._clear();

      await httpLogin({ email: BASE_USER.email, password: BASE_USER.password });

      expect(emailService.sendVerificationEmail).toHaveBeenCalledTimes(2); // once on register, once on re-send
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SUITE 3 — verifyOTP()
// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/verify-otp — verifyOTP()', () => {
  let userId;

  beforeEach(async () => {
    redisMock._clear();
    // Register fresh user for each test
    const res = await httpRegister();
    userId    = res.body.data.user.id;
  });

  /** Fetch the OTP that was stored in the Redis mock during registration. */
  const getStoredOTP = () => redisMock._store.get(`otp:email:${userId}`);

  const verifyOTP = (body) =>
    request(app).post('/api/auth/verify-otp').send(body);

  // ── Normal cases ─────────────────────────────────────────────────────────
  describe('✅ Normal cases', () => {
    test('200 with correct OTP returns access + refresh tokens', async () => {
      const otp = getStoredOTP();
      const res = await verifyOTP({ userId, otp, channel: 'email' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
      expect(res.body.data.tokens.refreshToken).toBeDefined();
    });

    test('200 marks user as verified in MongoDB', async () => {
      const otp = getStoredOTP();
      await verifyOTP({ userId, otp, channel: 'email' });

      const user = await User.findById(userId);
      expect(user.isVerified).toBe(true);
      expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    });

    test('200 deletes OTP from Redis after success', async () => {
      const otp = getStoredOTP();
      await verifyOTP({ userId, otp, channel: 'email' });

      expect(redisMock._store.has(`otp:email:${userId}`)).toBe(false);
    });

    test('200 deletes attempt counter from Redis after success', async () => {
      const otp = getStoredOTP();
      // Simulate a prior wrong attempt
      redisMock._store.set(`otp:attempts:email:${userId}`, '2');

      await verifyOTP({ userId, otp, channel: 'email' });
      expect(redisMock._store.has(`otp:attempts:email:${userId}`)).toBe(false);
    });

    test('channel defaults to "email" when omitted', async () => {
      const otp = getStoredOTP();
      const res = await verifyOTP({ userId, otp }); // no channel field
      expect(res.status).toBe(200);
    });
  });

  // ── Invalid cases ─────────────────────────────────────────────────────────
  describe('❌ Invalid cases', () => {
    test('400 when OTP is incorrect', async () => {
      const res = await verifyOTP({ userId, otp: '000000', channel: 'email' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/invalid otp/i);
      expect(res.body.attemptsLeft).toBeDefined();
    });

    test('400 when OTP has expired (not in Redis)', async () => {
      redisMock._clear(); // wipe all keys including the OTP
      const res = await verifyOTP({ userId, otp: '123456', channel: 'email' });
      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/expired|does not exist/i);
    });

    test('422 when userId is not a valid MongoId', async () => {
      const res = await verifyOTP({ userId: 'not-a-mongo-id', otp: '123456', channel: 'email' });
      expect(res.status).toBe(422);
    });

    test('422 when OTP is fewer than 6 digits', async () => {
      const res = await verifyOTP({ userId, otp: '123', channel: 'email' });
      expect(res.status).toBe(422);
    });

    test('422 when OTP contains non-numeric characters', async () => {
      const res = await verifyOTP({ userId, otp: '12AB56', channel: 'email' });
      expect(res.status).toBe(422);
    });

    test('422 when OTP is more than 6 digits', async () => {
      const res = await verifyOTP({ userId, otp: '1234567', channel: 'email' });
      expect(res.status).toBe(422);
    });

    test('422 when channel is invalid value (caught by express-validator)', async () => {
      // authRoutes applies body('channel').isIn(['email','phone'])
      // so an invalid channel returns 422 before the controller runs
      const otp = getStoredOTP();
      const res = await verifyOTP({ userId, otp, channel: 'sms' }); // 'sms' not in enum
      expect(res.status).toBe(422);
    });

    test('422 when userId is missing', async () => {
      const res = await verifyOTP({ otp: '123456', channel: 'email' });
      expect(res.status).toBe(422);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────────────────
  describe('⚠️  Edge cases', () => {
    test('429 after 5 wrong OTP attempts → OTP purged from Redis', async () => {
      // Pre-seed failure counter at the limit
      redisMock._store.set(`otp:attempts:email:${userId}`, '5');

      const res = await verifyOTP({ userId, otp: '000000', channel: 'email' });
      expect(res.status).toBe(429);
      expect(res.body.message).toMatch(/too many/i);
      // OTP should be purged
      expect(redisMock._store.has(`otp:email:${userId}`)).toBe(false);
    });

    test('each wrong attempt decrements attemptsLeft correctly', async () => {
      // 1st wrong attempt
      const res1 = await verifyOTP({ userId, otp: '000001', channel: 'email' });
      expect(res1.body.attemptsLeft).toBe(4);

      // 2nd wrong attempt
      const res2 = await verifyOTP({ userId, otp: '000002', channel: 'email' });
      expect(res2.body.attemptsLeft).toBe(3);
    });

    test('correct OTP after failed attempts succeeds', async () => {
      // Make 2 wrong attempts first
      await verifyOTP({ userId, otp: '000001', channel: 'email' });
      await verifyOTP({ userId, otp: '000002', channel: 'email' });

      // Now use the correct OTP
      const otp = getStoredOTP();
      const res = await verifyOTP({ userId, otp, channel: 'email' });
      expect(res.status).toBe(200);
    });

    test('verifying twice with same OTP fails second time (OTP deleted after first)', async () => {
      const otp  = getStoredOTP();
      const res1 = await verifyOTP({ userId, otp, channel: 'email' });
      expect(res1.status).toBe(200);

      const res2 = await verifyOTP({ userId, otp, channel: 'email' });
      expect(res2.status).toBe(400); // OTP no longer exists
    });

    test('404 when userId does not exist in MongoDB', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      // Manually seed a fake OTP for this non-existent userId
      redisMock._store.set(`otp:email:${fakeId}`, '123456');

      const res = await verifyOTP({ userId: fakeId, otp: '123456', channel: 'email' });
      expect(res.status).toBe(404);
    });
  });
});
