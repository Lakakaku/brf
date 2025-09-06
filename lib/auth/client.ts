/**
 * Client-side authentication utilities for BRF Portal
 * Handles token storage, automatic refresh, and session monitoring
 */

'use client';

import { 
  AuthUser, 
  TokenPair, 
  ClientSessionState,
  RefreshTokenResponse,
  AuthErrorType 
} from './types';

/**
 * Token storage keys
 */
const STORAGE_KEYS = {
  ACCESS_TOKEN: 'brf_access_token',
  REFRESH_TOKEN: 'brf_refresh_token',
  USER_DATA: 'brf_user_data',
  SESSION_ID: 'brf_session_id',
  TOKEN_EXPIRES_AT: 'brf_token_expires_at',
  REFRESH_EXPIRES_AT: 'brf_refresh_expires_at',
  LAST_ACTIVITY: 'brf_last_activity',
} as const;

/**
 * Session configuration
 */
const SESSION_CONFIG = {
  REFRESH_THRESHOLD: 15 * 60 * 1000, // 15 minutes in milliseconds
  WARNING_THRESHOLD: 5 * 60 * 1000,  // 5 minutes in milliseconds
  CHECK_INTERVAL: 60 * 1000,         // 1 minute in milliseconds
  ACTIVITY_TIMEOUT: 30 * 60 * 1000,  // 30 minutes in milliseconds
} as const;

/**
 * Client storage utility (works with both localStorage and sessionStorage)
 */
class ClientStorage {
  private storage: Storage | null = null;
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.storage = window.localStorage;
    }
  }
  
  get(key: string): string | null {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }
  
  set(key: string, value: string): void {
    if (!this.storage) return;
    try {
      this.storage.setItem(key, value);
    } catch {
      // Storage might be full or disabled
    }
  }
  
  remove(key: string): void {
    if (!this.storage) return;
    try {
      this.storage.removeItem(key);
    } catch {
      // Ignore errors
    }
  }
  
  clear(): void {
    if (!this.storage) return;
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        this.storage!.removeItem(key);
      });
    } catch {
      // Ignore errors
    }
  }
}

const storage = new ClientStorage();

/**
 * Token management utilities
 */
export class TokenManager {
  private refreshPromise: Promise<TokenPair | null> | null = null;
  private sessionCheckInterval: NodeJS.Timeout | null = null;
  private warningShown = false;
  
  /**
   * Store token pair in client storage
   */
  storeTokens(tokenPair: TokenPair, user: AuthUser, sessionId?: string): void {
    storage.set(STORAGE_KEYS.ACCESS_TOKEN, tokenPair.accessToken);
    storage.set(STORAGE_KEYS.REFRESH_TOKEN, tokenPair.refreshToken);
    storage.set(STORAGE_KEYS.TOKEN_EXPIRES_AT, tokenPair.accessTokenExpiresAt.toISOString());
    storage.set(STORAGE_KEYS.REFRESH_EXPIRES_AT, tokenPair.refreshTokenExpiresAt.toISOString());
    storage.set(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    storage.set(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
    
    if (sessionId) {
      storage.set(STORAGE_KEYS.SESSION_ID, sessionId);
    }
  }
  
  /**
   * Get stored tokens
   */
  getStoredTokens(): TokenPair | null {
    const accessToken = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
    const expiresAt = storage.get(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    const refreshExpiresAt = storage.get(STORAGE_KEYS.REFRESH_EXPIRES_AT);
    
    if (!accessToken || !refreshToken || !expiresAt || !refreshExpiresAt) {
      return null;
    }
    
    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(expiresAt),
      refreshTokenExpiresAt: new Date(refreshExpiresAt),
      tokenType: 'bearer'
    };
  }
  
  /**
   * Get stored user data
   */
  getStoredUser(): AuthUser | null {
    const userData = storage.get(STORAGE_KEYS.USER_DATA);
    if (!userData) return null;
    
    try {
      return JSON.parse(userData);
    } catch {
      return null;
    }
  }
  
  /**
   * Get stored session ID
   */
  getSessionId(): string | null {
    return storage.get(STORAGE_KEYS.SESSION_ID);
  }
  
  /**
   * Clear all stored authentication data
   */
  clearStorage(): void {
    storage.clear();
    this.warningShown = false;
    
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }
  
  /**
   * Check if access token is expired or near expiration
   */
  isTokenExpired(thresholdMs: number = 0): boolean {
    const expiresAtStr = storage.get(STORAGE_KEYS.TOKEN_EXPIRES_AT);
    if (!expiresAtStr) return true;
    
    const expiresAt = new Date(expiresAtStr);
    const now = new Date();
    
    return (expiresAt.getTime() - now.getTime()) <= thresholdMs;
  }
  
  /**
   * Check if refresh token is expired
   */
  isRefreshTokenExpired(): boolean {
    const refreshExpiresAtStr = storage.get(STORAGE_KEYS.REFRESH_EXPIRES_AT);
    if (!refreshExpiresAtStr) return true;
    
    const refreshExpiresAt = new Date(refreshExpiresAtStr);
    const now = new Date();
    
    return now >= refreshExpiresAt;
  }
  
  /**
   * Refresh access token
   */
  async refreshToken(): Promise<TokenPair | null> {
    // Prevent multiple concurrent refresh requests
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    
    const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
      return null;
    }
    
    this.refreshPromise = this.performTokenRefresh(refreshToken);
    
    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.refreshPromise = null;
    }
  }
  
