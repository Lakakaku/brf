/**
 * Authentication components exports
 * BRF Portal authentication UI components with Swedish localization
 */

// Traditional auth components
export { LoginForm } from './LoginForm';
export { 
  LogoutButton, 
  SimpleLogoutButton, 
  LogoutMenuItem 
} from './LogoutButton';
export { AuthGuard, withAuthGuard } from './AuthGuard';

// BankID authentication components
export { BankIDMock } from './BankIDMock';
export type { 
  BankIDState, 
  BankIDError, 
  BankIDUser, 
  BankIDMockProps 
} from './BankIDMock';

// Registration components
export { RegisterForm } from './RegisterForm';
export type {
  RegistrationStep,
  RegistrationMethod,
  RegistrationData
} from './RegisterForm';

// Password reset components
export { ForgotPasswordForm } from './ForgotPasswordForm';
export { ResetPasswordForm } from './ResetPasswordForm';