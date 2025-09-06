'use client';

/**
 * Cooperative Selector Component for Multi-tenant Testing
 * Allows users to switch between different cooperatives for testing data isolation
 */

import * as React from 'react';
import { Building2, CheckCircle2, AlertCircle, Loader2, Users } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface Cooperative {
  id: string;
  name: string;
  orgNumber: string;
  subdomain: string;
  city?: string;
  totalApartments?: number;
  subscriptionTier: 'standard' | 'premium' | 'enterprise';
  subscriptionStatus: 'active' | 'trial' | 'inactive';
  isTestData?: boolean;
}

interface CooperativeSelectorProps {
  cooperatives: Cooperative[];
  currentCooperative: Cooperative | null;
  onCooperativeChange: (cooperative: Cooperative) => void;
  isLoading?: boolean;
  disabled?: boolean;
  showDetails?: boolean;
  className?: string;
}

export function CooperativeSelector({
  cooperatives,
  currentCooperative,
  onCooperativeChange,
  isLoading = false,
  disabled = false,
  showDetails = false,
  className,
}: CooperativeSelectorProps) {
  const handleValueChange = (cooperativeId: string) => {
    const selected = cooperatives.find(coop => coop.id === cooperativeId);
    if (selected && selected.id !== currentCooperative?.id) {
      onCooperativeChange(selected);
    }
  };

  const getSubscriptionColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'trial':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'premium':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'standard':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (showDetails && currentCooperative) {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Aktuell Bostadsrättsförening
          </CardTitle>
          <CardDescription>
            Växla mellan olika föreningar för att testa dataisolering
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{currentCooperative.name}</h3>
                {currentCooperative.isTestData && (
                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                    Testdata
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Org.nr: {currentCooperative.orgNumber}
              </p>
              {currentCooperative.city && (
                <p className="text-sm text-muted-foreground">
                  {currentCooperative.city}
                </p>
              )}
            </div>
            <div className="text-right space-y-2">
              <div className="flex gap-2">
                <Badge className={cn("text-xs", getSubscriptionColor(currentCooperative.subscriptionStatus))}>
                  {currentCooperative.subscriptionStatus === 'active' ? 'Aktiv' : 
                   currentCooperative.subscriptionStatus === 'trial' ? 'Provperiod' : 'Inaktiv'}
                </Badge>
                <Badge className={cn("text-xs", getTierColor(currentCooperative.subscriptionTier))}>
                  {currentCooperative.subscriptionTier === 'enterprise' ? 'Företag' :
                   currentCooperative.subscriptionTier === 'premium' ? 'Premium' : 'Standard'}
                </Badge>
              </div>
              {currentCooperative.totalApartments && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  {currentCooperative.totalApartments} lägenheter
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t">
            <Select
              value={currentCooperative.id}
              onValueChange={handleValueChange}
              disabled={disabled || isLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Välj bostadsrättsförening..." />
              </SelectTrigger>
              <SelectContent>
                {cooperatives.map((cooperative) => (
                  <SelectItem key={cooperative.id} value={cooperative.id}>
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{cooperative.name}</span>
                          {cooperative.isTestData && (
                            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                              Test
                            </Badge>
                          )}
                          {cooperative.id === currentCooperative?.id && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {cooperative.orgNumber} • {cooperative.city || 'Okänd stad'}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Växlar förening...
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Compact version
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Förening:
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Aktuell bostadsrättsförening för testning</p>
          </TooltipContent>
        </Tooltip>

        <Select
          value={currentCooperative?.id || ''}
          onValueChange={handleValueChange}
          disabled={disabled || isLoading}
        >
          <SelectTrigger className="w-[250px]">
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Laddar...</span>
              </div>
            ) : (
              <SelectValue placeholder="Välj förening...">
                {currentCooperative && (
                  <div className="flex items-center gap-2">
                    <span className="truncate">{currentCooperative.name}</span>
                    {currentCooperative.isTestData && (
                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200">
                        Test
                      </Badge>
                    )}
                  </div>
                )}
              </SelectValue>
            )}
          </SelectTrigger>
          <SelectContent>
            {cooperatives.map((cooperative) => (
              <SelectItem key={cooperative.id} value={cooperative.id}>
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{cooperative.name}</span>
                      {cooperative.isTestData && (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 shrink-0">
                          Test
                        </Badge>
                      )}
                      {cooperative.id === currentCooperative?.id && (
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{cooperative.orgNumber}</span>
                      <span>•</span>
                      <span>{cooperative.city || 'Okänd stad'}</span>
                      {cooperative.totalApartments && (
                        <>
                          <span>•</span>
                          <span>{cooperative.totalApartments} lgh</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 ml-2 shrink-0">
                    <Badge className={cn("text-xs", getSubscriptionColor(cooperative.subscriptionStatus))}>
                      {cooperative.subscriptionStatus === 'active' ? 'Aktiv' : 
                       cooperative.subscriptionStatus === 'trial' ? 'Prov' : 'Inaktiv'}
                    </Badge>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {currentCooperative && (
          <div className="flex items-center gap-1">
            {currentCooperative.subscriptionStatus === 'active' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : currentCooperative.subscriptionStatus === 'trial' ? (
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

export default CooperativeSelector;