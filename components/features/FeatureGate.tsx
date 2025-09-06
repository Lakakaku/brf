/**
 * Feature Gate Component
 * Conditionally renders content based on feature flag evaluation
 */

'use client';

import React from 'react';
import { useFeatureToggle } from '@/hooks/useFeatureFlags';
import { BRFFeatureFlags, FeatureFlagContext } from '@/lib/features/types';

interface FeatureGateProps {
  feature: keyof BRFFeatureFlags;
  context?: FeatureFlagContext;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * FeatureGate component conditionally renders children based on feature flag status
 * 
 * @example
 * <FeatureGate feature="new_payment_system">
 *   <NewPaymentComponent />
 * </FeatureGate>
 * 
 * @example
 * <FeatureGate 
 *   feature="dark_mode" 
 *   fallback={<LightThemeComponent />}
 * >
 *   <DarkThemeComponent />
 * </FeatureGate>
 */
export default function FeatureGate({
  feature,
  context,
  fallback = null,
  children,
}: FeatureGateProps) {
  const isEnabled = useFeatureToggle(feature, context, false);
  
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

/**
 * Inverse Feature Gate - renders when feature is disabled
 */
interface InverseFeatureGateProps extends FeatureGateProps {}

export function InverseFeatureGate({
  feature,
  context,
  fallback = null,
  children,
}: InverseFeatureGateProps) {
  const isEnabled = useFeatureToggle(feature, context, false);
  
  return !isEnabled ? <>{children}</> : <>{fallback}</>;
}

/**
 * Multi-Feature Gate - requires all features to be enabled
 */
interface MultiFeatureGateProps {
  features: (keyof BRFFeatureFlags)[];
  context?: FeatureFlagContext;
  fallback?: React.ReactNode;
  children: React.ReactNode;
  mode?: 'all' | 'any'; // all = AND logic, any = OR logic
}

export function MultiFeatureGate({
  features,
  context,
  fallback = null,
  children,
  mode = 'all',
}: MultiFeatureGateProps) {
  const featureStates = features.map(feature => 
    useFeatureToggle(feature, context, false)
  );
  
  const isEnabled = mode === 'all' 
    ? featureStates.every(state => state)
    : featureStates.some(state => state);
  
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}