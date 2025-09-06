'use client';

/**
 * Cooperative Switcher Hook
 * Enhanced hook for managing cooperative switching with testing utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCooperative } from '@/lib/contexts/cooperative-context';
import { useAuth } from '@/hooks/useAuth';
import type { Cooperative } from '@/components/cooperative-selector';

export interface CooperativeSwitcherOptions {
  autoLoadCooperatives?: boolean;
  enableBatchSwitching?: boolean;
  showToasts?: boolean;
  persistLastSelection?: boolean;
}

export interface SwitchResult {
  success: boolean;
  cooperative?: Cooperative;
  error?: string;
  duration?: number; // Time taken in ms
}

export interface BatchSwitchResult {
  completed: Cooperative[];
  failed: { cooperative: Cooperative; error: string }[];
  totalDuration: number;
}

export function useCooperativeSwitcher(options: CooperativeSwitcherOptions = {}) {
  const {
    autoLoadCooperatives = true,
    enableBatchSwitching = false,
    showToasts = true,
    persistLastSelection = true,
  } = options;

  const cooperative = useCooperative();
  const { user, isLoggedIn } = useAuth();
  
  const [switchInProgress, setSwitchInProgress] = useState(false);
  const [lastSwitchResult, setLastSwitchResult] = useState<SwitchResult | null>(null);
  const [batchSwitchProgress, setBatchSwitchProgress] = useState<{
    total: number;
    completed: number;
    current: Cooperative | null;
    results: BatchSwitchResult | null;
  }>({ total: 0, completed: 0, current: null, results: null });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-load cooperatives on mount if enabled and user is logged in
  useEffect(() => {
    if (autoLoadCooperatives && isLoggedIn && cooperative.availableCooperatives.length === 0) {
      cooperative.loadAvailableCooperatives();
    }
  }, [autoLoadCooperatives, isLoggedIn, cooperative]);

  /**
   * Enhanced switch function with metrics and validation
   */
  const switchCooperative = useCallback(async (
    targetCooperative: Cooperative,
    options: {
      force?: boolean;
      validateAccess?: boolean;
      timeout?: number;
    } = {}
  ): Promise<SwitchResult> => {
    const { force = false, validateAccess = true, timeout = 10000 } = options;
    const startTime = performance.now();

    // Early validation
    if (!force && cooperative.currentCooperative?.id === targetCooperative.id) {
      return {
        success: false,
        error: 'Cooperative is already selected',
        duration: 0,
      };
    }

    if (validateAccess && !cooperative.canSwitchToCooperative(targetCooperative)) {
      return {
        success: false,
        error: 'Access denied to this cooperative',
        duration: performance.now() - startTime,
      };
    }

    if (switchInProgress && !force) {
      return {
        success: false,
        error: 'Switch operation already in progress',
        duration: performance.now() - startTime,
      };
    }

    setSwitchInProgress(true);
    cooperative.clearError();

    try {
      // Create abort controller for timeout
      abortControllerRef.current = new AbortController();
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, timeout);

      // Perform the switch
      await cooperative.switchCooperative(targetCooperative);
      
      clearTimeout(timeoutId);
      
      const result: SwitchResult = {
        success: true,
        cooperative: targetCooperative,
        duration: performance.now() - startTime,
      };

      setLastSwitchResult(result);
      
      if (showToasts && typeof window !== 'undefined') {
        // You could integrate with your toast system here
        console.log(`Successfully switched to ${targetCooperative.name}`);
      }

      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const result: SwitchResult = {
        success: false,
        error: errorMessage,
        duration: performance.now() - startTime,
      };

      setLastSwitchResult(result);
      
      if (showToasts && typeof window !== 'undefined') {
        console.error(`Failed to switch to ${targetCooperative.name}: ${errorMessage}`);
      }

      return result;
      
    } finally {
      setSwitchInProgress(false);
      abortControllerRef.current = null;
    }
  }, [cooperative, switchInProgress, showToasts]);

  /**
   * Batch switch through multiple cooperatives (for testing)
   */
  const batchSwitchCooperatives = useCallback(async (
    cooperatives: Cooperative[],
    options: {
      delayBetweenSwitches?: number;
      stopOnError?: boolean;
      validateEach?: boolean;
    } = {}
  ): Promise<BatchSwitchResult> => {
    if (!enableBatchSwitching) {
      throw new Error('Batch switching is not enabled');
    }

    const { delayBetweenSwitches = 1000, stopOnError = false, validateEach = true } = options;
    const startTime = performance.now();

    setBatchSwitchProgress({
      total: cooperatives.length,
      completed: 0,
      current: null,
      results: null,
    });

    const completed: Cooperative[] = [];
    const failed: { cooperative: Cooperative; error: string }[] = [];

    try {
      for (let i = 0; i < cooperatives.length; i++) {
        const currentCoop = cooperatives[i];
        
        setBatchSwitchProgress(prev => ({
          ...prev,
          completed: i,
          current: currentCoop,
        }));

        const result = await switchCooperative(currentCoop, {
          force: true,
          validateAccess: validateEach,
        });

        if (result.success) {
          completed.push(currentCoop);
        } else {
          failed.push({
            cooperative: currentCoop,
            error: result.error || 'Unknown error',
          });

          if (stopOnError) {
            break;
          }
        }

        // Delay between switches (except for the last one)
        if (i < cooperatives.length - 1 && delayBetweenSwitches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenSwitches));
        }
      }

      const results: BatchSwitchResult = {
        completed,
        failed,
        totalDuration: performance.now() - startTime,
      };

      setBatchSwitchProgress(prev => ({
        ...prev,
        completed: cooperatives.length,
        current: null,
        results,
      }));

      return results;

    } catch (error) {
      // Handle unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Batch switch failed';
      
      const results: BatchSwitchResult = {
        completed,
        failed: [
          ...failed,
          ...cooperatives.slice(completed.length + failed.length).map(coop => ({
            cooperative: coop,
            error: errorMessage,
          })),
        ],
        totalDuration: performance.now() - startTime,
      };

      setBatchSwitchProgress(prev => ({
        ...prev,
        results,
      }));

      return results;
    }
  }, [enableBatchSwitching, switchCooperative]);

  /**
   * Quick switch to next/previous cooperative in list
   */
  const switchToNext = useCallback(async (): Promise<SwitchResult> => {
    const { currentCooperative, availableCooperatives } = cooperative;
    if (!currentCooperative || availableCooperatives.length <= 1) {
      return {
        success: false,
        error: 'Cannot switch to next cooperative',
        duration: 0,
      };
    }

    const currentIndex = availableCooperatives.findIndex(c => c.id === currentCooperative.id);
    const nextIndex = (currentIndex + 1) % availableCooperatives.length;
    
    return switchCooperative(availableCooperatives[nextIndex]);
  }, [cooperative, switchCooperative]);

  const switchToPrevious = useCallback(async (): Promise<SwitchResult> => {
    const { currentCooperative, availableCooperatives } = cooperative;
    if (!currentCooperative || availableCooperatives.length <= 1) {
      return {
        success: false,
        error: 'Cannot switch to previous cooperative',
        duration: 0,
      };
    }

    const currentIndex = availableCooperatives.findIndex(c => c.id === currentCooperative.id);
    const prevIndex = currentIndex === 0 ? availableCooperatives.length - 1 : currentIndex - 1;
    
    return switchCooperative(availableCooperatives[prevIndex]);
  }, [cooperative, switchCooperative]);

  /**
   * Switch by cooperative name or org number
   */
  const switchByIdentifier = useCallback(async (identifier: string): Promise<SwitchResult> => {
    const targetCooperative = cooperative.availableCooperatives.find(
      c => 
        c.name.toLowerCase().includes(identifier.toLowerCase()) ||
        c.orgNumber === identifier ||
        c.subdomain === identifier
    );

    if (!targetCooperative) {
      return {
        success: false,
        error: `No cooperative found matching: ${identifier}`,
        duration: 0,
      };
    }

    return switchCooperative(targetCooperative);
  }, [cooperative.availableCooperatives, switchCooperative]);

  /**
   * Cancel ongoing switch operations
   */
  const cancelSwitch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setSwitchInProgress(false);
    }
  }, []);

  /**
   * Reset batch switch progress
   */
  const resetBatchProgress = useCallback(() => {
    setBatchSwitchProgress({
      total: 0,
      completed: 0,
      current: null,
      results: null,
    });
  }, []);

  /**
   * Get switch performance metrics
   */
  const getSwitchMetrics = useCallback(() => {
    const history = cooperative.switchHistory;
    if (history.length === 0) {
      return null;
    }

    const recentSwitches = history.slice(-10);
    const userSwitches = recentSwitches.filter(h => h.reason === 'user_switch');

    return {
      totalSwitches: history.length,
      recentSwitches: recentSwitches.length,
      userInitiatedSwitches: userSwitches.length,
      averageSwitchesPerSession: history.length / (Date.now() - (history[0]?.timestamp.getTime() || Date.now())) * (1000 * 60 * 60), // per hour
      lastSwitchTime: history[history.length - 1]?.timestamp,
      lastSwitchResult,
    };
  }, [cooperative.switchHistory, lastSwitchResult]);

  return {
    // Core state
    ...cooperative,
    
    // Switch operations
    switch: switchCooperative,
    switchToNext,
    switchToPrevious,
    switchByIdentifier,
    batchSwitch: batchSwitchCooperatives,
    
    // Control operations
    cancelSwitch,
    resetBatchProgress,
    
    // Status
    isSwitching: switchInProgress || cooperative.isSwitching,
    lastResult: lastSwitchResult,
    batchProgress: batchSwitchProgress,
    
    // Utilities
    getSwitchMetrics,
    canSwitchNext: cooperative.availableCooperatives.length > 1,
    canSwitchPrevious: cooperative.availableCooperatives.length > 1,
    
    // Configuration
    isAutoLoadEnabled: autoLoadCooperatives,
    isBatchEnabled: enableBatchSwitching,
    areToastsEnabled: showToasts,
    isPersistenceEnabled: persistLastSelection,
  };
}

export default useCooperativeSwitcher;