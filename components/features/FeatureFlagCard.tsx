/**
 * Feature Flag Card Component
 * Displays a single feature flag with toggle and management options
 */

'use client';

import React, { useState } from 'react';
import { FeatureFlag, FeatureCategory } from '@/lib/features/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Copy, 
  Clock, 
  Users, 
  Target,
  AlertTriangle,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureFlagCardProps {
  flag: FeatureFlag;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onEdit: (flag: FeatureFlag) => void;
  onDelete: (id: string) => Promise<void>;
  onDuplicate: (flag: FeatureFlag) => void;
  isLoading?: boolean;
}

const categoryColors: Record<FeatureCategory, string> = {
  general: 'bg-gray-100 text-gray-800',
  auth: 'bg-red-100 text-red-800',
  payments: 'bg-green-100 text-green-800',
  documents: 'bg-blue-100 text-blue-800',
  bookings: 'bg-purple-100 text-purple-800',
  admin: 'bg-orange-100 text-orange-800',
  ui: 'bg-pink-100 text-pink-800',
  api: 'bg-indigo-100 text-indigo-800',
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-800',
  active: 'bg-green-100 text-green-800',
  archived: 'bg-yellow-100 text-yellow-800',
  deprecated: 'bg-red-100 text-red-800',
};

export default function FeatureFlagCard({
  flag,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  isLoading = false,
}: FeatureFlagCardProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsToggling(true);
    try {
      await onToggle(flag.id, checked);
    } finally {
      setIsToggling(false);
    }
  };

  const isExpired = flag.expires_at && new Date(flag.expires_at) < new Date();
  const hasConflicts = flag.conflicts.length > 0;
  const isGlobal = flag.cooperative_id === null;

  return (
    <Card className={cn(
      'transition-all duration-200 hover:shadow-md',
      flag.status === 'deprecated' && 'opacity-60',
      isExpired && 'border-red-200 bg-red-50'
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-semibold">{flag.name}</CardTitle>
              {isGlobal && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Globe className="h-4 w-4 text-blue-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Global flagga (gäller alla BRF:er)</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                {flag.key}
              </code>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={flag.is_enabled && !isExpired}
              onCheckedChange={handleToggle}
              disabled={isToggling || isLoading || flag.status !== 'active' || isExpired}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(flag)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Redigera
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(flag)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicera
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => onDelete(flag.id)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Ta bort
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {flag.description && (
          <CardDescription className="text-sm">
            {flag.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge className={categoryColors[flag.category]}>
            {flag.category}
          </Badge>
          <Badge className={statusColors[flag.status]}>
            {flag.status}
          </Badge>
          {flag.environment !== 'all' && (
            <Badge variant="outline">
              {flag.environment}
            </Badge>
          )}
          {flag.rollout_percentage < 100 && (
            <Badge variant="outline">
              {flag.rollout_percentage}% utrullning
            </Badge>
          )}
        </div>

        {/* Targeting Information */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-gray-500" />
            <span className="text-gray-600">
              Målgrupp: {flag.target_type === 'all' ? 'Alla användare' : 
                        flag.target_type === 'percentage' ? 'Procentuell fördelning' :
                        flag.target_type === 'users' ? 'Specifika användare' :
                        flag.target_type === 'roles' ? 'Användarroller' : 
                        flag.target_type === 'apartments' ? 'Specifika lägenheter' : flag.target_type}
            </span>
          </div>

          {flag.expires_at && (
            <div className="flex items-center gap-2">
              <Clock className={cn(
                "h-4 w-4",
                isExpired ? "text-red-500" : "text-gray-500"
              )} />
              <span className={cn(
                "text-gray-600",
                isExpired && "text-red-600 font-medium"
              )}>
                {isExpired ? 'Utgången' : 'Utgår'}: {new Date(flag.expires_at).toLocaleDateString('sv-SE')}
              </span>
            </div>
          )}

          {flag.dependencies.length > 0 && (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <span className="text-gray-600">
                Beroenden: {flag.dependencies.length} st
              </span>
            </div>
          )}

          {hasConflicts && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-amber-600">
                Konflikter: {flag.conflicts.length} st
              </span>
            </div>
          )}
        </div>

        {/* Tags */}
        {flag.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {flag.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-0 text-xs text-gray-500">
        <div className="flex justify-between w-full">
          <span>
            Skapad: {new Date(flag.created_at).toLocaleDateString('sv-SE')}
          </span>
          <span>
            Uppdaterad: {new Date(flag.updated_at).toLocaleDateString('sv-SE')}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}