/**
 * Feature Flag Usage Examples
 * Demonstrates how to use feature flags throughout the BRF application
 */

'use client';

import React from 'react';
import { useFeatureFlags, useFeatureToggle } from '@/hooks/useFeatureFlags';
import FeatureGate, { InverseFeatureGate, MultiFeatureGate } from '@/components/features/FeatureGate';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard,
  Shield,
  FileText,
  Smartphone,
  Moon,
  Sun,
  Bell,
  MessageSquare
} from 'lucide-react';

/**
 * Example component showing different ways to use feature flags
 */
export default function FeatureFlagExamples() {
  // Example 1: Multiple feature flags at once
  const { flags, isLoading } = useFeatureFlags([
    'new_payment_system',
    'two_factor_auth',
    'dark_mode',
    'push_notifications',
    'document_ocr',
  ]);

  // Example 2: Single feature flag with context
  const hasSmsNotifications = useFeatureToggle('sms_notifications', {
    cooperative_id: 'example-brf-123',
    user: {
      id: 'user-456',
      email: 'example@brf.se',
      role: 'board',
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p>Laddar feature flags...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Feature Flag Exempel</CardTitle>
          <CardDescription>
            Demonstrationer av hur feature flags används i BRF Portal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Example 1: Payment System */}
          <div className="space-y-2">
            <h3 className="font-semibold">Exempel 1: Betalningssystem</h3>
            <FeatureGate
              feature="new_payment_system"
              fallback={
                <Alert>
                  <CreditCard className="h-4 w-4" />
                  <AlertDescription>
                    Det klassiska betalningssystemet används. 
                    Kontakt via bankgiro och plusgiro endast.
                  </AlertDescription>
                </Alert>
              }
            >
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">
                      Nytt betalningssystem aktiverat!
                    </span>
                  </div>
                  <p className="text-sm text-green-700 mt-2">
                    Nu kan du betala med Swish, kort och andra moderna betalningsmetoder.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="bg-green-600 hover:bg-green-700">
                      Betala med Swish
                    </Button>
                    <Button size="sm" variant="outline">
                      Betala med kort
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
          </div>

          {/* Example 2: Two-Factor Authentication */}
          <div className="space-y-2">
            <h3 className="font-semibold">Exempel 2: Tvåfaktorsautentisering</h3>
            <FeatureGate feature="two_factor_auth">
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">
                      Förbättrad säkerhet tillgänglig
                    </span>
                  </div>
                  <p className="text-sm text-blue-700 mt-2">
                    Aktivera tvåfaktorsautentisering för extra säkerhet.
                  </p>
                  <Button size="sm" className="mt-3 bg-blue-600 hover:bg-blue-700">
                    Konfigurera 2FA
                  </Button>
                </CardContent>
              </Card>
            </FeatureGate>
          </div>

          {/* Example 3: Dark Mode Toggle */}
          <div className="space-y-2">
            <h3 className="font-semibold">Exempel 3: Mörkt tema</h3>
            <div className="flex items-center gap-4">
              <FeatureGate
                feature="dark_mode"
                fallback={
                  <div className="flex items-center gap-2 text-gray-500">
                    <Sun className="h-4 w-4" />
                    <span>Ljust tema (standard)</span>
                  </div>
                }
              >
                <div className="flex items-center gap-2 text-blue-600">
                  <Moon className="h-4 w-4" />
                  <span>Mörkt tema tillgängligt</span>
                  <Badge variant="secondary">Ny</Badge>
                </div>
              </FeatureGate>
            </div>
          </div>

          {/* Example 4: Advanced Document Features */}
          <div className="space-y-2">
            <h3 className="font-semibold">Exempel 4: Avancerade dokumentfunktioner</h3>
            <MultiFeatureGate
              features={['document_ocr', 'digital_signatures']}
              mode="all"
              fallback={
                <Alert>
                  <FileText className="h-4 w-4" />
                  <AlertDescription>
                    Grundläggande dokumenthantering aktiv. 
                    Avancerade funktioner kommer snart.
                  </AlertDescription>
                </Alert>
              }
            >
              <Card className="bg-purple-50 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-600" />
                    <span className="font-medium text-purple-800">
                      Avancerad dokumenthantering
                    </span>
                  </div>
                  <p className="text-sm text-purple-700 mt-2">
                    OCR-igenkänning och digitala underskrifter är aktiverade.
                  </p>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                      Skanna dokument
                    </Button>
                    <Button size="sm" variant="outline">
                      Signera digitalt
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </MultiFeatureGate>
          </div>

          {/* Example 5: Notifications based on role and flags */}
          <div className="space-y-2">
            <h3 className="font-semibold">Exempel 5: Aviseringar baserat på roll</h3>
            <div className="flex flex-col gap-2">
              <FeatureGate feature="push_notifications">
                <div className="flex items-center gap-2 text-blue-600">
                  <Bell className="h-4 w-4" />
                  <span>Push-notifikationer aktiverade</span>
                </div>
              </FeatureGate>
              
              {hasSmsNotifications && (
                <div className="flex items-center gap-2 text-green-600">
                  <MessageSquare className="h-4 w-4" />
                  <span>SMS-notifikationer för styrelseledamöter</span>
                </div>
              )}

              <InverseFeatureGate feature="push_notifications">
                <div className="flex items-center gap-2 text-gray-500">
                  <Bell className="h-4 w-4" />
                  <span>Endast e-postaviseringar</span>
                </div>
              </InverseFeatureGate>
            </div>
          </div>

          {/* Feature flags status display */}
          <div className="space-y-2">
            <h3 className="font-semibold">Aktuell status för feature flags</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(flags).map(([key, enabled]) => (
                <Badge
                  key={key}
                  variant={enabled ? 'default' : 'secondary'}
                  className="justify-center p-2"
                >
                  {key}: {enabled ? 'På' : 'Av'}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}