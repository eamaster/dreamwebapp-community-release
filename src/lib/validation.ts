/**
 * Form validation utilities
 */

export interface ValidationResult {
    isValid: boolean;
    error?: string;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
    if (!email || email.trim() === '') {
        return { isValid: false, error: 'Email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return { isValid: false, error: 'Please enter a valid email address' };
    }

    return { isValid: true };
}

/**
 * Validate required field
 */
export function validateRequired(value: string, fieldName: string): ValidationResult {
    if (!value || value.trim() === '') {
        return { isValid: false, error: `${fieldName} is required` };
    }
    return { isValid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
    if (!url || url.trim() === '') {
        return { isValid: true }; // URL is optional in most cases
    }

    try {
        // Add protocol if missing
        const urlToValidate = url.startsWith('http') ? url : `https://${url}`;
        new URL(urlToValidate);
        return { isValid: true };
    } catch {
        return { isValid: false, error: 'Please enter a valid URL' };
    }
}

/**
 * Validate phone number (basic)
 */
export function validatePhone(phone: string): ValidationResult {
    if (!phone || phone.trim() === '') {
        return { isValid: true }; // Phone is optional
    }

    const phoneRegex = /^[\d\s\-+()]+$/;
    if (!phoneRegex.test(phone) || phone.replace(/\D/g, '').length < 10) {
        return { isValid: false, error: 'Please enter a valid phone number' };
    }

    return { isValid: true };
}

/**
 * Validate text length
 */
export function validateLength(
    value: string,
    minLength: number,
    maxLength: number,
    fieldName: string
): ValidationResult {
    if (value.length < minLength) {
        return {
            isValid: false,
            error: `${fieldName} must be at least ${minLength} characters`,
        };
    }

    if (value.length > maxLength) {
        return {
            isValid: false,
            error: `${fieldName} must be no more than ${maxLength} characters`,
        };
    }

    return { isValid: true };
}

/**
 * Format validation errors for display
 */
export function formatErrors(errors: Record<string, string>): string {
    return Object.values(errors).filter(Boolean).join('. ');
}
