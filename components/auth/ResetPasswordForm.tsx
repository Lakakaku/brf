'use client';

/**
 * ResetPasswordForm component for BRF Portal
 * Provides password reset completion functionality with Swedish localization
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle, Lock, ShieldCheck } from 'lucide-react';
import * as Form from '@radix-ui/react-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  resetPasswordSchema, 
  verifyResetTokenSchema,
  type ResetPasswordRequest,
  type ResetPasswordResponse,
  type VerifyResetTokenResponse
} from '@/lib/auth/types';

interface ResetPasswordFormProps {
  /**
   * Password reset token from URL
   */
  token: string;
  /**
   * Callback fired on successful password reset
   */
  onSuccess?: (user: any) => void;
  /**
   * Callback fired on error
   */
  onError?: (error: string) => void;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Swedish UI text for the reset password form
 */
const UI_TEXT = {
  title: 'Återställ lösenord',
  subtitle: 'Ange ditt nya lösenord för att slutföra återställningen.',
  verifying: 'Verifierar återställningslänk...',
  newPasswordLabel: 'Nytt lösenord',
  confirmPasswordLabel: 'Bekräfta lösenord',
  newPasswordPlaceholder: 'Ange ditt nya lösenord',
  confirmPasswordPlaceholder: 'Ange lösenordet igen',
  submitButton: 'Återställ lösenord',
  submittingButton: 'Återställer...',
  successTitle: 'Lösenord återställt!',
  successMessage: 'Ditt lösenord har återställts framgångsrikt. Du kan nu logga in med ditt nya lösenord.',
  goToLogin: 'Gå till inloggning',
  invalidTokenTitle: 'Ogiltig länk',
  tokenExpiredTitle: 'Länken har utgått',
  tokenUsedTitle: 'Länken har redan använts',
  invalidTokenMessage: 'Denna återställningslänk är ogiltig eller har utgått. Begär en ny lösenordsåterställning.',
  tokenExpiredMessage: 'Denna återställningslänk har utgått. Återställningslänkar är giltiga i 1 timme.',
  tokenUsedMessage: 'Denna återställningslänk har redan använts. Varje länk kan endast användas en gång.',
  requestNewReset: 'Begär ny återställning',
  passwordStrengthTitle: 'Lösenordskrav',
  passwordRequirements: [
    'Minst 8 tecken långt',
    'Innehåller både bokstäver och siffror',
    'Inga vanliga mönster som "123456" eller "password"'
  ],
  securityNote: 'Av säkerhetsskäl kommer alla dina aktiva sessioner att avslutas efter lösenordsbytet.',
  genericError: 'Ett fel uppstod. Försök igen senare.'
};

/**
 * Password strength validation
 */
const validatePasswordStrength = (password: string) => {
  const requirements = {
    minLength: password.length >= 8,
    hasLetterAndNumber: /[a-zA-ZåäöÅÄÖ]/.test(password) && /\d/.test(password),
    noCommonPatterns: !/(123456|password|lösenord|qwerty|admin)/i.test(password)
  };

  return {
    isValid: Object.values(requirements).every(Boolean),
    requirements
  };
};

