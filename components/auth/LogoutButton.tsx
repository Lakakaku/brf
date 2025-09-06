'use client';

/**
 * LogoutButton component for BRF Portal
 * Provides logout functionality with confirmation dialog and Swedish localization
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, Loader2 } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { 
  apiErrorMessages,
  successMessages,
  authUIText
} from '@/lib/validations/auth';

interface LogoutButtonProps {
  /**
   * Callback fired on successful logout
   */
  onSuccess?: () => void;
  /**
   * Callback fired on logout error
   */
  onError?: (error: string) => void;
  /**
   * Whether to show confirmation dialog
   */
  showConfirm?: boolean;
  /**
   * Button variant
   */
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  /**
   * Button size
   */
  size?: 'sm' | 'default' | 'lg';
  /**
   * Show icon in button
   */
  showIcon?: boolean;
  /**
   * Custom button text (overrides default Swedish text)
   */
  children?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

interface LogoutResponse {
  success: boolean;
  message?: string;
  error?: string;
  warning?: string;
}

export function LogoutButton({
  onSuccess,
  onError,
  showConfirm = true,
  variant = 'ghost',
  size = 'default',
  showIcon = true,
  children,
  className,
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  /**
   * Handle logout process
   */
  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: LogoutResponse = await response.json();

      if (data.success) {
        // Success - call callback and redirect
        onSuccess?.();
        
        // Clear any client-side authentication state
        // This could include localStorage, sessionStorage, etc.
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        
        // Redirect to login page
        router.push('/auth/login');
        
      } else {
        // API returned error
        const errorMessage = data.error || apiErrorMessages.UNKNOWN_ERROR;
        onError?.(errorMessage);
      }
    } catch (error) {
      console.error('Logout error:', error);
      const errorMessage = apiErrorMessages.NETWORK_ERROR;
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
      setShowDialog(false);
    }
  };

  /**
   * Handle logout button click
   */
  const handleClick = () => {
    if (showConfirm && !isLoading) {
      setShowDialog(true);
    } else {
      handleLogout();
    }
  };

  const { logout: uiText } = authUIText;

  const buttonContent = children || (
    <>
      {showIcon && <LogOut className="h-4 w-4 mr-2" />}
      {uiText.button}
    </>
  );

  const loadingContent = (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Loggar ut...
    </>
  );

  if (!showConfirm) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={handleLogout}
        disabled={isLoading}
        className={className}
      >
        {isLoading ? loadingContent : buttonContent}
      </Button>
    );
  }

  return (
    <AlertDialog.Root open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialog.Trigger asChild>
        <Button
          variant={variant}
          size={size}
          onClick={handleClick}
          disabled={isLoading}
          className={className}
        >
          {isLoading ? loadingContent : buttonContent}
        </Button>
      </AlertDialog.Trigger>
      
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        
        <AlertDialog.Content className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border border-gray-200 bg-white p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg">
          
          <div className="flex flex-col space-y-2 text-center sm:text-left">
            <AlertDialog.Title className="text-lg font-semibold text-gray-900">
              Logga ut
            </AlertDialog.Title>
            
            <AlertDialog.Description className="text-sm text-gray-600">
              {uiText.confirm}
            </AlertDialog.Description>
          </div>
          
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 space-y-2 space-y-reverse sm:space-y-0">
            <AlertDialog.Cancel asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="mt-2 sm:mt-0"
              >
                {uiText.cancelButton}
              </Button>
            </AlertDialog.Cancel>
            
            <AlertDialog.Action asChild>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loggar ut...
                  </>
                ) : (
                  uiText.confirmButton
                )}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

/**
 * Simple logout button without confirmation dialog
 */
export function SimpleLogoutButton(props: Omit<LogoutButtonProps, 'showConfirm'>) {
  return <LogoutButton {...props} showConfirm={false} />;
}

/**
 * Logout menu item for dropdown menus
 */
export function LogoutMenuItem(props: Omit<LogoutButtonProps, 'variant' | 'showIcon'>) {
  return (
    <LogoutButton
      {...props}
      variant="ghost"
      showIcon={true}
      className={cn(
        'w-full justify-start text-left px-2 py-1.5 text-sm',
        props.className
      )}
    />
  );
}