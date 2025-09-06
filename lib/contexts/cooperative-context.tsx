'use client';

/**
 * Cooperative Context Provider for Multi-tenant Testing
 * Manages cooperative switching state and ensures data isolation
 */

import * as React from 'react';
import { createContext, useContext, useCallback, useEffect, useReducer } from 'react';
import { useRouter } from 'next/navigation';
import type { Cooperative } from '@/components/cooperative-selector';
import type { AuthUser } from '@/lib/auth/types';

export interface CooperativeContextState {
  // Current cooperative data
  currentCooperative: Cooperative | null;
  availableCooperatives: Cooperative[];
  
  // Loading and error states
  isLoading: boolean;
  isSwitching: boolean;
  error: string | null;
  
  // User context
  user: AuthUser | null;
  
  // Testing utilities
  isTestingMode: boolean;
  isolationWarningShown: boolean;
  
  // Metadata
  lastSwitched: Date | null;
  switchHistory: CooperativeSwitchHistoryEntry[];
}

export interface CooperativeSwitchHistoryEntry {
  fromCooperativeId: string | null;
  toCooperativeId: string;
  timestamp: Date;
  reason: 'user_switch' | 'auth_change' | 'system_init';
}

type CooperativeContextAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SWITCHING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CURRENT_COOPERATIVE'; payload: Cooperative | null }
  | { type: 'SET_AVAILABLE_COOPERATIVES'; payload: Cooperative[] }
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_TESTING_MODE'; payload: boolean }
  | { type: 'SET_ISOLATION_WARNING_SHOWN'; payload: boolean }
  | { type: 'ADD_SWITCH_HISTORY'; payload: CooperativeSwitchHistoryEntry }
  | { type: 'RESET_STATE' };

const initialState: CooperativeContextState = {
  currentCooperative: null,
  availableCooperatives: [],
  isLoading: false,
  isSwitching: false,
  error: null,
  user: null,
  isTestingMode: false,
  isolationWarningShown: false,
  lastSwitched: null,
  switchHistory: [],
};

