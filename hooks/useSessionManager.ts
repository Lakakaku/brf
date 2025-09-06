/**
 * Session management hooks for BRF Portal
 * Additional utility hooks for advanced session management
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthContext } from '@/lib/auth/context';
import { tokenManager } from '@/lib/auth/client';
import type { AuthUser } from '@/lib/auth/types';

/**
 * Hook for managing multiple user sessions
 */
export function useMultiSession() {
  const { user, logout } = useAuthContext();
  const [activeSessions, setActiveSessions] = useState<Array<{
    sessionId: string;
    userAgent?: string;
    ipAddress?: string;
    lastActivity: string;
    createdAt: string;
    expiresAt: string;
  }>>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Get all active sessions for current user
   */
  const loadActiveSessions = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/auth/sessions', {
        headers: tokenManager.getAuthHeader(),
      });
      
      if (response.ok) {
        const data = await response.json();
        setActiveSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  /**
   * Revoke a specific session
   */
  const revokeSession = useCallback(async (sessionId: string) => {
    try {
      const response = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: tokenManager.getAuthHeader(),
      });
      
      if (response.ok) {
        await loadActiveSessions();
        return { success: true };
      }
      
      return { success: false, error: 'Failed to revoke session' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }, [loadActiveSessions]);

  /**
   * Logout from all sessions
   */
  const logoutAllSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: tokenManager.getAuthHeader(),
      });
      
      if (response.ok) {
        await logout();
        return { success: true };
      }
      
      return { success: false, error: 'Failed to logout all sessions' };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      };
    }
  }, [logout]);

  // Load sessions when user changes
  useEffect(() => {
    if (user) {
      loadActiveSessions();
    }
  }, [user, loadActiveSessions]);

  return {
    activeSessions,
    loading,
    loadActiveSessions,
    revokeSession,
    logoutAllSessions,
  };
}

/**
 * Hook for idle timeout management
 */
export function useIdleTimeout(timeoutMinutes: number = 30) {
  const { logout, user } = useAuthContext();
  const [isIdle, setIsIdle] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timeoutMinutes * 60);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimeout = useCallback(() => {
    setIsIdle(false);
    setTimeLeft(timeoutMinutes * 60);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      setIsIdle(true);
      logout();
    }, timeoutMinutes * 60 * 1000);
    
    // Update countdown
    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [timeoutMinutes, logout]);

  const extendSession = useCallback(() => {
    resetTimeout();
    tokenManager.updateActivity();
  }, [resetTimeout]);

  // Set up activity listeners
  useEffect(() => {
    if (!user) return;
    
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      document.addEventListener(event, extendSession, true);
    });
    
    // Initial timeout
    resetTimeout();
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, extendSession, true);
      });
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [user, extendSession, resetTimeout]);

  const formatTimeLeft = useCallback(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [timeLeft]);

  return {
    isIdle,
    timeLeft,
    formatTimeLeft,
    extendSession,
    resetTimeout,
  };
}

/**
 * Hook for device fingerprinting and security
 */
export function useDeviceSecurity() {
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<string[]>([]);

  /**
   * Generate device fingerprint
   */
  const generateFingerprint = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx?.fillText('BRF Portal Fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset().toString(),
      canvas.toDataURL(),
      navigator.hardwareConcurrency?.toString() || '',
      navigator.deviceMemory?.toString() || '',
    ].join('|');
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    const fingerprintHash = Math.abs(hash).toString(16);
    setDeviceFingerprint(fingerprintHash);
    return fingerprintHash;
  }, []);

  /**
   * Check if current device is trusted
   */
  const isDeviceTrusted = useCallback(() => {
    return deviceFingerprint ? trustedDevices.includes(deviceFingerprint) : false;
  }, [deviceFingerprint, trustedDevices]);

  /**
   * Trust current device
   */
  const trustDevice = useCallback(() => {
    if (deviceFingerprint && !trustedDevices.includes(deviceFingerprint)) {
      const updatedDevices = [...trustedDevices, deviceFingerprint];
      setTrustedDevices(updatedDevices);
      localStorage.setItem('brf_trusted_devices', JSON.stringify(updatedDevices));
    }
  }, [deviceFingerprint, trustedDevices]);

  /**
   * Untrust a device
   */
  const untrustDevice = useCallback((fingerprintToRemove: string) => {
    const updatedDevices = trustedDevices.filter(fp => fp !== fingerprintToRemove);
    setTrustedDevices(updatedDevices);
    localStorage.setItem('brf_trusted_devices', JSON.stringify(updatedDevices));
  }, [trustedDevices]);

  // Initialize on mount
  useEffect(() => {
    generateFingerprint();
    
    const stored = localStorage.getItem('brf_trusted_devices');
    if (stored) {
      try {
        setTrustedDevices(JSON.parse(stored));
      } catch {
        // Ignore parsing errors
      }
    }
  }, [generateFingerprint]);

  return {
    deviceFingerprint,
    trustedDevices,
    isDeviceTrusted,
    trustDevice,
    untrustDevice,
    generateFingerprint,
  };
}

/**
 * Hook for authentication analytics
 */
export function useAuthAnalytics() {
  const { user } = useAuthContext();
  const [loginHistory, setLoginHistory] = useState<Array<{
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    location?: string;
  }>>([]);
  
  /**
   * Track login attempt
   */
  const trackLogin = useCallback((success: boolean, metadata?: any) => {
    const entry = {
      timestamp: new Date().toISOString(),
      success,
      ...metadata,
    };
    
    setLoginHistory(prev => [entry, ...prev.slice(0, 49)]); // Keep last 50 entries
    
    // Store in localStorage for persistence
    const stored = localStorage.getItem('brf_login_history');
    const history = stored ? JSON.parse(stored) : [];
    const updatedHistory = [entry, ...history.slice(0, 99)]; // Keep last 100 entries
    localStorage.setItem('brf_login_history', JSON.stringify(updatedHistory));
  }, []);
  
  /**
   * Get login statistics
   */
  const getLoginStats = useCallback(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
    
    const recent24h = loginHistory.filter(entry => 
      new Date(entry.timestamp).getTime() > oneDayAgo
    );
    const recent7d = loginHistory.filter(entry => 
      new Date(entry.timestamp).getTime() > oneWeekAgo
    );
    const recent30d = loginHistory.filter(entry => 
      new Date(entry.timestamp).getTime() > oneMonthAgo
    );
    
    return {
      total: loginHistory.length,
      successful: loginHistory.filter(e => e.success).length,
      failed: loginHistory.filter(e => !e.success).length,
      last24Hours: {
        total: recent24h.length,
        successful: recent24h.filter(e => e.success).length,
        failed: recent24h.filter(e => !e.success).length,
      },
      last7Days: {
        total: recent7d.length,
        successful: recent7d.filter(e => e.success).length,
        failed: recent7d.filter(e => !e.success).length,
      },
      last30Days: {
        total: recent30d.length,
        successful: recent30d.filter(e => e.success).length,
        failed: recent30d.filter(e => !e.success).length,
      },
      lastLogin: loginHistory.find(e => e.success)?.timestamp || null,
    };
  }, [loginHistory]);
  
  // Load history on mount
  useEffect(() => {
    const stored = localStorage.getItem('brf_login_history');
    if (stored) {
      try {
        setLoginHistory(JSON.parse(stored));
      } catch {
        // Ignore parsing errors
      }
    }
  }, []);
  
  return {
    loginHistory,
    trackLogin,
    getLoginStats,
  };
}