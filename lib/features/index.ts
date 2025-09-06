/**
 * Feature Flags Entry Point
 * Main exports for the feature flag system
 */

// Core types
export type {
  FeatureFlag,
  FeatureFlagContext,
  FeatureFlagEvaluation,
  FeatureFlagUsage,
  FeatureFlagVariant,
  FeatureCategory,
  FeatureEnvironment,
  FeatureStatus,
  FeatureTargetType,
  FeatureTargetConfig,
  BRFFeatureFlags,
} from './types';

// Service and utilities
export { FeatureFlagService, getFeatureFlagService } from './service';
export { BRF_FEATURE_CONFIGS } from './types';

// React hooks
export {
  useFeatureFlag,
  useFeatureFlags,
  useFeatureFlagManagement,
  useFeatureToggle,
  withFeatureFlag,
} from '../hooks/useFeatureFlags';

// Helper functions
export const isFeatureEnabled = async (
  flagKey: keyof BRFFeatureFlags,
  context?: FeatureFlagContext
): Promise<boolean> => {
  const service = getFeatureFlagService();
  return service.isEnabled(flagKey, context);
};

export const evaluateFeature = async (
  flagKey: string,
  context?: FeatureFlagContext
): Promise<FeatureFlagEvaluation> => {
  const service = getFeatureFlagService();
  return service.evaluate(flagKey, context);
};