function cooperativeReducer(
  state: CooperativeContextState,
  action: CooperativeContextAction
): CooperativeContextState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_SWITCHING':
      return { ...state, isSwitching: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_CURRENT_COOPERATIVE':
      return {
        ...state,
        currentCooperative: action.payload,
        lastSwitched: action.payload ? new Date() : null,
      };
    case 'SET_AVAILABLE_COOPERATIVES':
      return { ...state, availableCooperatives: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_TESTING_MODE':
      return { ...state, isTestingMode: action.payload };
    case 'SET_ISOLATION_WARNING_SHOWN':
      return { ...state, isolationWarningShown: action.payload };
    case 'ADD_SWITCH_HISTORY':
      return {
        ...state,
        switchHistory: [...state.switchHistory.slice(-9), action.payload], // Keep last 10 entries
      };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

export interface CooperativeContextValue extends CooperativeContextState {
  // Actions
  switchCooperative: (cooperative: Cooperative) => Promise<void>;
  loadAvailableCooperatives: () => Promise<void>;
  refreshCurrentCooperative: () => Promise<void>;
  clearError: () => void;
  
  // Testing utilities
  enableTestingMode: () => void;
  disableTestingMode: () => void;
  showIsolationWarning: () => void;
  dismissIsolationWarning: () => void;
  
  // Utilities
  hasPermissionInCooperative: (permission: string) => boolean;
  canSwitchToCooperative: (cooperative: Cooperative) => boolean;
  getCooperativeById: (id: string) => Cooperative | null;
}

const CooperativeContext = createContext<CooperativeContextValue | null>(null);

export function useCooperative(): CooperativeContextValue {
  const context = useContext(CooperativeContext);
  if (!context) {
    throw new Error('useCooperative must be used within a CooperativeProvider');
  }
  return context;
}

export interface CooperativeProviderProps {
  children: React.ReactNode;
  user?: AuthUser | null;
  initialCooperative?: Cooperative | null;
  enablePersistence?: boolean;
  testingMode?: boolean;
}

const STORAGE_KEY = 'brf-portal-cooperative-context';

export function CooperativeProvider({
  children,
  user,
  initialCooperative,
  enablePersistence = true,
  testingMode = false,
}: CooperativeProviderProps) {
  const [state, dispatch] = useReducer(cooperativeReducer, {
    ...initialState,
    user: user || null,
    currentCooperative: initialCooperative || null,
    isTestingMode: testingMode,
  });
  
  const router = useRouter();

  // Load persisted state from localStorage on mount
  useEffect(() => {
    if (enablePersistence && typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
          const parsed = JSON.parse(savedState);
          if (parsed.currentCooperative) {
            dispatch({ type: 'SET_CURRENT_COOPERATIVE', payload: parsed.currentCooperative });
          }
          if (parsed.availableCooperatives) {
            dispatch({ type: 'SET_AVAILABLE_COOPERATIVES', payload: parsed.availableCooperatives });
          }
          if (parsed.isTestingMode !== undefined) {
            dispatch({ type: 'SET_TESTING_MODE', payload: parsed.isTestingMode });
          }
        }
      } catch (error) {
        console.warn('Failed to load cooperative context from storage:', error);
      }
    }
  }, [enablePersistence]);

  // Persist state changes to localStorage
  useEffect(() => {
    if (enablePersistence && typeof window !== 'undefined') {
      try {
        const toSave = {
          currentCooperative: state.currentCooperative,
          availableCooperatives: state.availableCooperatives,
          isTestingMode: state.isTestingMode,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      } catch (error) {
        console.warn('Failed to save cooperative context to storage:', error);
      }
    }
  }, [state.currentCooperative, state.availableCooperatives, state.isTestingMode, enablePersistence]);

  // Update user when prop changes
  useEffect(() => {
    dispatch({ type: 'SET_USER', payload: user || null });
  }, [user]);

  /**
   * Load available cooperatives from API
   */
  const loadAvailableCooperatives = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await fetch('/api/cooperatives/available', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        dispatch({ type: 'SET_AVAILABLE_COOPERATIVES', payload: result.data });
      } else {
        throw new Error(result.message || 'Failed to load cooperatives');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to load available cooperatives:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  /**
   * Switch to a different cooperative
   */
  const switchCooperative = useCallback(async (cooperative: Cooperative) => {
    if (state.currentCooperative?.id === cooperative.id) {
      return; // Already selected
    }

    dispatch({ type: 'SET_SWITCHING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // Call API to switch cooperative context
      const response = await fetch('/api/cooperatives/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          cooperativeId: cooperative.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Add to switch history
        dispatch({
          type: 'ADD_SWITCH_HISTORY',
          payload: {
            fromCooperativeId: state.currentCooperative?.id || null,
            toCooperativeId: cooperative.id,
            timestamp: new Date(),
            reason: 'user_switch',
          },
        });

        // Set new cooperative
        dispatch({ type: 'SET_CURRENT_COOPERATIVE', payload: cooperative });

        // Show isolation warning if switching in testing mode
        if (state.isTestingMode && !state.isolationWarningShown) {
          dispatch({ type: 'SET_ISOLATION_WARNING_SHOWN', payload: true });
        }

        // Force router refresh to update server components
        router.refresh();
      } else {
        throw new Error(result.message || 'Failed to switch cooperative');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to switch cooperative:', error);
    } finally {
      dispatch({ type: 'SET_SWITCHING', payload: false });
    }
  }, [state.currentCooperative, state.isTestingMode, state.isolationWarningShown, router]);

  /**
   * Refresh current cooperative data
   */
  const refreshCurrentCooperative = useCallback(async () => {
    if (!state.currentCooperative) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await fetch(`/api/cooperatives/${state.currentCooperative.id}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        dispatch({ type: 'SET_CURRENT_COOPERATIVE', payload: result.data });
      }
    } catch (error) {
      console.error('Failed to refresh cooperative:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentCooperative]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  /**
   * Enable testing mode
   */
  const enableTestingMode = useCallback(() => {
    dispatch({ type: 'SET_TESTING_MODE', payload: true });
  }, []);

  /**
   * Disable testing mode
   */
  const disableTestingMode = useCallback(() => {
    dispatch({ type: 'SET_TESTING_MODE', payload: false });
    dispatch({ type: 'SET_ISOLATION_WARNING_SHOWN', payload: false });
  }, []);

  /**
   * Show isolation warning
   */
  const showIsolationWarning = useCallback(() => {
    dispatch({ type: 'SET_ISOLATION_WARNING_SHOWN', payload: true });
  }, []);

  /**
   * Dismiss isolation warning
   */
  const dismissIsolationWarning = useCallback(() => {
    dispatch({ type: 'SET_ISOLATION_WARNING_SHOWN', payload: false });
  }, []);

  /**
   * Check if user has permission in current cooperative
   */
  const hasPermissionInCooperative = useCallback((permission: string): boolean => {
    if (!state.user || !state.currentCooperative) {
      return false;
    }
    
    return state.user.permissions?.[permission] === true;
  }, [state.user, state.currentCooperative]);

  /**
   * Check if user can switch to a specific cooperative
   */
  const canSwitchToCooperative = useCallback((cooperative: Cooperative): boolean => {
    if (!state.user) return false;
    
    // In testing mode, allow all switches
    if (state.isTestingMode) return true;
    
    // Check if user has access to this cooperative
    // This would typically check user's cooperative memberships
    return state.availableCooperatives.some(c => c.id === cooperative.id);
  }, [state.user, state.isTestingMode, state.availableCooperatives]);

  /**
   * Get cooperative by ID
   */
  const getCooperativeById = useCallback((id: string): Cooperative | null => {
    return state.availableCooperatives.find(c => c.id === id) || null;
  }, [state.availableCooperatives]);

  const contextValue: CooperativeContextValue = {
    // State
    ...state,
    
    // Actions
    switchCooperative,
    loadAvailableCooperatives,
    refreshCurrentCooperative,
    clearError,
    
    // Testing utilities
    enableTestingMode,
    disableTestingMode,
    showIsolationWarning,
    dismissIsolationWarning,
    
    // Utilities
    hasPermissionInCooperative,
    canSwitchToCooperative,
    getCooperativeById,
  };

  return (
    <CooperativeContext.Provider value={contextValue}>
      {children}
    </CooperativeContext.Provider>
  );
}

export default CooperativeProvider;