import { validateEmail, validatePassword } from './validations';

describe('Validation Utilities', () => {
  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co')).toBe(true);
    });

    it('should return false for invalid email', () => {
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test@example')).toBe(false);
      expect(validateEmail('test.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return true for valid password', () => {
      expect(validatePassword('Password123')).toBe(true);
      expect(validatePassword('StrongPass1')).toBe(true);
    });

    it('should return false for invalid password', () => {
      expect(validatePassword('pass123')).toBe(false); // missing uppercase
      expect(validatePassword('PASS123')).toBe(false); // missing lowercase
      expect(validatePassword('Password')).toBe(false); // missing number
      expect(validatePassword('Pass1')).toBe(false); // too short
      expect(validatePassword('')).toBe(false);
    });
  });
});
