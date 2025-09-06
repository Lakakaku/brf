'use client';

/**
 * LoginForm component for BRF Portal
 * Provides email/password authentication with Swedish localization
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import * as Form from '@radix-ui/react-form';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { 
  loginFormSchema, 
  type LoginFormData,
  apiErrorMessages,
  successMessages,
  authUIText
} from '@/lib/validations/auth';

interface LoginFormProps {
  /**
   * Callback fired on successful login
   */
  onSuccess?: (user: any) => void;
  /**
   * Callback fired on login error
   */
  onError?: (error: string) => void;
  /**
   * Optional cooperative ID to pre-filter login
   */
  cooperativeId?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

interface LoginResponse {
  success: boolean;
  user?: any;
  message?: string;
  error?: string;
  code?: string;
  retryAfter?: number;
}

export function LoginForm({ 
  onSuccess, 
  onError, 
  cooperativeId,
  className 
}: LoginFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
    rememberMe: false,
    cooperativeId: cooperativeId || undefined,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Handle form input changes
   */
  const handleInputChange = (field: keyof LoginFormData, value: string | boolean) => {
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
    try {
      loginFormSchema.parse(formData);
      setFieldErrors({});
      return true;
    } catch (error: any) {
      const errors: Record<string, string> = {};
      
      if (error.errors) {
        error.errors.forEach((err: any) => {
          if (err.path) {
            errors[err.path[0]] = err.message;
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

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data: LoginResponse = await response.json();

      if (data.success && data.user) {
        // Success - call callback and redirect
        onSuccess?.(data.user);
        
        // Show success message briefly before redirect
        setFormError(null);
        
        // Redirect to dashboard or intended page
        const returnUrl = new URLSearchParams(window.location.search).get('returnUrl');
        router.push(returnUrl || '/dashboard');
        
      } else {
        // API returned error
        const errorMessage = data.code && data.code in apiErrorMessages 
          ? apiErrorMessages[data.code as keyof typeof apiErrorMessages]
          : data.error || apiErrorMessages.UNKNOWN_ERROR;
          
        setFormError(errorMessage);
        onError?.(errorMessage);

        // If rate limited, show retry time
        if (data.code === 'RATE_LIMITED' && data.retryAfter) {
          setFormError(`${errorMessage} Försök igen om ${Math.ceil(data.retryAfter / 60)} minuter.`);
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = apiErrorMessages.NETWORK_ERROR;
      setFormError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Toggle password visibility
   */
  const togglePasswordVisibility = () => {
    setShowPassword(prev => !prev);
  };

  const { login: uiText } = authUIText;

  return (
    <div className={cn('w-full max-w-md mx-auto space-y-6', className)}>
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {uiText.title}
        </h1>
        <p className="text-sm text-gray-600">
          {uiText.subtitle}
        </p>
      </div>

      {/* Error Message */}
      {formError && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200" role="alert">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-800">{formError}</p>
          </div>
        </div>
      )}

      {/* Login Form */}
      <Form.Root onSubmit={handleSubmit} className="space-y-4">
        {/* Email Field */}
        <Form.Field name="email" className="space-y-2">
          <Form.Label asChild>
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">
              {uiText.emailLabel}
            </Label>
          </Form.Label>
          <Form.Control asChild>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder={uiText.emailPlaceholder}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
              className={cn(
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

        {/* Password Field */}
        <Form.Field name="password" className="space-y-2">
          <Form.Label asChild>
            <Label htmlFor="password" className="text-sm font-medium text-gray-700">
              {uiText.passwordLabel}
            </Label>
          </Form.Label>
          <div className="relative">
            <Form.Control asChild>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                placeholder={uiText.passwordPlaceholder}
                disabled={isLoading}
                autoComplete="current-password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                className={cn(
                  'pr-10',
                  fieldErrors.password && 'border-red-300 focus:border-red-500 focus:ring-red-500'
                )}
              />
            </Form.Control>
            <button
              type="button"
              onClick={togglePasswordVisibility}
              disabled={isLoading}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600 disabled:cursor-not-allowed"
              aria-label={showPassword ? 'Dölj lösenord' : 'Visa lösenord'}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <Form.Message id="password-error" className="text-sm text-red-600">
              {fieldErrors.password}
            </Form.Message>
          )}
        </Form.Field>

        {/* Remember Me Checkbox */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="rememberMe"
            checked={formData.rememberMe}
            onCheckedChange={(checked) => 
              handleInputChange('rememberMe', checked === true)
            }
            disabled={isLoading}
          />
          <Label
            htmlFor="rememberMe"
            className="text-sm text-gray-700 cursor-pointer select-none"
          >
            {uiText.rememberMeLabel}
          </Label>
        </div>

        {/* Submit Button */}
        <Form.Submit asChild>
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 text-base font-medium"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uiText.submittingButton}
              </>
            ) : (
              uiText.submitButton
            )}
          </Button>
        </Form.Submit>
      </Form.Root>

      {/* Footer Links */}
      <div className="text-center space-y-3">
        <div className="text-sm">
          <Link
            href="/auth/forgot-password"
            className="text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            {uiText.forgotPassword}
          </Link>
        </div>
        
        <div className="text-sm text-gray-600">
          {uiText.noAccount}{' '}
          <Link
            href="/auth/register"
            className="text-blue-600 hover:text-blue-800 underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
          >
            {uiText.registerLink}
          </Link>
        </div>
      </div>
    </div>
  );
}