  /**
   * Perform actual token refresh
   */
  private async performTokenRefresh(refreshToken: string): Promise<TokenPair | null> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        
        // If refresh token is expired or invalid, clear storage
        if (error.code === AuthErrorType.REFRESH_TOKEN_EXPIRED || 
            error.code === AuthErrorType.REFRESH_TOKEN_INVALID) {
          this.clearStorage();
        }
        
        throw new Error(error.message || 'Token refresh failed');
      }
      
      const data: RefreshTokenResponse = await response.json();
      
      if (data.success && data.tokenPair && data.user) {
        // Store new tokens
        const sessionId = response.headers.get('X-Session-Id') || this.getSessionId();
        this.storeTokens(data.tokenPair, data.user, sessionId || undefined);
        
        // Reset warning flag
        this.warningShown = false;
        
        return data.tokenPair;
      }
      
      throw new Error(data.error || 'Token refresh failed');
      
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }
  
  /**
   * Get authorization header for API requests
   */
  getAuthHeader(): Record<string, string> {
    const accessToken = storage.get(STORAGE_KEYS.ACCESS_TOKEN);
    const sessionId = storage.get(STORAGE_KEYS.SESSION_ID);
    
    const headers: Record<string, string> = {};
    
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }
    
    if (sessionId) {
      headers['X-Session-Id'] = sessionId;
    }
    
    return headers;
  }
  
  /**
   * Update last activity timestamp
   */
  updateActivity(): void {
    storage.set(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
  }
  
  /**
   * Get time since last activity
   */
  getTimeSinceLastActivity(): number {
    const lastActivity = storage.get(STORAGE_KEYS.LAST_ACTIVITY);
    if (!lastActivity) return Infinity;
    
    return Date.now() - parseInt(lastActivity, 10);
  }
  
  /**
   * Start session monitoring
   */
  startSessionMonitoring(
    onTokenRefreshed?: (tokenPair: TokenPair) => void,
    onSessionExpiring?: (timeLeft: number) => void,
    onSessionExpired?: () => void
  ): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
    
    this.sessionCheckInterval = setInterval(async () => {
      // Check if refresh token is expired
      if (this.isRefreshTokenExpired()) {
        onSessionExpired?.();
        return;
      }
      
      // Check if user has been inactive for too long
      if (this.getTimeSinceLastActivity() > SESSION_CONFIG.ACTIVITY_TIMEOUT) {
        onSessionExpired?.();
        return;
      }
      
      // Check if access token needs refresh
      if (this.isTokenExpired(SESSION_CONFIG.REFRESH_THRESHOLD)) {
        const newTokenPair = await this.refreshToken();
        if (newTokenPair) {
          onTokenRefreshed?.(newTokenPair);
        } else {
          onSessionExpired?.();
          return;
        }
      }
      
      // Check if session is expiring soon (for warning)
      if (!this.warningShown && this.isTokenExpired(SESSION_CONFIG.WARNING_THRESHOLD)) {
        const expiresAtStr = storage.get(STORAGE_KEYS.TOKEN_EXPIRES_AT);
        if (expiresAtStr) {
          const expiresAt = new Date(expiresAtStr);
          const timeLeft = expiresAt.getTime() - Date.now();
          if (timeLeft > 0) {
            this.warningShown = true;
            onSessionExpiring?.(timeLeft);
          }
        }
      }
    }, SESSION_CONFIG.CHECK_INTERVAL);
  }
  
  /**
   * Stop session monitoring
   */
  stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }
  
  /**
   * Get current session state
   */
  getSessionState(): ClientSessionState {
    const tokens = this.getStoredTokens();
    const user = this.getStoredUser();
    const lastActivityStr = storage.get(STORAGE_KEYS.LAST_ACTIVITY);
    
    return {
      isAuthenticated: !!(tokens && user && !this.isRefreshTokenExpired()),
      user,
      tokens,
      lastActivity: lastActivityStr ? parseInt(lastActivityStr, 10) : 0,
      sessionExpiry: tokens ? tokens.refreshTokenExpiresAt.getTime() : null,
      refreshInProgress: !!this.refreshPromise,
      warningShown: this.warningShown
    };
  }
}

