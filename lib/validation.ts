// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Age validation - checks if user is 18+ with enhanced security
export const isAgeValid = (dataNascimento: string): boolean => {
  try {
    // Parse date in format DD/MM/YYYY
    const parts = dataNascimento.split('/');
    if (parts.length !== 3) {
      return false;
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in Date
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      return false;
    }

    // Validate reasonable year range (1900 to current year)
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      return false;
    }

    // Validate month range
    if (month < 0 || month > 11) {
      return false;
    }

    // Validate day range (basic check, will be validated by Date object)
    if (day < 1 || day > 31) {
      return false;
    }

    const birthDate = new Date(year, month, day);
    
    // Check if date is valid (handles invalid dates like 31/02/2000)
    if (
      birthDate.getFullYear() !== year ||
      birthDate.getMonth() !== month ||
      birthDate.getDate() !== day
    ) {
      return false;
    }

    // Prevent future dates
    const today = new Date();
    if (birthDate > today) {
      return false;
    }

    // Calculate age
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Must be at least 18 years old
    return age >= 18;
  } catch (error) {
    return false;
  }
};

// Format date input to DD/MM/YYYY format (numbers only)
export const formatDateInput = (text: string): string => {
  // Remove all non-numeric characters
  const numbers = text.replace(/\D/g, '');
  
  // Format as DD/MM/YYYY
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 4) {
    return `${numbers.slice(0, 2)}/${numbers.slice(2)}`;
  } else {
    return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}/${numbers.slice(4, 8)}`;
  }
};

// Password strength levels
export type PasswordStrength = 'weak' | 'medium' | 'strong' | 'very-strong';

// Calculate password strength
export const getPasswordStrength = (password: string): PasswordStrength => {
  if (password.length === 0) return 'weak';
  
  let score = 0;
  
  // Length checks
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1; // lowercase
  if (/[A-Z]/.test(password)) score += 1; // uppercase
  if (/[0-9]/.test(password)) score += 1; // numbers
  if (/[^a-zA-Z0-9]/.test(password)) score += 1; // symbols
  
  // Determine strength
  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  if (score <= 5) return 'strong';
  return 'very-strong';
};

// Strong password validation - requires capital, lowercase, number, symbol, and min 8 chars
export const isPasswordValid = (password: string): boolean => {
  if (password.length < 8) return false;
  
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  
  return hasLowercase && hasUppercase && hasNumber && hasSymbol;
};

// Get password requirements that are missing
export const getPasswordRequirements = (password: string): {
  length: boolean;
  lowercase: boolean;
  uppercase: boolean;
  number: boolean;
  symbol: boolean;
} => {
  return {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    symbol: /[^a-zA-Z0-9]/.test(password),
  };
};

// Clean input for security (enhanced sanitization)
export const cleanInput = (input: string): string => {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Trim whitespace
  let cleaned = input.trim();
  
  // Remove null bytes and control characters (except newlines and tabs for some fields)
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  // Limit length to prevent DoS attacks (reasonable max length)
  const MAX_LENGTH = 1000;
  if (cleaned.length > MAX_LENGTH) {
    cleaned = cleaned.substring(0, MAX_LENGTH);
  }
  
  return cleaned;
};

// Sanitize name field - allow letters, spaces, hyphens, apostrophes
export const sanitizeName = (input: string): string => {
  const cleaned = cleanInput(input);
  // Remove potentially dangerous characters but keep common name characters
  return cleaned.replace(/[<>\"'&]/g, '');
};

// Sanitize email - already validated, just clean
export const sanitizeEmail = (input: string): string => {
  return cleanInput(input).toLowerCase();
};

// Sanitize date input - only allow numbers and forward slashes
export const sanitizeDate = (input: string): string => {
  return input.replace(/[^\d/]/g, '');
};
