/**
 * Authentication form validation schemas for BRF Portal
 * Contains client-side validation with Swedish language support
 */

import { z } from 'zod';

/**
 * Swedish error messages for form validation
 */
export const swedishAuthMessages = {
  email: {
    required: 'E-postadress krävs',
    invalid: 'Ange en giltig e-postadress',
  },
  password: {
    required: 'Lösenord krävs',
    minLength: 'Lösenordet måste innehålla minst 8 tecken',
  },
  firstName: {
    required: 'Förnamn krävs',
  },
  lastName: {
    required: 'Efternamn krävs',
  },
  confirmPassword: {
    required: 'Bekräfta lösenord',
    noMatch: 'Lösenorden matchar inte',
  },
  cooperative: {
    required: 'BRF krävs',
  },
  phone: {
    invalid: 'Ange ett giltigt telefonnummer',
  },
} as const;

/**
 * Login form validation schema with Swedish messages
 */
export const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, swedishAuthMessages.email.required)
    .email(swedishAuthMessages.email.invalid)
    .transform(email => email.toLowerCase().trim()),
  password: z
    .string()
    .min(1, swedishAuthMessages.password.required),
  rememberMe: z.boolean().default(false),
  cooperativeId: z.string().optional(),
});

/**
 * Registration form validation schema with Swedish messages
 */
export const registrationFormSchema = z.object({
  email: z
    .string()
    .min(1, swedishAuthMessages.email.required)
    .email(swedishAuthMessages.email.invalid)
    .transform(email => email.toLowerCase().trim()),
  password: z
    .string()
    .min(8, swedishAuthMessages.password.minLength),
  confirmPassword: z
    .string()
    .min(1, swedishAuthMessages.confirmPassword.required),
  firstName: z
    .string()
    .min(1, swedishAuthMessages.firstName.required)
    .trim(),
  lastName: z
    .string()
    .min(1, swedishAuthMessages.lastName.required)
    .trim(),
  cooperativeId: z
    .string()
    .min(1, swedishAuthMessages.cooperative.required),
  phone: z
    .string()
    .optional()
    .transform(phone => phone?.trim() || undefined),
}).refine(data => data.password === data.confirmPassword, {
  message: swedishAuthMessages.confirmPassword.noMatch,
  path: ['confirmPassword'],
});

/**
 * Change password form validation schema with Swedish messages
 */
export const changePasswordFormSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Nuvarande lösenord krävs'),
  newPassword: z
    .string()
    .min(8, swedishAuthMessages.password.minLength),
  confirmPassword: z
    .string()
    .min(1, swedishAuthMessages.confirmPassword.required),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: swedishAuthMessages.confirmPassword.noMatch,
  path: ['confirmPassword'],
});

/**
 * Inferred types for forms
 */
export type LoginFormData = z.infer<typeof loginFormSchema>;
export type RegistrationFormData = z.infer<typeof registrationFormSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordFormSchema>;

/**
 * API response error codes to Swedish messages
 */
export const apiErrorMessages = {
  INVALID_CREDENTIALS: 'Felaktig e-post eller lösenord',
  USER_NOT_FOUND: 'Användare hittades inte',
  USER_INACTIVE: 'Ditt konto har inaktiverats. Kontakta support.',
  ACCOUNT_INACTIVE: 'Ditt konto har inaktiverats. Kontakta support.',
  RATE_LIMITED: 'För många inloggningsförsök. Försök igen senare.',
  EMAIL_ALREADY_EXISTS: 'E-postadressen används redan',
  COOPERATIVE_NOT_FOUND: 'BRF hittades inte',
  PASSWORD_TOO_WEAK: 'Lösenordet är för svagt',
  VALIDATION_ERROR: 'Felaktiga uppgifter',
  INTERNAL_ERROR: 'Ett tekniskt fel uppstod. Försök igen senare.',
  NETWORK_ERROR: 'Nätverksfel. Kontrollera din internetanslutning.',
  UNKNOWN_ERROR: 'Ett oväntat fel uppstod. Försök igen.',
} as const;

/**
 * Success messages in Swedish
 */
export const successMessages = {
  LOGIN_SUCCESS: 'Inloggning lyckades!',
  LOGOUT_SUCCESS: 'Du har loggats ut',
  REGISTRATION_SUCCESS: 'Ditt konto har skapats. Vänta på godkännande från styrelsen.',
  PASSWORD_CHANGED: 'Lösenordet har ändrats',
} as const;

/**
 * General UI text in Swedish
 */
export const authUIText = {
  login: {
    title: 'Logga in',
    subtitle: 'Välkommen till BRF-portalen',
    emailLabel: 'E-postadress',
    emailPlaceholder: 'din.epost@example.com',
    passwordLabel: 'Lösenord',
    passwordPlaceholder: 'Ange ditt lösenord',
    rememberMeLabel: 'Kom ihåg mig',
    submitButton: 'Logga in',
    submittingButton: 'Loggar in...',
    noAccount: 'Inget konto?',
    registerLink: 'Registrera dig här',
    forgotPassword: 'Glömt lösenordet?',
  },
  logout: {
    button: 'Logga ut',
    confirm: 'Är du säker på att du vill logga ut?',
    confirmButton: 'Ja, logga ut',
    cancelButton: 'Avbryt',
  },
  register: {
    title: 'Skapa konto',
    subtitle: 'Anslut till din BRF',
    submitButton: 'Skapa konto',
    submittingButton: 'Skapar konto...',
    hasAccount: 'Har du redan ett konto?',
    loginLink: 'Logga in här',
  },
  general: {
    loading: 'Laddar...',
    error: 'Fel',
    success: 'Klart',
    close: 'Stäng',
    tryAgain: 'Försök igen',
  },
} as const;