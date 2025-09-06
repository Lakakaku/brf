'use client';

/**
 * ForgotPasswordForm component for BRF Portal
 * Provides password reset request functionality with Swedish localization
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import * as Form from '@radix-ui/react-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { 
  forgotPasswordSchema, 
  type ForgotPasswordRequest,
  type ForgotPasswordResponse
} from '@/lib/auth/types';

interface ForgotPasswordFormProps {
  /**
   * Callback fired on successful password reset request
   */
  onSuccess?: (email: string) => void;
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
 * Swedish UI text for the forgot password form
 */
const UI_TEXT = {
  title: 'Glömt lösenord?',
  subtitle: 'Ange din e-postadress så skickar vi dig instruktioner för att återställa lösenordet.',
  emailLabel: 'E-postadress',
  emailPlaceholder: 'din@email.se',
  submitButton: 'Skicka återställningslänk',
  submittingButton: 'Skickar...',
  successTitle: 'E-post skickad!',
  successMessage: 'Om din e-postadress finns i vårt system kommer du att få ett meddelande med instruktioner för återställning av lösenord inom några minuter.',
  backToLogin: '← Tillbaka till inloggning',
  supportText: 'Behöver du hjälp?',
  contactSupport: 'Kontakta support',
  checkSpam: 'Kom ihåg att kontrollera din skräppost om du inte ser meddelandet.',
  emailRequired: 'E-postadress krävs',
  emailInvalid: 'Ange en giltig e-postadress',
  rateLimitTitle: 'För många förfrågningar',
  genericError: 'Ett fel uppstod. Försök igen senare.'
};

export function ForgotPasswordForm({ 
  onSuccess, 
  onError, 
  className 
}: ForgotPasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  /**
   * Handle email input change
   */
  const handleEmailChange = (value: string) => {
    setEmail(value);
    
    // Clear field error when user starts typing
    if (fieldErrors.email) {
      setFieldErrors(prev => {
        const { email: removed, ...rest } = prev;
        return rest;
      });
    }
    
    // Clear form error when user makes changes
    if (formError) {
      setFormError(null);
      setRetryAfter(null);
    }
  };

  /**
   * Validate form data
   */
  const validateForm = (): boolean => {
    const formData: ForgotPasswordRequest = { email: email.trim() };
    
    try {
      forgotPasswordSchema.parse(formData);
      setFieldErrors({});
      return true;
    } catch (error: any) {
      const errors: Record<string, string> = {};
      
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path) {
            const field = err.path[0];
            if (field === 'email') {
              errors.email = err.code === 'invalid_string' 
                ? UI_TEXT.emailInvalid 
                : UI_TEXT.emailRequired;
            }
          }
        });
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
    setRetryAfter(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data: ForgotPasswordResponse = await response.json();

      if (data.success) {
        // Success - show success state
        setIsSuccess(true);
        onSuccess?.(email.trim());
      } else {
        // API returned error
        let errorMessage = data.error || UI_TEXT.genericError;
        
        // Handle rate limiting
        if (data.rateLimitExceeded && data.retryAfter) {
          setRetryAfter(data.retryAfter);
          const minutes = Math.ceil(data.retryAfter / 60);
          errorMessage = `För många förfrågningar. Försök igen om ${minutes} ${minutes === 1 ? 'minut' : 'minuter'}.`;
        }
          
        setFormError(errorMessage);
        onError?.(errorMessage);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      const errorMessage = 'Nätverksfel. Kontrollera din internetanslutning och försök igen.';
      setFormError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Reset form to initial state
   */
  const resetForm = () => {
    setIsSuccess(false);
    setFormError(null);
    setEmail('');
    setFieldErrors({});
    setRetryAfter(null);
  };

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
            <Mail className="h-5 w-5 text-green-400 mr-3 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-green-800 font-medium">
                E-post skickad till {email}
              </p>
              <p className="text-sm text-green-700">
                {UI_TEXT.checkSpam}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-4">
          <Button
            onClick={resetForm}
            variant="outline"
            className="w-full h-11 text-base font-medium"
          >
            Skicka till annan e-postadress
          </Button>
          
          <div className="text-center">
            <Link
              href="/login"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {UI_TEXT.backToLogin}
            </Link>
          </div>
        </div>

        {/* Support */}
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            {UI_TEXT.supportText}
          </p>
          <Link
            href="/support"
            className="text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            {UI_TEXT.contactSupport}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-md mx-auto space-y-6', className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {UI_TEXT.title}
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed">
          {UI_TEXT.subtitle}
        </p>
      </div>

      {/* Error Message */}
      {formError && (
        <div className={cn(
          'p-4 rounded-md border',
          retryAfter 
            ? 'bg-amber-50 border-amber-200' 
            : 'bg-red-50 border-red-200'
        )} role="alert">
          <div className="flex items-start">
            <AlertCircle className={cn(
              'h-5 w-5 mr-2 mt-0.5',
              retryAfter ? 'text-amber-400' : 'text-red-400'
            )} />
            <div className="space-y-1">
              <p className={cn(
                'text-sm font-medium',
                retryAfter ? 'text-amber-800' : 'text-red-800'
              )}>
                {retryAfter ? UI_TEXT.rateLimitTitle : 'Ett fel uppstod'}
              </p>
              <p className={cn(
                'text-sm',
                retryAfter ? 'text-amber-700' : 'text-red-700'
              )}>
                {formError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <Form.Root onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <Form.Field name="email" className="space-y-2">
          <Form.Label asChild>
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              {UI_TEXT.emailLabel} <span className="text-red-500">*</span>
            </Label>
          </Form.Label>
          <Form.Control asChild>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
              placeholder={UI_TEXT.emailPlaceholder}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
              required
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={cn(
                'h-11',
                fieldErrors.email && 'border-red-300 focus:border-red-500 focus:ring-red-500'
              )}
            />
          </Form.Control>
          {fieldErrors.email && (
            <Form.Message id="email-error" className="text-sm text-red-600">
              {fieldErrors.email}
            </Form.Message>
          )}
        </Form.Field>

        {/* Submit Button */}
        <Form.Submit asChild>
          <Button
            type="submit"
            disabled={isLoading || !email.trim()}
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

      {/* Back to Login */}
      <div className="text-center pt-4">
        <Link
          href="/login"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {UI_TEXT.backToLogin}
        </Link>
      </div>

      {/* Support */}
      <div className="text-center pt-2 border-t border-gray-200">
        <p className="text-sm text-gray-600 mb-2">
          {UI_TEXT.supportText}
        </p>
        <Link
          href="/support"
          className="text-sm text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
        >
          {UI_TEXT.contactSupport}
        </Link>
      </div>
    </div>
  );
}