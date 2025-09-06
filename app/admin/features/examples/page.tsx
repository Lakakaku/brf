/**
 * Feature Flag Examples Page
 * Demonstrates how feature flags are used throughout the BRF application
 */

import { Metadata } from 'next';
import FeatureFlagExamples from '@/components/examples/FeatureFlagExamples';

export const metadata: Metadata = {
  title: 'Feature Flag Exempel - BRF Portal Admin',
  description: 'Exempel på hur feature flags används i BRF Portal',
};

export default function FeatureFlagExamplesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Feature Flag Exempel</h1>
        <p className="mt-2 text-gray-600">
          Se hur feature flags används för att styra funktionalitet i BRF Portal.
        </p>
      </div>

      <FeatureFlagExamples />
    </div>
  );
}