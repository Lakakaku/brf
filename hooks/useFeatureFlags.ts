/**
 * React Hooks for Feature Flags
 * Provides easy-to-use hooks for evaluating feature flags in React components
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeatureFlagContext, FeatureFlagEvaluation, BRFFeatureFlags, FeatureFlag } from '@/lib/features/types';

// Feature flag evaluation cache
const evaluationCache = new Map<string, FeatureFlagEvaluation>();
const cacheExpiryTime = 5 * 60 * 1000; // 5 minutes

interface UseFeatureFlagResult {
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  evaluation?: FeatureFlagEvaluation;
  refresh: () => Promise<void>;
}

interface UseFeatureFlagsResult {
  flags: Partial<Record<keyof BRFFeatureFlags, boolean>>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface UseFeatureFlagManagementResult {
  flags: FeatureFlag[];
  isLoading: boolean;
  error: string | null;
  createFlag: (flag: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'>) => Promise<FeatureFlag | null>;
  updateFlag: (id: string, updates: Partial<FeatureFlag>) => Promise<FeatureFlag | null>;
  toggleFlag: (id: string, enabled: boolean) => Promise<boolean>;
  deleteFlag: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

/**
 * Hook to evaluate a single feature flag
 */
export function useFeatureFlag(
  flagKey: keyof BRFFeatureFlags,
  context?: FeatureFlagContext
): UseFeatureFlagResult {
  const [result, setResult] = useState<UseFeatureFlagResult>({
    isEnabled: false,
    isLoading: true,
    error: null,
    refresh: async () => {},
  });

  const evaluateFlag = useCallback(async () => {
    try {
      setResult(prev => ({ ...prev, isLoading: true, error: null }));

      const cacheKey = `${flagKey}:${JSON.stringify(context)}`;
      const cached = evaluationCache.get(cacheKey);
      
      if (cached && Date.now() - cached.evaluation_time_ms < cacheExpiryTime) {
        setResult(prev => ({
          ...prev,
          isEnabled: cached.is_enabled,
          evaluation: cached,
          isLoading: false,
        }));
        return;
      }

      const response = await fetch('/api/features/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey, context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const evaluation: FeatureFlagEvaluation = await response.json();
      
      // Cache the result
      evaluationCache.set(cacheKey, evaluation);

      setResult(prev => ({
        ...prev,
        isEnabled: evaluation.is_enabled,
        evaluation,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Feature flag evaluation failed:', error);
      setResult(prev => ({
        ...prev,
        isEnabled: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
    }
  }, [flagKey, context]);

  useEffect(() => {
    evaluateFlag();
  }, [evaluateFlag]);

  return {
    ...result,
    refresh: evaluateFlag,
  };
}

/**
 * Hook to evaluate multiple feature flags at once
 */
export function useFeatureFlags(
  flagKeys: (keyof BRFFeatureFlags)[],
  context?: FeatureFlagContext
): UseFeatureFlagsResult {
  const [result, setResult] = useState<UseFeatureFlagsResult>({
    flags: {},
    isLoading: true,
    error: null,
    refresh: async () => {},
  });

  const evaluateFlags = useCallback(async () => {
    try {
      setResult(prev => ({ ...prev, isLoading: true, error: null }));

      const response = await fetch('/api/features/evaluate-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKeys, context }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const evaluations: Record<string, FeatureFlagEvaluation> = await response.json();
      
      const flags = Object.entries(evaluations).reduce((acc, [key, evaluation]) => {
        acc[key as keyof BRFFeatureFlags] = evaluation.is_enabled;
        return acc;
      }, {} as Partial<Record<keyof BRFFeatureFlags, boolean>>);

      setResult(prev => ({
        ...prev,
        flags,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Feature flags evaluation failed:', error);
      setResult(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
    }
  }, [flagKeys, context]);

  useEffect(() => {
    if (flagKeys.length > 0) {
      evaluateFlags();
    }
  }, [evaluateFlags]);

  return {
    ...result,
    refresh: evaluateFlags,
  };
}

/**
 * Hook for managing feature flags (admin use)
 */
export function useFeatureFlagManagement(
  cooperativeId?: string
): UseFeatureFlagManagementResult {
  const [result, setResult] = useState<UseFeatureFlagManagementResult>({
    flags: [],
    isLoading: true,
    error: null,
    createFlag: async () => null,
    updateFlag: async () => null,
    toggleFlag: async () => false,
    deleteFlag: async () => false,
    refresh: async () => {},
  });

  const loadFlags = useCallback(async () => {
    try {
      setResult(prev => ({ ...prev, isLoading: true, error: null }));

      const url = cooperativeId 
        ? `/api/features?cooperative_id=${cooperativeId}`
        : '/api/features';

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const flags: FeatureFlag[] = await response.json();

      setResult(prev => ({
        ...prev,
        flags,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      setResult(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
        isLoading: false,
      }));
    }
  }, [cooperativeId]);

  const createFlag = useCallback(async (
    flag: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'>
  ): Promise<FeatureFlag | null> => {
    try {
      const response = await fetch('/api/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flag),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newFlag: FeatureFlag = await response.json();
      setResult(prev => ({
        ...prev,
        flags: [...prev.flags, newFlag],
      }));

      return newFlag;
    } catch (error) {
      console.error('Failed to create feature flag:', error);
      setResult(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return null;
    }
  }, []);

  const updateFlag = useCallback(async (
    id: string,
    updates: Partial<FeatureFlag>
  ): Promise<FeatureFlag | null> => {
    try {
      const response = await fetch(`/api/features/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const updatedFlag: FeatureFlag = await response.json();
      setResult(prev => ({
        ...prev,
        flags: prev.flags.map(flag => flag.id === id ? updatedFlag : flag),
      }));

      return updatedFlag;
    } catch (error) {
      console.error('Failed to update feature flag:', error);
      setResult(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return null;
    }
  }, []);

  const toggleFlag = useCallback(async (
    id: string,
    enabled: boolean
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/features/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setResult(prev => ({
          ...prev,
          flags: prev.flags.map(flag => 
            flag.id === id ? { ...flag, is_enabled: enabled } : flag
          ),
        }));
      }

      return result.success;
    } catch (error) {
      console.error('Failed to toggle feature flag:', error);
      setResult(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return false;
    }
  }, []);

  const deleteFlag = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/features/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        setResult(prev => ({
          ...prev,
          flags: prev.flags.filter(flag => flag.id !== id),
        }));
      }

      return result.success;
    } catch (error) {
      console.error('Failed to delete feature flag:', error);
      setResult(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
      return false;
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  return {
    ...result,
    createFlag,
    updateFlag,
    toggleFlag,
    deleteFlag,
    refresh: loadFlags,
  };
}

/**
 * Hook for checking if a feature should be rendered
 */
export function useFeatureToggle(
  flagKey: keyof BRFFeatureFlags,
  context?: FeatureFlagContext,
  fallback: boolean = false
): boolean {
  const { isEnabled, isLoading, error } = useFeatureFlag(flagKey, context);
  
  if (isLoading || error) {
    return fallback;
  }
  
  return isEnabled;
}

/**
 * Higher-order component for feature flag gating
 */
export function withFeatureFlag<P extends object>(
  flagKey: keyof BRFFeatureFlags,
  FallbackComponent?: React.ComponentType<P>
) {
  return function FeatureGatedComponent(WrappedComponent: React.ComponentType<P>) {
    return function FeatureGate(props: P) {
      const isEnabled = useFeatureToggle(flagKey);
      
      if (!isEnabled) {
        return FallbackComponent ? <FallbackComponent {...props} /> : null;
      }
      
      return <WrappedComponent {...props} />;
    };
  };
}