/**
 * Login page for BRF Portal
 * Provides authentication interface with Swedish localization
 */

import { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/LoginForm';
import { authUIText } from '@/lib/validations/auth';

export const metadata: Metadata = {
  title: `${authUIText.login.title} | BRF Portal`,
  description: authUIText.login.subtitle,
};

/**
 * Login page loading component
 */
function LoginPageSkeleton() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="text-center space-y-2">
        <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
      </div>

      {/* Form skeleton */}
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-9 bg-gray-200 rounded w-full"></div>
        </div>
        
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-9 bg-gray-200 rounded w-full"></div>
        </div>

        <div className="flex items-center space-x-2">
          <div className="h-4 w-4 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
        </div>

        <div className="h-11 bg-gray-200 rounded w-full"></div>
      </div>

      {/* Footer links skeleton */}
      <div className="text-center space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
      </div>
    </div>
  );
}

/**
 * Login page component
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<LoginPageSkeleton />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}