export function ResetPasswordForm({ 
  token, 
  onSuccess, 
  onError, 
  className 
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Verify token on component mount
   */
  useEffect(() => {
    verifyToken();
  }, [token]);

  /**
   * Verify the reset token
   */
  const verifyToken = async () => {
    if (!token) {
      setTokenError(UI_TEXT.invalidTokenMessage);
      setIsVerifying(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data: VerifyResetTokenResponse = await response.json();

      if (data.success && data.valid) {
        // Token is valid
        setUserEmail(data.email || '');
        setIsVerifying(false);
      } else {
        // Token is invalid, expired, or used
        let errorMessage = UI_TEXT.invalidTokenMessage;
        
        if (data.expired) {
          errorMessage = UI_TEXT.tokenExpiredMessage;
        } else if (data.used) {
          errorMessage = UI_TEXT.tokenUsedMessage;
        }
        
        setTokenError(errorMessage);
        setUserEmail(data.email || '');
        setIsVerifying(false);
      }
    } catch (error) {
      console.error('Token verification error:', error);
      setTokenError('Kunde inte verifiera återställningslänken. Kontrollera din internetanslutning och försök igen.');
      setIsVerifying(false);
    }
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const { [field]: removed, ...rest } = prev;
        return rest;
      });
    }
    
    // Clear form error when user makes changes
    if (formError) {
      setFormError(null);
    }
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const requestData: ResetPasswordRequest = {
      token,
      newPassword: formData.newPassword,
      confirmPassword: formData.confirmPassword
    };
    
    try {
      resetPasswordSchema.parse(requestData);
      
      // Additional password strength validation
      const { isValid } = validatePasswordStrength(formData.newPassword);
      if (!isValid) {
        setFieldErrors({ 
          newPassword: 'Lösenordet uppfyller inte säkerhetskraven.' 
        });
        return false;
      }
      
      setFieldErrors({});
      return true;
    } catch (error: any) {
      const errors: Record<string, string> = {};
      
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path) {
            const field = err.path[0];
            if (field === 'newPassword') {
              errors.newPassword = 'Lösenordet måste vara minst 8 tecken långt.';
            } else if (field === 'confirmPassword') {
              errors.confirmPassword = 'Lösenorden stämmer inte överens.';
            }
          }
        });
      }
      
      // Check for password mismatch specifically
      if (formData.newPassword !== formData.confirmPassword) {
        errors.confirmPassword = 'Lösenorden stämmer inte överens.';
      }
      
      setFieldErrors(errors);
      return false;
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setFormError(null);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          newPassword: formData.newPassword,
          confirmPassword: formData.confirmPassword
        }),
      });

      const data: ResetPasswordResponse = await response.json();

      if (data.success && data.user) {
        // Success
        setIsSuccess(true);
        onSuccess?.(data.user);
      } else {
        // API returned error
        const errorMessage = data.error || UI_TEXT.genericError;
        setFormError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      const errorMessage = 'Nätverksfel. Kontrollera din internetanslutning och försök igen.';
      setFormError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Navigate to login page
   */
  const goToLogin = () => {
    router.push('/login');
  };

  // Show loading state while verifying token
  if (isVerifying) {
    return (
      <div className={cn('w-full max-w-md mx-auto space-y-6', className)}>
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {UI_TEXT.verifying}
            </h1>
          </div>
        </div>
      </div>
    );
  }

  // Show token error state
  if (tokenError) {
    return (
      <div className={cn('w-full max-w-md mx-auto space-y-6', className)}>
        {/* Error Header */}
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {tokenError.includes('utgått') ? UI_TEXT.tokenExpiredTitle :
               tokenError.includes('använts') ? UI_TEXT.tokenUsedTitle :
               UI_TEXT.invalidTokenTitle}
            </h1>
          </div>
        </div>

        {/* Error Message */}
        <div className="p-4 rounded-md bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">
            {tokenError}
          </p>
          {userEmail && (
            <p className="text-sm text-red-700 mt-2">
              Kontot: <span className="font-medium">{userEmail}</span>
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push('/forgot-password')}
            className="w-full h-11 text-base font-medium"
          >
            {UI_TEXT.requestNewReset}
          </Button>
          
          <Button
            onClick={goToLogin}
            variant="outline"
            className="w-full h-11 text-base font-medium"
          >
            {UI_TEXT.goToLogin}
          </Button>
        </div>
      </div>
    );
  }

  // Show success state
  if (isSuccess) {
    return (
      <div className={cn('w-full max-w-md mx-auto space-y-6', className)}>
        {/* Success Header */}
        <div className="text-center space-y-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {UI_TEXT.successTitle}
            </h1>
            <p className="text-sm text-gray-600 leading-relaxed">
              {UI_TEXT.successMessage}
            </p>
          </div>
        </div>

        {/* Success Message */}
        <div className="p-4 rounded-md bg-green-50 border border-green-200">
          <div className="flex items-start">
            <ShieldCheck className="h-5 w-5 text-green-400 mr-3 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-green-800 font-medium">
                Lösenord uppdaterat för {userEmail}
              </p>
              <p className="text-sm text-green-700">
                {UI_TEXT.securityNote}
              </p>
            </div>
          </div>
        </div>

        {/* Go to Login */}
        <Button
          onClick={goToLogin}
          className="w-full h-11 text-base font-medium"
        >
          {UI_TEXT.goToLogin}
        </Button>
      </div>
    );
  }

  const passwordStrength = validatePasswordStrength(formData.newPassword);

  return (
    <div className={cn('w-full max-w-md mx-auto space-y-6', className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6 text-blue-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {UI_TEXT.title}
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          {UI_TEXT.subtitle}
        </p>
        {userEmail && (
          <p className="text-sm text-blue-600 font-medium">
            {userEmail}
          </p>
        )}
      </div>

      {/* Error Message */}
      {formError && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200" role="alert">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
            <p className="text-sm text-red-800">{formError}</p>
          </div>
        </div>
      )}

      {/* Password Requirements */}
      <div className="p-4 rounded-md bg-blue-50 border border-blue-200">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          {UI_TEXT.passwordStrengthTitle}
        </h3>
        <ul className="space-y-1">
          {UI_TEXT.passwordRequirements.map((requirement, index) => (
            <li key={index} className="text-sm text-blue-700 flex items-center">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2" />
              {requirement}
            </li>
          ))}
        </ul>
      </div>

      {/* Form */}
      <Form.Root onSubmit={handleSubmit} className="space-y-4">
        {/* New Password Field */}
        <Form.Field name="newPassword" className="space-y-2">
          <Form.Label asChild>
            <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
              {UI_TEXT.newPasswordLabel} <span className="text-red-500">*</span>
            </Label>
          </Form.Label>
          <div className="relative">
            <Form.Control asChild>
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={formData.newPassword}
                onChange={(e) => handleInputChange('newPassword', e.target.value)}
                placeholder={UI_TEXT.newPasswordPlaceholder}
                disabled={isLoading}
                autoComplete="new-password"
                required
                aria-invalid={!!fieldErrors.newPassword}
                aria-describedby={fieldErrors.newPassword ? 'newPassword-error' : undefined}
                className={cn(
                  'h-11 pr-10',
                  fieldErrors.newPassword && 'border-red-300 focus:border-red-500 focus:ring-red-500'
                )}
              />
            </Form.Control>
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              disabled={isLoading}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 disabled:cursor-not-allowed"
              aria-label={showNewPassword ? 'Dölj lösenord' : 'Visa lösenord'}
            >
              {showNewPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.newPassword && (
            <Form.Message id="newPassword-error" className="text-sm text-red-600">
              {fieldErrors.newPassword}
            </Form.Message>
          )}
        </Form.Field>

        {/* Confirm Password Field */}
        <Form.Field name="confirmPassword" className="space-y-2">
          <Form.Label asChild>
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
              {UI_TEXT.confirmPasswordLabel} <span className="text-red-500">*</span>
            </Label>
          </Form.Label>
          <div className="relative">
            <Form.Control asChild>
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                placeholder={UI_TEXT.confirmPasswordPlaceholder}
                disabled={isLoading}
                autoComplete="new-password"
                required
                aria-invalid={!!fieldErrors.confirmPassword}
                aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
                className={cn(
                  'h-11 pr-10',
                  fieldErrors.confirmPassword && 'border-red-300 focus:border-red-500 focus:ring-red-500'
                )}
              />
            </Form.Control>
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              disabled={isLoading}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 disabled:cursor-not-allowed"
              aria-label={showConfirmPassword ? 'Dölj lösenord' : 'Visa lösenord'}
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <Form.Message id="confirmPassword-error" className="text-sm text-red-600">
              {fieldErrors.confirmPassword}
            </Form.Message>
          )}
        </Form.Field>

        {/* Submit Button */}
        <Form.Submit asChild>
          <Button
            type="submit"
            disabled={isLoading || !formData.newPassword || !formData.confirmPassword || !passwordStrength.isValid}
            className="w-full h-11 text-base font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {UI_TEXT.submittingButton}
              </>
            ) : (
              UI_TEXT.submitButton
            )}
          </Button>
        </Form.Submit>
      </Form.Root>

      {/* Security Note */}
      <div className="p-3 rounded-md bg-gray-50 border border-gray-200">
        <p className="text-xs text-gray-600">
          <ShieldCheck className="w-4 h-4 inline mr-1" />
          {UI_TEXT.securityNote}
        </p>
      </div>
    </div>
  );
}