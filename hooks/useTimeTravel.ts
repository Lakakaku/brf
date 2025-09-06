import { useState, useEffect, useCallback, useMemo } from 'react';
import { getCurrentTime, getSwedishBRFTimeContext, SwedishBRFTimeContext } from '@/lib/utils/time-travel';

/**
 * Custom hook for time travel functionality in Swedish BRF testing
 * 
 * Provides real-time updates of time travel state and utilities for
 * manipulating time in test environments.
 */

export interface TimeManipulation {
  years?: number;
  months?: number;
  days?: number;
  hours?: number;
  minutes?: number;
}

export interface TimeTravelState {
  currentTime: Date;
  realTime: Date;
  frozen: boolean;
  timeTravelActive: boolean;
  brfContext: SwedishBRFTimeContext;
  manipulationHistory: Array<{
    timestamp: string;
    action: string;
    fromTime: string;
    toTime: string;
    description: string;
  }>;
}

export interface TimeTravelActions {
  setTime: (date: Date) => Promise<void>;
  advanceTime: (amount: TimeManipulation) => Promise<void>;
  freezeTime: () => Promise<void>;
  unfreezeTime: () => Promise<void>;
  resetTime: () => Promise<void>;
  activateScenario: (scenario: string) => Promise<void>;
  refreshState: () => Promise<void>;
}

export interface TimeTravelHook extends TimeTravelState {
  actions: TimeTravelActions;
  isLoading: boolean;
  error: string | null;
}

export function useTimeTravel(): TimeTravelHook {
  const [state, setState] = useState<TimeTravelState>({
    currentTime: new Date(),
    realTime: new Date(),
    frozen: false,
    timeTravelActive: false,
    brfContext: getSwedishBRFTimeContext(),
    manipulationHistory: [],
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh time travel state from server
  const refreshState = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/time-travel');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get time travel state');
      }
      
      setState({
        currentTime: new Date(data.data.currentTime),
        realTime: new Date(data.data.realTime),
        frozen: data.data.frozen,
        timeTravelActive: data.data.timeTravelActive,
        brfContext: data.data.brfContext,
        manipulationHistory: data.data.manipulationHistory || [],
      });
      
      // Sync with localStorage for client-side time calculations
      if (data.data.timeTravelActive) {
        localStorage.setItem('time-travel-state', JSON.stringify({
          currentTime: data.data.currentTime,
          realTime: data.data.realTime,
          frozen: data.data.frozen,
          manipulationHistory: data.data.manipulationHistory,
        }));
      } else {
        localStorage.removeItem('time-travel-state');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to refresh time travel state:', err);
    }
  }, []);

  // Set specific time
  const setTime = useCallback(async (date: Date) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/time-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set',
          date: date.toISOString(),
          timezone: 'Europe/Stockholm',
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to set time');
      }
      
      await refreshState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to set time';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshState]);

  // Advance time by amount
  const advanceTime = useCallback(async (amount: TimeManipulation) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/time-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advance',
          amount,
          timezone: 'Europe/Stockholm',
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to advance time');
      }
      
      await refreshState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to advance time';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshState]);

  // Freeze time
  const freezeTime = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/time-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'freeze',
          timezone: 'Europe/Stockholm',
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to freeze time');
      }
      
      await refreshState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to freeze time';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshState]);

  // Unfreeze time
  const unfreezeTime = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/time-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'unfreeze',
          timezone: 'Europe/Stockholm',
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to unfreeze time');
      }
      
      await refreshState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unfreeze time';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshState]);

  // Reset to real time
  const resetTime = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/time-travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          timezone: 'Europe/Stockholm',
        }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to reset time');
      }
      
      await refreshState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset time';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshState]);

  // Activate predefined scenario
  const activateScenario = useCallback(async (scenario: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/time-travel/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to activate scenario');
      }
      
      await refreshState();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to activate scenario';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [refreshState]);

  // Memoized actions object
  const actions = useMemo<TimeTravelActions>(() => ({
    setTime,
    advanceTime,
    freezeTime,
    unfreezeTime,
    resetTime,
    activateScenario,
    refreshState,
  }), [setTime, advanceTime, freezeTime, unfreezeTime, resetTime, activateScenario, refreshState]);

  // Initial load and periodic updates
  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Update time when not frozen (client-side calculation)
  useEffect(() => {
    if (state.frozen || !state.timeTravelActive) {
      return;
    }

    const interval = setInterval(() => {
      setState(prevState => {
        const currentClientTime = getCurrentTime();
        const newBrfContext = getSwedishBRFTimeContext(currentClientTime);
        
        return {
          ...prevState,
          currentTime: currentClientTime,
          brfContext: newBrfContext,
        };
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [state.frozen, state.timeTravelActive]);

  // Return hook interface
  return {
    ...state,
    actions,
    isLoading,
    error,
  };
}

/**
 * Hook for getting scenarios list
 */
export function useTimeTravelScenarios() {
  const [scenarios, setScenarios] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScenarios = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/time-travel/scenarios');
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to load scenarios');
      }
      
      setScenarios(data.data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load scenarios';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  return {
    scenarios,
    isLoading,
    error,
    reload: loadScenarios,
  };
}

/**
 * Hook for Swedish BRF-specific time utilities
 */
export function useSwedishBRFTime() {
  const { currentTime, brfContext, timeTravelActive } = useTimeTravel();

  const isWorkingHours = useMemo(() => {
    const hour = currentTime.getHours();
    const day = currentTime.getDay();
    // Monday-Friday 8:00-17:00
    return day >= 1 && day <= 5 && hour >= 8 && hour < 17;
  }, [currentTime]);

  const isSwedenOfficeHours = useMemo(() => {
    const hour = currentTime.getHours();
    const day = currentTime.getDay();
    // Monday-Friday 9:00-16:00 (typical Swedish office hours)
    return day >= 1 && day <= 5 && hour >= 9 && hour < 16;
  }, [currentTime]);

  const isPaymentProcessingTime = useMemo(() => {
    // Banking hours for payment processing: weekdays 6:00-20:00
    const hour = currentTime.getHours();
    const day = currentTime.getDay();
    return day >= 1 && day <= 5 && hour >= 6 && hour < 20;
  }, [currentTime]);

  const timeZoneInfo = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      timeZoneName: 'long',
    });
    
    return {
      timeZone: 'Europe/Stockholm',
      timeZoneName: formatter.formatToParts(currentTime)
        .find(part => part.type === 'timeZoneName')?.value || 'Central European Time',
      isDST: currentTime.getTimezoneOffset() < new Date(currentTime.getFullYear(), 0, 1).getTimezoneOffset(),
    };
  }, [currentTime]);

  return {
    currentTime,
    brfContext,
    timeTravelActive,
    isWorkingHours,
    isSwedenOfficeHours,
    isPaymentProcessingTime,
    timeZoneInfo,
  };
}