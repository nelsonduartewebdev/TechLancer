import {
  isValidEmail,
  isAgeValid,
  formatDateInput,
  getPasswordStrength,
  isPasswordValid,
  getPasswordRequirements,
  cleanInput,
  PasswordStrength,
} from '../validation';

describe('Validation Functions', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('test+tag@example.com')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should trim whitespace before validation', () => {
      expect(isValidEmail('  test@example.com  ')).toBe(true);
    });
  });

  describe('isAgeValid', () => {
    it('should return true for users 18 years or older', () => {
      const today = new Date();
      const year18 = today.getFullYear() - 18;
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      expect(isAgeValid(`${day}/${month}/${year18}`)).toBe(true);

      // 20 years old
      const year20 = today.getFullYear() - 20;
      expect(isAgeValid(`01/01/${year20}`)).toBe(true);
    });

    it('should return false for users under 18', () => {
      const today = new Date();
      const year17 = today.getFullYear() - 17;
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      expect(isAgeValid(`${day}/${month}/${year17}`)).toBe(false);

      // 10 years old
      const year10 = today.getFullYear() - 10;
      expect(isAgeValid(`01/01/${year10}`)).toBe(false);
    });

    it('should return false for invalid date formats', () => {
      expect(isAgeValid('invalid')).toBe(false);
      expect(isAgeValid('01/01')).toBe(false);
      expect(isAgeValid('01/01/2000/extra')).toBe(false);
      expect(isAgeValid('32/01/2000')).toBe(false); // Invalid day
      expect(isAgeValid('01/13/2000')).toBe(false); // Invalid month
    });

    it('should handle edge cases correctly', () => {
      // Exactly 18 years old today
      const today = new Date();
      const year18 = today.getFullYear() - 18;
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      expect(isAgeValid(`${day}/${month}/${year18}`)).toBe(true);
    });
  });

  describe('formatDateInput', () => {
    it('should format numbers as DD/MM/YYYY', () => {
      expect(formatDateInput('01012000')).toBe('01/01/2000');
      expect(formatDateInput('31122023')).toBe('31/12/2023');
    });

    it('should handle partial input', () => {
      expect(formatDateInput('01')).toBe('01');
      expect(formatDateInput('0101')).toBe('01/01');
      expect(formatDateInput('01012')).toBe('01/01/2');
    });

    it('should remove non-numeric characters', () => {
      expect(formatDateInput('01-01-2000')).toBe('01/01/2000');
      expect(formatDateInput('01abc01def2000')).toBe('01/01/2000');
      expect(formatDateInput('a1b2c3d4e5f6g7h8')).toBe('12/34/5678');
    });

    it('should limit to 8 digits', () => {
      expect(formatDateInput('01012000123')).toBe('01/01/2000');
    });
  });

  describe('getPasswordStrength', () => {
    it('should return weak for empty password', () => {
      expect(getPasswordStrength('')).toBe('weak');
    });

    it('should return weak for very short passwords', () => {
      expect(getPasswordStrength('abc')).toBe('weak');
      expect(getPasswordStrength('12345')).toBe('weak');
    });

    it('should return medium for passwords with some requirements', () => {
      expect(getPasswordStrength('password')).toBe('medium'); // lowercase only
      expect(getPasswordStrength('PASSWORD')).toBe('medium'); // uppercase only
      expect(getPasswordStrength('12345678')).toBe('medium'); // numbers only
    });

    it('should return strong for passwords with multiple requirements', () => {
      expect(getPasswordStrength('Password1')).toBe('strong'); // lowercase, uppercase, number
      expect(getPasswordStrength('Pass1234')).toBe('strong');
    });

    it('should return very-strong for passwords with all requirements and length >= 12', () => {
      expect(getPasswordStrength('Password123!')).toBe('very-strong'); // all requirements + 12+ chars
      expect(getPasswordStrength('MyP@ssw0rd123')).toBe('very-strong');
    });
  });

  describe('isPasswordValid', () => {
    it('should return true for valid passwords', () => {
      expect(isPasswordValid('Password1!')).toBe(true);
      expect(isPasswordValid('MyP@ssw0rd')).toBe(true);
      expect(isPasswordValid('Test123#')).toBe(true);
    });

    it('should return false for passwords without uppercase', () => {
      expect(isPasswordValid('password1!')).toBe(false);
    });

    it('should return false for passwords without lowercase', () => {
      expect(isPasswordValid('PASSWORD1!')).toBe(false);
    });

    it('should return false for passwords without numbers', () => {
      expect(isPasswordValid('Password!')).toBe(false);
    });

    it('should return false for passwords without symbols', () => {
      expect(isPasswordValid('Password1')).toBe(false);
    });

    it('should return false for passwords shorter than 8 characters', () => {
      expect(isPasswordValid('Pass1!')).toBe(false);
      expect(isPasswordValid('P1!')).toBe(false);
    });
  });

  describe('getPasswordRequirements', () => {
    it('should correctly identify all requirements for a valid password', () => {
      const requirements = getPasswordRequirements('Password1!');
      expect(requirements.length).toBe(true);
      expect(requirements.lowercase).toBe(true);
      expect(requirements.uppercase).toBe(true);
      expect(requirements.number).toBe(true);
      expect(requirements.symbol).toBe(true);
    });

    it('should correctly identify missing requirements', () => {
      const requirements = getPasswordRequirements('password1!');
      expect(requirements.length).toBe(true);
      expect(requirements.lowercase).toBe(true);
      expect(requirements.uppercase).toBe(false);
      expect(requirements.number).toBe(true);
      expect(requirements.symbol).toBe(true);
    });

    it('should identify all missing requirements for weak password', () => {
      const requirements = getPasswordRequirements('weak');
      expect(requirements.length).toBe(false);
      expect(requirements.lowercase).toBe(true);
      expect(requirements.uppercase).toBe(false);
      expect(requirements.number).toBe(false);
      expect(requirements.symbol).toBe(false);
    });
  });

  describe('cleanInput', () => {
    it('should trim whitespace from input', () => {
      expect(cleanInput('  test  ')).toBe('test');
      expect(cleanInput('test')).toBe('test');
      expect(cleanInput('  ')).toBe('');
    });

    it('should handle empty strings', () => {
      expect(cleanInput('')).toBe('');
    });
  });
});
