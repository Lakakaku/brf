/**
 * Cooperative Switcher Usage Examples
 * Complete examples showing how to integrate the cooperative switching system
 */

import React from 'react';
import { 
  CooperativeSwitcherWrapper,
  CooperativeSelector,
  CooperativeIndicator 
} from '@/components';
import { useCooperativeSwitcher } from '@/hooks/useCooperativeSwitcher';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Example 1: Full Page with Cooperative Switcher
export function FullPageExample() {
  return (
    <CooperativeSwitcherWrapper 
      variant="full"
      enableTestingMode={process.env.NODE_ENV === 'development'}
      showTestingWarning={true}
      showIsolationIndicator={true}
    >
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">BRF Portal Dashboard</h1>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Medlemmar</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">45</p>
              <p className="text-muted-foreground">aktiva medlemmar</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Ärenden</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">12</p>
              <p className="text-muted-foreground">öppna ärenden</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Fakturor</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">3</p>
              <p className="text-muted-foreground">väntande betalning</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </CooperativeSwitcherWrapper>
  );
}

// Example 2: Header Integration
export function HeaderWithCooperativeIndicator() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold">BRF Portal</h1>
        </div>
        
        <CooperativeIndicator
          variant="header"
          showSelector={true}
          showIsolationStatus={true}
          showTestingMode={true}
        />
        
        <div className="flex items-center gap-2">
          <Button variant="ghost">Inställningar</Button>
          <Button variant="ghost">Logga ut</Button>
        </div>
      </div>
    </header>
  );
}

// Example 3: Sidebar Integration
export function SidebarWithCooperativeInfo() {
  return (
    <aside className="w-80 border-r bg-muted/40 p-6">
      <CooperativeIndicator
        variant="sidebar"
        showSelector={true}
        showIsolationStatus={true}
        showTestingMode={true}
        showSwitchHistory={true}
        className="mb-6"
      />
      
      <nav className="space-y-2">
        <a href="#" className="block rounded-lg px-3 py-2 hover:bg-accent">
          Dashboard
        </a>
        <a href="#" className="block rounded-lg px-3 py-2 hover:bg-accent">
          Medlemmar
        </a>
        <a href="#" className="block rounded-lg px-3 py-2 hover:bg-accent">
          Ärenden
        </a>
        <a href="#" className="block rounded-lg px-3 py-2 hover:bg-accent">
          Fakturor
        </a>
      </nav>
    </aside>
  );
}

// Example 4: Custom Hook Usage
export function CustomHookExample() {
  const cooperativeSwitcher = useCooperativeSwitcher({
    autoLoadCooperatives: true,
    enableBatchSwitching: true,
    showToasts: true,
  });

  const handleQuickSwitch = async () => {
    await cooperativeSwitcher.switchToNext();
  };

  const handleSwitchByName = async () => {
    await cooperativeSwitcher.switchByIdentifier('Testförening');
  };

  const handleBatchSwitch = async () => {
    if (!cooperativeSwitcher.isBatchEnabled) return;
    
    const availableCoops = cooperativeSwitcher.availableCooperatives.slice(0, 3);
    const result = await cooperativeSwitcher.batchSwitch(availableCoops, {
      delayBetweenSwitches: 2000,
      stopOnError: false,
    });
    
    console.log('Batch switch result:', result);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Testverktyg för Föreningsväxling</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-2">
          <Button 
            onClick={handleQuickSwitch}
            disabled={cooperativeSwitcher.isSwitching || !cooperativeSwitcher.canSwitchNext}
          >
            Växla till nästa förening
          </Button>
          
          <Button 
            onClick={handleSwitchByName}
            disabled={cooperativeSwitcher.isSwitching}
            variant="outline"
          >
            Växla till Testförening
          </Button>
        </div>

        {cooperativeSwitcher.isBatchEnabled && (
          <Button 
            onClick={handleBatchSwitch}
            disabled={cooperativeSwitcher.isSwitching}
            variant="secondary"
            className="w-full"
          >
            Testa batch-växling (3 föreningar)
          </Button>
        )}

        {cooperativeSwitcher.batchProgress.total > 0 && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <strong>Batch-växling pågår:</strong> {cooperativeSwitcher.batchProgress.completed} / {cooperativeSwitcher.batchProgress.total}
            </div>
            {cooperativeSwitcher.batchProgress.current && (
              <div className="text-xs text-muted-foreground mt-1">
                Aktuell: {cooperativeSwitcher.batchProgress.current.name}
              </div>
            )}
          </div>
        )}

        {cooperativeSwitcher.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-sm text-red-800">{cooperativeSwitcher.error}</div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={cooperativeSwitcher.clearError}
              className="mt-2"
            >
              Stäng
            </Button>
          </div>
        )}

        <div className="mt-6 pt-4 border-t">
          <h4 className="font-medium mb-2">Nuvarande status:</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <div>Förening: {cooperativeSwitcher.currentCooperative?.name || 'Ingen vald'}</div>
            <div>Testläge: {cooperativeSwitcher.isTestingMode ? '✅ Aktivt' : '❌ Inaktivt'}</div>
            <div>Tillgängliga: {cooperativeSwitcher.availableCooperatives.length} föreningar</div>
            <div>Växlar: {cooperativeSwitcher.isSwitching ? '⏳ Pågår' : '✅ Klar'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Example 5: Testing Mode Integration
export function TestingModeExample() {
  const cooperativeSwitcher = useCooperativeSwitcher();

  const runIsolationTest = async () => {
    if (!cooperativeSwitcher.currentCooperative) return;

    try {
      const response = await fetch('/api/cooperatives/isolation-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cooperativeIds: [cooperativeSwitcher.currentCooperative.id],
          testOptions: {
            includePerformanceTests: true,
            includeDataIntegrityTests: true,
            includeCrossCooperativeTests: false,
            testDepth: 'comprehensive',
          },
          generateReport: true,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('Isolation test passed:', result.data.testSuite.summary.overallPassed);
        console.log('Test report:', result.data.report);
      } else {
        console.error('Isolation test failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to run isolation test:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dataisolering och Testning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Testläge</span>
          <Button
            size="sm"
            variant={cooperativeSwitcher.isTestingMode ? "default" : "outline"}
            onClick={() => 
              cooperativeSwitcher.isTestingMode 
                ? cooperativeSwitcher.disableTestingMode()
                : cooperativeSwitcher.enableTestingMode()
            }
          >
            {cooperativeSwitcher.isTestingMode ? 'Inaktivera' : 'Aktivera'}
          </Button>
        </div>

        {cooperativeSwitcher.isTestingMode && (
          <div className="space-y-2">
            <Button 
              onClick={runIsolationTest}
              disabled={!cooperativeSwitcher.currentCooperative}
              className="w-full"
            >
              Kör isoleringstest
            </Button>
            
            <div className="text-xs text-muted-foreground p-2 bg-orange-50 rounded">
              <strong>⚠️ Testläge aktivt:</strong> Du kan nu växla mellan alla föreningar. 
              Data från olika föreningar kan visas samtidigt. Se till att testa dataisolering ordentligt.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Example 6: Minimal Compact Usage
export function CompactExample() {
  return (
    <div className="flex items-center justify-between p-4 border-b">
      <h2 className="text-lg font-semibold">Sidotitel</h2>
      
      <CooperativeIndicator
        variant="compact"
        showSelector={false}
        showIsolationStatus={true}
        showTestingMode={false}
      />
    </div>
  );
}

export default {
  FullPageExample,
  HeaderWithCooperativeIndicator,
  SidebarWithCooperativeInfo,
  CustomHookExample,
  TestingModeExample,
  CompactExample,
};