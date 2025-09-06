'use client';

/**
 * Cooperative Switcher Wrapper
 * Complete integration component that brings together all cooperative switching functionality
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CooperativeProvider } from '@/lib/contexts/cooperative-context';
import { useAuth } from '@/hooks/useAuth';
import { useCooperativeSwitcher } from '@/hooks/useCooperativeSwitcher';
import { CooperativeSelector } from './cooperative-selector';
import { CooperativeIndicator } from './cooperative-indicator';
import { cn } from '@/lib/utils';

export interface CooperativeSwitcherWrapperProps {
  children: React.ReactNode;
  variant?: 'full' | 'header' | 'sidebar';
  showTestingWarning?: boolean;
  showIsolationIndicator?: boolean;
  enableTestingMode?: boolean;
  className?: string;
}

export function CooperativeSwitcherWrapper({
  children,
  variant = 'full',
  showTestingWarning = true,
  showIsolationIndicator = true,
  enableTestingMode = false,
  className,
}: CooperativeSwitcherWrapperProps) {
  const { user, isLoggedIn } = useAuth();
  const [isolationWarningDismissed, setIsolationWarningDismissed] = useState(false);

  return (
    <CooperativeProvider
      user={user}
      enablePersistence={true}
      testingMode={enableTestingMode}
    >
      <CooperativeSwitcherContent
        variant={variant}
        showTestingWarning={showTestingWarning}
        showIsolationIndicator={showIsolationIndicator}
        isolationWarningDismissed={isolationWarningDismissed}
        onDismissIsolationWarning={() => setIsolationWarningDismissed(true)}
        className={className}
      >
        {children}
      </CooperativeSwitcherContent>
    </CooperativeProvider>
  );
}

interface CooperativeSwitcherContentProps {
  children: React.ReactNode;
  variant: 'full' | 'header' | 'sidebar';
  showTestingWarning: boolean;
  showIsolationIndicator: boolean;
  isolationWarningDismissed: boolean;
  onDismissIsolationWarning: () => void;
  className?: string;
}

function CooperativeSwitcherContent({
  children,
  variant,
  showTestingWarning,
  showIsolationIndicator,
  isolationWarningDismissed,
  onDismissIsolationWarning,
  className,
}: CooperativeSwitcherContentProps) {
  const cooperativeSwitcher = useCooperativeSwitcher({
    autoLoadCooperatives: true,
    enableBatchSwitching: true,
    showToasts: true,
    persistLastSelection: true,
  });

  const [showTestingAlert, setShowTestingAlert] = useState(false);

  // Show testing alert when testing mode is enabled and data isolation warning should be shown
  useEffect(() => {
    if (
      cooperativeSwitcher.isTestingMode &&
      !cooperativeSwitcher.isolationWarningShown &&
      showTestingWarning &&
      !isolationWarningDismissed
    ) {
      setShowTestingAlert(true);
    } else {
      setShowTestingAlert(false);
    }
  }, [
    cooperativeSwitcher.isTestingMode,
    cooperativeSwitcher.isolationWarningShown,
    showTestingWarning,
    isolationWarningDismissed,
  ]);

  const handleDismissTestingAlert = () => {
    setShowTestingAlert(false);
    onDismissIsolationWarning();
    cooperativeSwitcher.dismissIsolationWarning();
  };

  const renderCooperativeControls = () => {
    switch (variant) {
      case 'header':
        return (
          <div className="flex items-center gap-4">
            <CooperativeIndicator
              variant="header"
              showSelector={true}
              showIsolationStatus={showIsolationIndicator}
              showTestingMode={true}
            />
          </div>
        );

      case 'sidebar':
        return (
          <div className="space-y-4">
            <CooperativeIndicator
              variant="sidebar"
              showSelector={true}
              showIsolationStatus={showIsolationIndicator}
              showTestingMode={true}
              showSwitchHistory={true}
            />
            
            {cooperativeSwitcher.isTestingMode && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="font-medium text-sm mb-2">Testverktyg</h4>
                  <div className="space-y-2 text-xs">
                    <p>Testläge aktivt - alla föreningar tillgängliga</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cooperativeSwitcher.switchToNext}
                        disabled={!cooperativeSwitcher.canSwitchNext}
                        className="h-6 px-2 text-xs"
                      >
                        Nästa
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cooperativeSwitcher.switchToPrevious}
                        disabled={!cooperativeSwitcher.canSwitchPrevious}
                        className="h-6 px-2 text-xs"
                      >
                        Föregående
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'full':
      default:
        return (
          <div className="space-y-6">
            <CooperativeIndicator
              variant="full"
              showSelector={true}
              showIsolationStatus={showIsolationIndicator}
              showTestingMode={true}
              showSwitchHistory={true}
            />

            {cooperativeSwitcher.isTestingMode && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-lg mb-4">Testverktyg och Dataisolering</h3>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <h4 className="font-medium mb-2">Snabbväxling</h4>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={cooperativeSwitcher.switchToNext}
                          disabled={!cooperativeSwitcher.canSwitchNext || cooperativeSwitcher.isSwitching}
                        >
                          Nästa förening
                        </Button>
                        <Button
                          variant="outline"
                          onClick={cooperativeSwitcher.switchToPrevious}
                          disabled={!cooperativeSwitcher.canSwitchPrevious || cooperativeSwitcher.isSwitching}
                        >
                          Föregående förening
                        </Button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium mb-2">Testläge</h4>
                      <div className="flex gap-2">
                        <Button
                          variant={cooperativeSwitcher.isTestingMode ? "default" : "outline"}
                          onClick={() => 
                            cooperativeSwitcher.isTestingMode 
                              ? cooperativeSwitcher.disableTestingMode()
                              : cooperativeSwitcher.enableTestingMode()
                          }
                        >
                          {cooperativeSwitcher.isTestingMode ? 'Inaktivera' : 'Aktivera'} testläge
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        I testläge kan du växla mellan alla föreningar för att testa dataisolering
                      </p>
                    </div>
                  </div>

                  {cooperativeSwitcher.getSwitchMetrics() && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="font-medium mb-2">Växlingsstatistik</h4>
                      <div className="text-sm text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <strong>Totalt:</strong> {cooperativeSwitcher.getSwitchMetrics()?.totalSwitches || 0}
                        </div>
                        <div>
                          <strong>Användare:</strong> {cooperativeSwitcher.getSwitchMetrics()?.userInitiatedSwitches || 0}
                        </div>
                        <div>
                          <strong>Senaste:</strong> {cooperativeSwitcher.getSwitchMetrics()?.lastSwitchTime 
                            ? new Date(cooperativeSwitcher.getSwitchMetrics()!.lastSwitchTime!).toLocaleString('sv-SE')
                            : 'Aldrig'}
                        </div>
                        <div>
                          <strong>Resultat:</strong> {cooperativeSwitcher.lastResult?.success ? '✅' : '❌'}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        );
    }
  };

  return (
    <div className={cn("cooperative-switcher-wrapper", className)}>
      {/* Data Isolation Warning */}
      {showTestingAlert && (
        <Alert className="mb-4 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong className="text-orange-800">Testläge aktivt:</strong>
              <span className="text-orange-700 ml-2">
                Data från olika föreningar kan nu visas. Se till att testa dataisolering ordentligt.
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissTestingAlert}
              className="ml-4 h-6 w-6 p-0 text-orange-600 hover:bg-orange-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Display */}
      {cooperativeSwitcher.error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex items-center justify-between">
            <div>
              <strong className="text-red-800">Fel uppstod:</strong>
              <span className="text-red-700 ml-2">{cooperativeSwitcher.error}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={cooperativeSwitcher.clearError}
              className="ml-4 h-6 w-6 p-0 text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Success Message */}
      {cooperativeSwitcher.lastResult?.success && cooperativeSwitcher.lastResult.cooperative && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong className="text-green-800">Växling lyckades:</strong>
            <span className="text-green-700 ml-2">
              Nu visar systemet data för {cooperativeSwitcher.lastResult.cooperative.name}
            </span>
          </AlertDescription>
        </Alert>
      )}

      {/* Cooperative Controls */}
      {renderCooperativeControls()}

      {/* Main Content */}
      <div className="cooperative-content">
        {children}
      </div>
    </div>
  );
}

export default CooperativeSwitcherWrapper;