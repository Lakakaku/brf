'use client';

/**
 * Cooperative Context Indicator
 * Visual indicator showing current cooperative context and data isolation status
 */

import * as React from 'react';
import { 
  Building2, 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle,
  Info,
  Settings,
  Loader2,
  Eye,
  EyeOff,
  Clock,
  Users
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCooperative } from '@/lib/contexts/cooperative-context';
import { cn } from '@/lib/utils';
import { CooperativeSelector } from './cooperative-selector';

export interface CooperativeIndicatorProps {
  variant?: 'header' | 'sidebar' | 'compact' | 'full';
  showSelector?: boolean;
  showIsolationStatus?: boolean;
  showTestingMode?: boolean;
  showSwitchHistory?: boolean;
  className?: string;
}

export function CooperativeIndicator({
  variant = 'compact',
  showSelector = true,
  showIsolationStatus = true,
  showTestingMode = true,
  showSwitchHistory = false,
  className,
}: CooperativeIndicatorProps) {
  const cooperative = useCooperative();
  
  const getIsolationStatusIcon = () => {
    if (cooperative.isTestingMode) {
      return <ShieldAlert className="h-4 w-4 text-orange-600" />;
    }
    if (cooperative.currentCooperative?.isTestData) {
      return <ShieldCheck className="h-4 w-4 text-blue-600" />;
    }
    return <Shield className="h-4 w-4 text-green-600" />;
  };

  const getIsolationStatusText = () => {
    if (cooperative.isTestingMode) {
      return 'Testläge aktivt';
    }
    if (cooperative.currentCooperative?.isTestData) {
      return 'Testdata';
    }
    return 'Data isolerat';
  };

  const getIsolationStatusColor = () => {
    if (cooperative.isTestingMode) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    if (cooperative.currentCooperative?.isTestData) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    return 'bg-green-100 text-green-800 border-green-200';
  };

  const formatLastSwitchTime = () => {
    if (!cooperative.lastSwitched) return null;
    
    const now = new Date();
    const diff = now.getTime() - cooperative.lastSwitched.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'just nu';
    if (minutes < 60) return `${minutes} min sedan`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} tim sedan`;
    
    const days = Math.floor(hours / 24);
    return `${days} dagar sedan`;
  };

  if (variant === 'header') {
    return (
      <TooltipProvider>
        <div className={cn("flex items-center gap-3", className)}>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            {cooperative.isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Laddar...</span>
              </div>
            ) : cooperative.currentCooperative ? (
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {cooperative.currentCooperative.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {cooperative.currentCooperative.city}
                </span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">
                Ingen förening vald
              </span>
            )}
          </div>

          {showIsolationStatus && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge className={cn("text-xs", getIsolationStatusColor())}>
                  <div className="flex items-center gap-1">
                    {getIsolationStatusIcon()}
                    {getIsolationStatusText()}
                  </div>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Data för aktuell förening är isolerad från andra föreningar</p>
              </TooltipContent>
            </Tooltip>
          )}

          {showTestingMode && cooperative.isTestingMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Testläge
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Testläge är aktivt - du kan växla mellan alla föreningar</p>
              </TooltipContent>
            </Tooltip>
          )}

          {showSelector && cooperative.availableCooperatives.length > 1 && (
            <CooperativeSelector
              cooperatives={cooperative.availableCooperatives}
              currentCooperative={cooperative.currentCooperative}
              onCooperativeChange={cooperative.switchCooperative}
              isLoading={cooperative.isSwitching}
              className="ml-2"
            />
          )}
        </div>
      </TooltipProvider>
    );
  }

  if (variant === 'sidebar') {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4" />
            Aktuell förening
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cooperative.isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Laddar förening...</span>
            </div>
          ) : cooperative.currentCooperative ? (
            <div className="space-y-2">
              <div>
                <h3 className="font-medium text-sm">
                  {cooperative.currentCooperative.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {cooperative.currentCooperative.orgNumber}
                </p>
                {cooperative.currentCooperative.city && (
                  <p className="text-xs text-muted-foreground">
                    {cooperative.currentCooperative.city}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-1">
                <Badge className={cn(
                  "text-xs",
                  cooperative.currentCooperative.subscriptionStatus === 'active' 
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : cooperative.currentCooperative.subscriptionStatus === 'trial'
                    ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                )}>
                  {cooperative.currentCooperative.subscriptionStatus === 'active' ? 'Aktiv' : 
                   cooperative.currentCooperative.subscriptionStatus === 'trial' ? 'Provperiod' : 'Inaktiv'}
                </Badge>
                
                {cooperative.currentCooperative.isTestData && (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                    Testdata
                  </Badge>
                )}
              </div>

              {showIsolationStatus && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {getIsolationStatusIcon()}
                  {getIsolationStatusText()}
                </div>
              )}

              {cooperative.lastSwitched && formatLastSwitchTime() && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Växlad {formatLastSwitchTime()}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Ingen förening vald
            </div>
          )}

          {showSelector && cooperative.availableCooperatives.length > 1 && (
            <>
              <Separator />
              <CooperativeSelector
                cooperatives={cooperative.availableCooperatives}
                currentCooperative={cooperative.currentCooperative}
                onCooperativeChange={cooperative.switchCooperative}
                isLoading={cooperative.isSwitching}
                showDetails={false}
              />
            </>
          )}

          {showTestingMode && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Testläge</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => 
                      cooperative.isTestingMode 
                        ? cooperative.disableTestingMode() 
                        : cooperative.enableTestingMode()
                    }
                    className="h-6 px-2"
                  >
                    {cooperative.isTestingMode ? (
                      <EyeOff className="h-3 w-3" />
                    ) : (
                      <Eye className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {cooperative.isTestingMode && (
                  <div className="text-xs text-orange-700 bg-orange-50 p-2 rounded">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Testläge aktivt - alla föreningar tillgängliga
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'full') {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Föreningsinformation och Testning
          </CardTitle>
          <CardDescription>
            Aktuell föreningskontext och dataisoleringsverktyg
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {cooperative.currentCooperative && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="font-medium">Föreningsinformation</h3>
                <div className="space-y-1 text-sm">
                  <div><strong>Namn:</strong> {cooperative.currentCooperative.name}</div>
                  <div><strong>Org.nr:</strong> {cooperative.currentCooperative.orgNumber}</div>
                  <div><strong>Stad:</strong> {cooperative.currentCooperative.city || 'Okänd'}</div>
                  {cooperative.currentCooperative.totalApartments && (
                    <div><strong>Lägenheter:</strong> {cooperative.currentCooperative.totalApartments}</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium">Status</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn(
                    "text-xs",
                    cooperative.currentCooperative.subscriptionStatus === 'active' 
                      ? 'bg-green-100 text-green-800 border-green-200'
                      : cooperative.currentCooperative.subscriptionStatus === 'trial'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                      : 'bg-gray-100 text-gray-800 border-gray-200'
                  )}>
                    {cooperative.currentCooperative.subscriptionStatus === 'active' ? 'Aktiv prenumeration' : 
                     cooperative.currentCooperative.subscriptionStatus === 'trial' ? 'Provperiod' : 'Inaktiv'}
                  </Badge>
                  
                  <Badge className={cn("text-xs", getIsolationStatusColor())}>
                    <div className="flex items-center gap-1">
                      {getIsolationStatusIcon()}
                      {getIsolationStatusText()}
                    </div>
                  </Badge>
                  
                  {cooperative.currentCooperative.isTestData && (
                    <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                      Testdata
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}

          {showSelector && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-medium">Växla förening</h3>
                <CooperativeSelector
                  cooperatives={cooperative.availableCooperatives}
                  currentCooperative={cooperative.currentCooperative}
                  onCooperativeChange={cooperative.switchCooperative}
                  isLoading={cooperative.isSwitching}
                  showDetails={true}
                />
              </div>
            </>
          )}

          {showSwitchHistory && cooperative.switchHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="font-medium">Senaste växlingar</h3>
                <div className="space-y-1">
                  {cooperative.switchHistory.slice(-5).map((entry, index) => (
                    <div key={index} className="text-xs text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span>{entry.timestamp.toLocaleString('sv-SE')}</span>
                      <span>→</span>
                      <span>{entry.toCooperativeId}</span>
                      <Badge variant="outline" className="text-xs">
                        {entry.reason}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {cooperative.error && (
            <>
              <Separator />
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">Fel uppstod</span>
                </div>
                <p className="text-red-700 text-sm mt-1">{cooperative.error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={cooperative.clearError}
                  className="mt-2"
                >
                  Stäng felmeddelande
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // Compact variant (default)
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {cooperative.currentCooperative ? (
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {cooperative.currentCooperative.name}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Ingen förening
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            {cooperative.currentCooperative ? (
              <div className="space-y-1">
                <p className="font-medium">{cooperative.currentCooperative.name}</p>
                <p className="text-xs">{cooperative.currentCooperative.orgNumber}</p>
                <p className="text-xs">{cooperative.currentCooperative.city}</p>
              </div>
            ) : (
              <p>Ingen förening vald</p>
            )}
          </TooltipContent>
        </Tooltip>

        {showIsolationStatus && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help">
                {getIsolationStatusIcon()}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getIsolationStatusText()}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {cooperative.isTestingMode && showTestingMode && (
          <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
            Test
          </Badge>
        )}

        {cooperative.isSwitching && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
    </TooltipProvider>
  );
}

export default CooperativeIndicator;