/**
 * HTTP client with automatic token refresh
 */
export class AuthenticatedHttpClient {
  private tokenManager: TokenManager;
  
  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }
  
  /**
   * Make authenticated API request with automatic token refresh
   */
  async fetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Update activity
    this.tokenManager.updateActivity();
    
    // Check if token needs refresh before request
    if (this.tokenManager.isTokenExpired(SESSION_CONFIG.REFRESH_THRESHOLD)) {
      await this.tokenManager.refreshToken();
    }
    
    // Add authentication headers
    const authHeaders = this.tokenManager.getAuthHeader();
    const headers = {
      ...authHeaders,
      ...options.headers,
    };
    
    // Make request
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    // If request failed due to token expiration, try refresh and retry once
    if (response.status === 401) {
      const newTokenPair = await this.tokenManager.refreshToken();
      if (newTokenPair) {
        const newAuthHeaders = this.tokenManager.getAuthHeader();
        const retryHeaders = {
          ...newAuthHeaders,
          ...options.headers,
        };
        
        return fetch(url, {
          ...options,
          headers: retryHeaders,
        });
      }
    }
    
    return response;
  }
}

/**
 * Global instances
 */
export const tokenManager = new TokenManager();
export const httpClient = new AuthenticatedHttpClient(tokenManager);

/**
 * Utility functions
 */
export const authUtils = {
  /**
   * Initialize authentication from stored data
   */
  initializeFromStorage(): ClientSessionState | null {
    const sessionState = tokenManager.getSessionState();
    return sessionState.isAuthenticated ? sessionState : null;
  },
  
  /**
   * Login with credentials
   */
  async login(credentials: { 
    email: string; 
    password: string; 
    rememberMe?: boolean;
    cooperativeId?: string;
  }): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      
      const data = await response.json();
      
      if (data.success && data.user) {
        // Extract tokens from headers
        const accessToken = response.headers.get('X-Access-Token');
        const refreshToken = response.headers.get('X-Refresh-Token');
        const sessionId = response.headers.get('X-Session-Id');
        
        if (accessToken && refreshToken) {
          // Create token pair (we need to estimate expiry times)
          const now = new Date();
          const accessExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
          const refreshExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
          
          const tokenPair: TokenPair = {
            accessToken,
            refreshToken,
            accessTokenExpiresAt: accessExpiry,
            refreshTokenExpiresAt: refreshExpiry,
            tokenType: 'bearer'
          };
          
          tokenManager.storeTokens(tokenPair, data.user, sessionId || undefined);
        }
        
        return { success: true, user: data.user };
      }
      
      return { success: false, error: data.error || 'Login failed' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  },
  
  /**
   * Logout and clear all data
   */
  async logout(): Promise<void> {
    const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
    
    // Try to revoke refresh token on server
    if (refreshToken) {
      try {
        await fetch('/api/auth/refresh', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // Ignore errors - we're logging out anyway
      }
    }
    
    // Clear all local storage
    tokenManager.clearStorage();
    tokenManager.stopSessionMonitoring();
  },
  
  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<{ user?: AuthUser; error?: string }> {
    try {
      const response = await httpClient.fetch('/api/auth/me');
      const data = await response.json();
      
      if (data.success && data.user) {
        return { user: data.user };
      }
      
      return { error: data.error || 'Failed to get user info' };
    } catch (error) {
      return { 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }
};

/**
 * Activity tracking
 */
if (typeof window !== 'undefined') {
  // Track user activity
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  
  const updateActivity = () => {
    tokenManager.updateActivity();
  };
  
  activityEvents.forEach(event => {
    window.addEventListener(event, updateActivity, true);
  });
  
  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      tokenManager.updateActivity();
    }
  });
}