'use client';

/**
 * Enhanced authentication hook for BRF Portal
 * Provides authentication state, automatic token refresh, and session monitoring
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { 
  AuthUser, 
  TokenPair, 
  ClientSessionState 
} from '@/lib/auth/types';
import { 
  tokenManager, 
  authUtils, 
  httpClient 
} from '@/lib/auth/client';

interface EnhancedAuthState {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  sessionState: ClientSessionState;
  isRefreshing: boolean;
  sessionWarning: boolean;
  timeUntilExpiry: number | null;
}

/**
 * Enhanced authentication hook with automatic token refresh and session monitoring
 */
export function useAuth() {
  const router = useRouter();
  const sessionMonitoringRef = useRef(false);
  
  const [authState, setAuthState] = useState<EnhancedAuthState>(() => {
    // Initialize from stored data on mount
    const initialSession = authUtils.initializeFromStorage();
    return {
      user: initialSession?.user || null,
      isLoggedIn: initialSession?.isAuthenticated || false,
      isLoading: true,
      error: null,
      sessionState: initialSession || tokenManager.getSessionState(),
      isRefreshing: false,
      sessionWarning: false,
      timeUntilExpiry: null,
    };
  });

  /**
   * Update authentication state from session state
   */
  const updateAuthState = useCallback((
    updates: Partial<EnhancedAuthState>, 
    sessionState?: ClientSessionState
  ) => {
    setAuthState(prev => ({
      ...prev,
      ...updates,
      sessionState: sessionState || tokenManager.getSessionState(),
    }));
  }, []);

  /**
   * Start session monitoring
   */
  const startSessionMonitoring = useCallback(() => {
    if (sessionMonitoringRef.current) return;
    
    sessionMonitoringRef.current = true;
    
    tokenManager.startSessionMonitoring(
      // On token refreshed
      (tokenPair: TokenPair) => {
        console.log('Token refreshed automatically');
        updateAuthState({ 
          isRefreshing: false,
          sessionWarning: false,
          timeUntilExpiry: null,
        });
      },
      // On session expiring warning
      (timeLeft: number) => {
        console.log('Session expiring in', Math.floor(timeLeft / 1000), 'seconds');
        updateAuthState({ 
          sessionWarning: true,
          timeUntilExpiry: timeLeft,
        });
      },
      // On session expired
      () => {
        console.log('Session expired, logging out');
        handleSessionExpired();
      }
    );
  }, [updateAuthState]);

  /**
   * Stop session monitoring
   */
  const stopSessionMonitoring = useCallback(() => {
    sessionMonitoringRef.current = false;
    tokenManager.stopSessionMonitoring();
  }, []);

  /**
   * Handle session expiration
   */
  const handleSessionExpired = useCallback(async () => {
    stopSessionMonitoring();
    tokenManager.clearStorage();
    
    updateAuthState({
      user: null,
      isLoggedIn: false,
      isLoading: false,
      error: 'Session expired. Please log in again.',
      isRefreshing: false,
      sessionWarning: false,
      timeUntilExpiry: null,
    });
    
    router.push('/auth/login');
  }, [router, stopSessionMonitoring, updateAuthState]);

  /**
   * Check authentication status from server
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      updateAuthState({ isLoading: true, error: null });
      
      const result = await authUtils.getCurrentUser();
      
      if (result.user) {
        updateAuthState({
          user: result.user,
          isLoggedIn: true,
          isLoading: false,
          error: null,
        });
        
        // Start session monitoring if logged in
        startSessionMonitoring();
        
        return { isLoggedIn: true, user: result.user };
      } else {
        updateAuthState({
          user: null,
          isLoggedIn: false,
          isLoading: false,
          error: result.error || 'Not authenticated',
        });
        
        stopSessionMonitoring();
        return { isLoggedIn: false, user: null };
      }
    } catch (error) {
      console.error('Auth status check error:', error);
      
      updateAuthState({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        error: 'Network error checking authentication',
      });
      
      stopSessionMonitoring();
      return { isLoggedIn: false, user: null };
    }
  }, [startSessionMonitoring, stopSessionMonitoring, updateAuthState]);

  /**
   * Enhanced login function
   */
  const login = useCallback(async (credentials: {
    email: string;
    password: string;
    rememberMe?: boolean;
    cooperativeId?: string;
  }) => {
    try {
      updateAuthState({ isLoading: true, error: null });
      
      const result = await authUtils.login(credentials);
      
      if (result.success && result.user) {
        updateAuthState({
          user: result.user,
          isLoggedIn: true,
          isLoading: false,
          error: null,
        });
        
        // Start session monitoring
        startSessionMonitoring();
        
        return { success: true, user: result.user };
      } else {
        updateAuthState({
          isLoading: false,
          error: result.error || 'Login failed',
        });
        
        return { success: false, error: result.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = 'Network error during login';
      
      updateAuthState({
        isLoading: false,
        error: errorMessage,
      });
      
      return { success: false, error: errorMessage };
    }
  }, [startSessionMonitoring, updateAuthState]);

  /**
   * Enhanced logout function
   */
  const logout = useCallback(async () => {
    try {
      updateAuthState({ isLoading: true });
      
      await authUtils.logout();
      
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear state and stop monitoring
      stopSessionMonitoring();
      
      updateAuthState({
        user: null,
        isLoggedIn: false,
        isLoading: false,
        error: null,
        isRefreshing: false,
        sessionWarning: false,
        timeUntilExpiry: null,
      });
      
      router.push('/auth/login');
    }
  }, [router, stopSessionMonitoring, updateAuthState]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    updateAuthState({ isRefreshing: true });
    
    try {
      const tokenPair = await tokenManager.refreshToken();
      if (tokenPair) {
        // Get fresh user data
        const result = await authUtils.getCurrentUser();
        if (result.user) {
          updateAuthState({
            user: result.user,
            isRefreshing: false,
            sessionWarning: false,
            timeUntilExpiry: null,
          });
          return { success: true, user: result.user };
        }
      }
      
      // If refresh failed, logout
      await handleSessionExpired();
      return { success: false, error: 'Session refresh failed' };
      
    } catch (error) {
      console.error('Manual refresh error:', error);
      updateAuthState({ isRefreshing: false });
      return { success: false, error: 'Refresh failed' };
    }
  }, [handleSessionExpired, updateAuthState]);

  /**
   * Dismiss session warning
   */
  const dismissSessionWarning = useCallback(() => {
    updateAuthState({ 
      sessionWarning: false,
      timeUntilExpiry: null,
    });
  }, [updateAuthState]);

  /**
   * Extend session (manual refresh to reset expiry)
   */
  const extendSession = useCallback(async () => {
    const result = await refresh();
    if (result.success) {
      updateAuthState({ 
        sessionWarning: false,
        timeUntilExpiry: null,
      });
    }
    return result;
  }, [refresh, updateAuthState]);

  /**
   * Check if user has specific permission
   */
  const hasPermission = useCallback((permission: string): boolean => {
    if (!authState.user || !authState.isLoggedIn) {
      return false;
    }
    
    return authState.user.permissions?.[permission] === true;
  }, [authState.user, authState.isLoggedIn]);

  /**
   * Check if user has specific role
   */
  const hasRole = useCallback((role: string): boolean => {
    if (!authState.user || !authState.isLoggedIn) {
      return false;
    }
    
    return authState.user.role === role;
  }, [authState.user, authState.isLoggedIn]);

  /**
   * Check if user has any of the specified roles
   */
  const hasAnyRole = useCallback((roles: string[]): boolean => {
    if (!authState.user || !authState.isLoggedIn) {
      return false;
    }
    
    return roles.includes(authState.user.role);
  }, [authState.user, authState.isLoggedIn]);

  /**
   * Get time until session expires in minutes
   */
  const getSessionTimeLeft = useCallback((): number | null => {
    const tokens = tokenManager.getStoredTokens();
    if (!tokens) return null;
    
    const timeLeft = tokens.refreshTokenExpiresAt.getTime() - Date.now();
    return Math.max(0, Math.floor(timeLeft / (60 * 1000))); // Minutes
  }, []);

  /**
   * Initialize authentication on mount
   */
  useEffect(() => {
    const initializeAuth = async () => {
      const sessionState = tokenManager.getSessionState();
      
      if (sessionState.isAuthenticated && sessionState.user) {
        // We have valid stored authentication
        updateAuthState({
          user: sessionState.user,
          isLoggedIn: true,
          isLoading: false,
          error: null,
        }, sessionState);
        
        startSessionMonitoring();
      } else {
        // Check server for authentication status
        await checkAuthStatus();
      }
    };
    
    initializeAuth();
    
    // Cleanup on unmount
    return () => {
      stopSessionMonitoring();
    };
  }, [checkAuthStatus, startSessionMonitoring, stopSessionMonitoring, updateAuthState]);

  return {
    // Basic state
    user: authState.user,
    isLoggedIn: authState.isLoggedIn,
    isLoading: authState.isLoading,
    error: authState.error,
    
    // Enhanced state
    sessionState: authState.sessionState,
    isRefreshing: authState.isRefreshing,
    sessionWarning: authState.sessionWarning,
    timeUntilExpiry: authState.timeUntilExpiry,
    
    // Actions
    login,
    logout,
    refresh,
    dismissSessionWarning,
    extendSession,
    
    // Utilities
    hasPermission,
    hasRole,
    hasAnyRole,
    getSessionTimeLeft,
    
    // Token manager access for advanced use cases
    tokenManager,
    httpClient,
  };
}