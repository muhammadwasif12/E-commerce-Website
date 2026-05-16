/**
 * ============================================================
 * validators.test.js — Pure Unit Tests
 * ============================================================
 * Tests the individual field validators and the composite
 * validateUserInput() function exported from validators.js.
 *
 * No HTTP, no database, no mocks required — pure functions only.
 * ============================================================
 */

'use strict';

const { validateUserInput, validators } = require('../validators');

// Destructure the exposed private validators for direct testing
const {
  email:           validateEmail,
  password:        validatePassword,
  pakistaniPhone:  validatePhone,
  name:            validateName,
  confirmPassword: validateConfirmPassword,
} = validators;

// ─── Shared test data ─────────────────────────────────────────────────────────
const STRONG_PASSWORD    = 'SecurePass@123';
const VALID_EMAIL        = 'ahmed.khan@example.com';
const VALID_PK_PHONE     = '+923001234567';
const VALID_REGISTER     = {
  firstName:       'Ahmed',
  lastName:        'Khan',
  email:           VALID_EMAIL,
  phone:           VALID_PK_PHONE,
  password:        STRONG_PASSWORD,
  confirmPassword: STRONG_PASSWORD,
};

// ═════════════════════════════════════════════════════════════════════════════
// 1. validateEmail
// ═════════════════════════════════════════════════════════════════════════════
describe('validateEmail()', () => {

  // ── Normal / valid ──────────────────────────────────────────────────────────
  describe('✅ valid emails', () => {
    const validCases = [
      ['simple',          'user@example.com'],
      ['subdomain',       'user@mail.example.com'],
      ['plus alias',      'user+tag@example.com'],
      ['numeric local',   '123@example.com'],
      ['hyphenated host', 'user@my-company.co'],
      ['two-char TLD',    'user@example.pk'],
      ['leading spaces',  '  user@example.com  '],  // trimmed internally
    ];

    test.each(validCases)('%s → null (valid)', (_label, input) => {
      expect(validateEmail(input)).toBeNull();
    });
  });

  // ── Invalid format ──────────────────────────────────────────────────────────
  describe('❌ invalid emails', () => {
    test('missing @ symbol', () => {
      expect(validateEmail('userexample.com')).toMatch(/valid email/i);
    });

    test('missing domain', () => {
      expect(validateEmail('user@')).toMatch(/valid email/i);
    });

    test('missing TLD', () => {
      expect(validateEmail('user@example')).toMatch(/valid email/i);
    });

    test('double @ symbol', () => {
      expect(validateEmail('user@@example.com')).toMatch(/valid email/i);
    });

    test('spaces inside email', () => {
      expect(validateEmail('us er@example.com')).toMatch(/valid email/i);
    });

    test('single-char TLD', () => {
      expect(validateEmail('user@example.c')).toMatch(/valid email/i);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────
  describe('⚠️  edge cases', () => {
    test('empty string', () => {
      const result = validateEmail('');
      expect(result).toMatch(/required|blank/i);
    });

    test('null value', () => {
      expect(validateEmail(null)).toMatch(/required/i);
    });

    test('undefined value', () => {
      expect(validateEmail(undefined)).toMatch(/required/i);
    });

    test('numeric value (wrong type)', () => {
      expect(validateEmail(12345)).toMatch(/required/i);
    });

    test('array value (wrong type)', () => {
      expect(validateEmail(['a@b.com'])).toMatch(/required/i);
    });

    test('email exceeding 254 characters', () => {
      const longLocal = 'a'.repeat(250);
      expect(validateEmail(`${longLocal}@example.com`)).toMatch(/too long/i);
    });

    test('exactly 254 characters is valid', () => {
      // local(64) @ domain(186) + .com(4) = 254  (borderline)
      const local  = 'a'.repeat(64);
      const domain = 'b'.repeat(182);
      expect(validateEmail(`${local}@${domain}.com`)).toBeNull();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. validatePassword
// ═════════════════════════════════════════════════════════════════════════════
describe('validatePassword()', () => {

  // ── Normal / valid ──────────────────────────────────────────────────────────
  describe('✅ valid passwords', () => {
    const validPasswords = [
      ['all requirements met',          'SecurePass@123'],
      ['different special char $',      'MyP@ssw0rd$'],
      ['special char ! at end',         'Abcdefg1!'],
      ['exactly 8 chars (minimum)',     'Abcde1@!'],
      ['128 chars (maximum)',           'A'.repeat(62) + 'b'.repeat(62) + '1@'],
      ['mixed specials',               'P@$$w0rd#2024'],
      ['special char in middle',       'Pass!123Word'],
    ];

    test.each(validPasswords)('%s → null (valid)', (_label, pwd) => {
      expect(validatePassword(pwd)).toBeNull();
    });
  });

  // ── Missing requirements ────────────────────────────────────────────────────
  describe('❌ failing strength rules', () => {
    test('too short (7 chars)', () => {
      expect(validatePassword('Abc1@!x')).toMatch(/at least 8 characters/i);
    });

    test('no uppercase letter', () => {
      expect(validatePassword('lowercase1@pass')).toMatch(/uppercase/i);
    });

    test('no lowercase letter', () => {
      expect(validatePassword('UPPERCASE1@PASS')).toMatch(/lowercase/i);
    });

    test('no number', () => {
      expect(validatePassword('NoNumberPass@!')).toMatch(/number/i);
    });

    test('no special character', () => {
      expect(validatePassword('NoSpecialChar1')).toMatch(/special character/i);
    });

    test('all lowercase, no specials, no numbers', () => {
      // Fails "at least 8 chars" rule first if < 8, else uppercase
      expect(validatePassword('onlylower')).toMatch(/uppercase/i);
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────
  describe('⚠️  edge cases', () => {
    test('empty string', () => {
      expect(validatePassword('')).toMatch(/required/i);
    });

    test('null', () => {
      expect(validatePassword(null)).toMatch(/required/i);
    });

    test('undefined', () => {
      expect(validatePassword(undefined)).toMatch(/required/i);
    });

    test('number type (not string)', () => {
      expect(validatePassword(12345678)).toMatch(/required/i);
    });

    test('129 characters (exceeds max)', () => {
      const tooLong = 'Aa1@' + 'x'.repeat(125); // 129 chars
      expect(validatePassword(tooLong)).toMatch(/cannot exceed 128/i);
    });

    test('password with spaces still valid if strength met', () => {
      // Spaces are allowed — no rule bans them
      expect(validatePassword('Pass 1@ Word')).toBeNull();
    });

    test('common injection string still passes strength check', () => {
      expect(validatePassword("' OR '1'='1'; Drop1@")).toBeNull();
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. validateUserInput() — register context
// ═════════════════════════════════════════════════════════════════════════════
describe('validateUserInput() — register context', () => {

  test('✅ valid full payload returns isValid: true with empty errors', () => {
    const result = validateUserInput(VALID_REGISTER, 'register');
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('✅ valid payload without phone (phone is optional)', () => {
    const { phone, ...noPhone } = VALID_REGISTER;
    const result = validateUserInput(noPhone, 'register');
    expect(result.isValid).toBe(true);
  });

  test('❌ missing firstName → error on firstName field', () => {
    const data = { ...VALID_REGISTER, firstName: '' };
    const { isValid, errors } = validateUserInput(data, 'register');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('firstName');
  });

  test('❌ missing lastName → error on lastName field', () => {
    const data = { ...VALID_REGISTER, lastName: undefined };
    const { isValid, errors } = validateUserInput(data, 'register');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('lastName');
  });

  test('❌ invalid email → error on email field', () => {
    const data = { ...VALID_REGISTER, email: 'not-an-email' };
    const { isValid, errors } = validateUserInput(data, 'register');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('email');
  });

  test('❌ invalid PK phone → error on phone field', () => {
    const data = { ...VALID_REGISTER, phone: '+1-800-555-1234' };
    const { isValid, errors } = validateUserInput(data, 'register');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('phone');
  });

  test('❌ weak password → error on password field, no confirmPassword error', () => {
    const data = { ...VALID_REGISTER, password: 'weak', confirmPassword: 'weak' };
    const { isValid, errors } = validateUserInput(data, 'register');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('password');
    // confirmPassword should NOT be checked when password is already invalid
    expect(errors).not.toHaveProperty('confirmPassword');
  });

  test('❌ confirmPassword mismatch → error on confirmPassword only', () => {
    const data = { ...VALID_REGISTER, confirmPassword: 'DifferentPass@999' };
    const { isValid, errors } = validateUserInput(data, 'register');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('confirmPassword');
    expect(errors.confirmPassword).toMatch(/do not match/i);
  });

  test('❌ multiple fields invalid → all relevant errors returned together', () => {
    const data = { firstName: '', lastName: '', email: 'bad', password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD };
    const { isValid, errors } = validateUserInput(data, 'register');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('firstName');
    expect(errors).toHaveProperty('lastName');
    expect(errors).toHaveProperty('email');
  });

  test('⚠️  non-object payload → isValid false with general error', () => {
    const result = validateUserInput('this is a string', 'register');
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('general');
  });

  test('⚠️  array payload → isValid false with general error', () => {
    const result = validateUserInput([1, 2, 3], 'register');
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveProperty('general');
  });

  test('⚠️  null payload → isValid false', () => {
    const result = validateUserInput(null, 'register');
    expect(result.isValid).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. validateUserInput() — login context
// ═════════════════════════════════════════════════════════════════════════════
describe('validateUserInput() — login context', () => {
  test('✅ valid email + password → isValid true', () => {
    const result = validateUserInput({ email: VALID_EMAIL, password: 'anystring' }, 'login');
    expect(result.isValid).toBe(true);
  });

  test('❌ missing email → error on email', () => {
    const { isValid, errors } = validateUserInput({ password: 'anystring' }, 'login');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('email');
  });

  test('❌ invalid email format → error on email', () => {
    const { isValid, errors } = validateUserInput({ email: 'notvalid', password: 'anystring' }, 'login');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('email');
  });

  test('❌ missing password → error on password', () => {
    const { isValid, errors } = validateUserInput({ email: VALID_EMAIL }, 'login');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('password');
  });

  test('⚠️  login context does NOT validate password strength', () => {
    // Login only checks presence, not strength (strength was checked on register)
    const { isValid } = validateUserInput({ email: VALID_EMAIL, password: 'weak' }, 'login');
    expect(isValid).toBe(true);
  });

  test('⚠️  login context ignores firstName/lastName fields', () => {
    const data = { email: VALID_EMAIL, password: 'anystring', firstName: '', lastName: '' };
    const { isValid } = validateUserInput(data, 'login');
    expect(isValid).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. validateUserInput() — update context
// ═════════════════════════════════════════════════════════════════════════════
describe('validateUserInput() — update context', () => {
  test('✅ partial update with only firstName → valid', () => {
    const { isValid } = validateUserInput({ firstName: 'Bilal' }, 'update');
    expect(isValid).toBe(true);
  });

  test('✅ partial update with valid phone only → valid', () => {
    const { isValid } = validateUserInput({ phone: '+923211234567' }, 'update');
    expect(isValid).toBe(true);
  });

  test('❌ updating email to invalid value → error on email', () => {
    const { isValid, errors } = validateUserInput({ email: 'bad-email' }, 'update');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('email');
  });

  test('❌ updating phone to non-PK number → error on phone', () => {
    const { isValid, errors } = validateUserInput({ phone: '+1-212-555-1234' }, 'update');
    expect(isValid).toBe(false);
    expect(errors).toHaveProperty('phone');
  });

  test('⚠️  empty object → valid (no fields to validate)', () => {
    const { isValid } = validateUserInput({}, 'update');
    expect(isValid).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. Pakistani phone validator — standalone
// ═════════════════════════════════════════════════════════════════════════════
describe('validators.pakistaniPhone()', () => {
  const validNumbers = [
    ['+923001234567',  'E.164 Jazz'],
    ['+923211234567',  'E.164 Zong'],
    ['+923451234567',  'E.164 Telenor'],
    ['+923111234567',  'E.164 Ufone'],
    ['03001234567',    'local format (auto-normalized)'],
    ['0321-123-4567',  'local with dashes (normalized)'],
    ['0321 123 4567',  'local with spaces (normalized)'],
  ];

  test.each(validNumbers)('%s → null (valid)', (number) => {
    expect(validatePhone(number)).toBeNull();
  });

  const invalidNumbers = [
    ['+14155551234',    'US number'],
    ['+447911123456',   'UK number'],
    ['+924001234567',   'PK landline (starts with 4, not 3)'],
    ['923001234567',    'missing + prefix'],
    ['+9230012345',     'too short (9 digits after +923)'],
    ['+92300123456789', 'too long (11 digits after +923)'],
    ['abc',             'letters only'],
    ['',                'empty string'],
    [null,              'null'],
  ];

  test.each(invalidNumbers)('%s → error message', (number) => {
    expect(validatePhone(number)).toBeTruthy();
    expect(typeof validatePhone(number)).toBe('string');
  });
});
