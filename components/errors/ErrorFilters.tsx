'use client';

import React from 'react';
import { Search, Filter, X, Calendar, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

/**
 * Error Filters Component
 * Swedish localized filtering interface for BRF error logs
 */

export interface ErrorFilterOptions {
  searchQuery: string;
  errorLevel: string;
  errorCategory: string;
  brfContext: string;
  status: string;
  priority: string;
  timeRange: string;
  affectsMembers: string;
  affectsOperations: string;
}

interface ErrorFiltersProps {
  filters: ErrorFilterOptions;
  onFiltersChange: (filters: ErrorFilterOptions) => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  isLoading?: boolean;
  resultCount?: number;
}

// Swedish translations for filters
const filterTranslations = {
  search: 'Sök i felloggar...',
  filters: 'Filter',
  advancedFilters: 'Avancerade filter',
  clearFilters: 'Rensa filter',
  refresh: 'Uppdatera',
  results: (count: number) => `${count} resultat`,
  
  // Filter categories
  allLevels: 'Alla nivåer',
  allCategories: 'Alla kategorier',
  allContexts: 'Alla sammanhang',
  allStatus: 'Alla status',
  allPriorities: 'Alla prioriteter',
  allTimeRanges: 'Alla tidsperioder',
  allImpacts: 'Alla påverkan',
  
  // Error levels
  debug: 'Felsökning',
  info: 'Information',
  warning: 'Varning',
  error: 'Fel',
  critical: 'Kritisk',
  fatal: 'Fatal',
  
  // Categories
  auth: 'Autentisering',
  validation: 'Validering',
  database: 'Databas',
  network: 'Nätverk',
  payment: 'Betalning',
  document: 'Dokument',
  booking: 'Bokning',
  member_management: 'Medlemshantering',
  invoice: 'Faktura',
  case_management: 'Ärendehantering',
  energy: 'Energi',
  contractor: 'Entreprenör',
  board_meeting: 'Styrelsemöte',
  queue: 'Kö',
  loan: 'Lån',
  system: 'System',
  external_api: 'Extern API',
  performance: 'Prestanda',
  security: 'Säkerhet',
  
  // BRF Context
  monthly_fees: 'Månadsavgifter',
  annual_report: 'Årsredovisning',
  energy_declaration: 'Energideklaration',
  board_election: 'Styrelsevalg',
  maintenance_case: 'Underhållsärende',
  contractor_evaluation: 'Entreprenörsbedömning',
  booking_system: 'Bokningssystem',
  member_registration: 'Medlemsregistrering',
  payment_processing: 'Betalningshantering',
  document_approval: 'Dokumentgodkännande',
  meeting_protocol: 'Mötesprotokoll',
  queue_management: 'Köhantering',
  loan_tracking: 'Lånuppföljning',
  audit_trail: 'Revisionsspår',
  tax_reporting: 'Skaterapportering',
  insurance_claim: 'Försäkringsanspråk',
  renovation_project: 'Renoveringsprojekt',
  utility_billing: 'Mediafakturering',
  
  // Status
  resolved: 'Löst',
  unresolved: 'Olöst',
  
  // Priority
  low: 'Låg',
  medium: 'Medium',
  high: 'Hög',
  urgent: 'Brådskande',
  
  // Time ranges
  last_hour: 'Senaste timmen',
  last_24h: 'Senaste 24 timmarna',
  last_week: 'Senaste veckan',
  last_month: 'Senaste månaden',
  last_3months: 'Senaste 3 månaderna',
  
  // Impact
  yes: 'Ja',
  no: 'Nej',
  
  // Labels
  errorLevel: 'Felnivå',
  category: 'Kategori',
  brfContext: 'BRF-sammanhang',
  status: 'Status',
  priority: 'Prioritet',
  timeRange: 'Tidsperiod',
  affectsMembers: 'Påverkar medlemmar',
  affectsOperations: 'Påverkar verksamhet'
};

export default function ErrorFilters({
  filters,
  onFiltersChange,
  showAdvanced,
  onToggleAdvanced,
  onClearFilters,
  onRefresh,
  isLoading = false,
  resultCount
}: ErrorFiltersProps) {
  
  const updateFilter = (key: keyof ErrorFilterOptions, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value
    });
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => 
    key !== 'searchQuery' && value !== 'all' && value !== ''
  ) || filters.searchQuery.length > 0;

  const getActiveFilterCount = () => {
    let count = 0;
    if (filters.searchQuery.length > 0) count++;
    Object.entries(filters).forEach(([key, value]) => {
      if (key !== 'searchQuery' && value !== 'all' && value !== '') count++;
    });
    return count;
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        {/* Main search bar */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={filterTranslations.search}
              value={filters.searchQuery}
              onChange={(e) => updateFilter('searchQuery', e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onToggleAdvanced}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showAdvanced ? filterTranslations.advancedFilters : filterTranslations.filters}
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1">
                  {getActiveFilterCount()}
                </Badge>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={onRefresh}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              {filterTranslations.refresh}
            </Button>
          </div>
        </div>

        {/* Results count */}
        {resultCount !== undefined && (
          <div className="text-sm text-gray-600">
            {filterTranslations.results(resultCount)}
          </div>
        )}

        {/* Basic filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            value={filters.errorLevel}
            onValueChange={(value) => updateFilter('errorLevel', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={filterTranslations.errorLevel} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filterTranslations.allLevels}</SelectItem>
              <SelectItem value="fatal">{filterTranslations.fatal}</SelectItem>
              <SelectItem value="critical">{filterTranslations.critical}</SelectItem>
              <SelectItem value="error">{filterTranslations.error}</SelectItem>
              <SelectItem value="warning">{filterTranslations.warning}</SelectItem>
              <SelectItem value="info">{filterTranslations.info}</SelectItem>
              <SelectItem value="debug">{filterTranslations.debug}</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={filters.errorCategory}
            onValueChange={(value) => updateFilter('errorCategory', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={filterTranslations.category} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filterTranslations.allCategories}</SelectItem>
              <SelectItem value="auth">{filterTranslations.auth}</SelectItem>
              <SelectItem value="payment">{filterTranslations.payment}</SelectItem>
              <SelectItem value="document">{filterTranslations.document}</SelectItem>
              <SelectItem value="booking">{filterTranslations.booking}</SelectItem>
              <SelectItem value="member_management">{filterTranslations.member_management}</SelectItem>
              <SelectItem value="invoice">{filterTranslations.invoice}</SelectItem>
              <SelectItem value="case_management">{filterTranslations.case_management}</SelectItem>
              <SelectItem value="database">{filterTranslations.database}</SelectItem>
              <SelectItem value="network">{filterTranslations.network}</SelectItem>
              <SelectItem value="system">{filterTranslations.system}</SelectItem>
            </SelectContent>
          </Select>
          
          <Select
            value={filters.status}
            onValueChange={(value) => updateFilter('status', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={filterTranslations.status} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{filterTranslations.allStatus}</SelectItem>
              <SelectItem value="resolved">{filterTranslations.resolved}</SelectItem>
              <SelectItem value="unresolved">{filterTranslations.unresolved}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="pt-4 border-t space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select
                value={filters.brfContext}
                onValueChange={(value) => updateFilter('brfContext', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterTranslations.brfContext} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{filterTranslations.allContexts}</SelectItem>
                  <SelectItem value="monthly_fees">{filterTranslations.monthly_fees}</SelectItem>
                  <SelectItem value="payment_processing">{filterTranslations.payment_processing}</SelectItem>
                  <SelectItem value="document_approval">{filterTranslations.document_approval}</SelectItem>
                  <SelectItem value="member_registration">{filterTranslations.member_registration}</SelectItem>
                  <SelectItem value="booking_system">{filterTranslations.booking_system}</SelectItem>
                  <SelectItem value="case_management">{filterTranslations.case_management}</SelectItem>
                  <SelectItem value="energy_declaration">{filterTranslations.energy_declaration}</SelectItem>
                  <SelectItem value="contractor_evaluation">{filterTranslations.contractor_evaluation}</SelectItem>
                  <SelectItem value="meeting_protocol">{filterTranslations.meeting_protocol}</SelectItem>
                  <SelectItem value="queue_management">{filterTranslations.queue_management}</SelectItem>
                  <SelectItem value="loan_tracking">{filterTranslations.loan_tracking}</SelectItem>
                  <SelectItem value="audit_trail">{filterTranslations.audit_trail}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.priority}
                onValueChange={(value) => updateFilter('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterTranslations.priority} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{filterTranslations.allPriorities}</SelectItem>
                  <SelectItem value="urgent">{filterTranslations.urgent}</SelectItem>
                  <SelectItem value="high">{filterTranslations.high}</SelectItem>
                  <SelectItem value="medium">{filterTranslations.medium}</SelectItem>
                  <SelectItem value="low">{filterTranslations.low}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.timeRange}
                onValueChange={(value) => updateFilter('timeRange', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterTranslations.timeRange} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{filterTranslations.allTimeRanges}</SelectItem>
                  <SelectItem value="last_hour">{filterTranslations.last_hour}</SelectItem>
                  <SelectItem value="last_24h">{filterTranslations.last_24h}</SelectItem>
                  <SelectItem value="last_week">{filterTranslations.last_week}</SelectItem>
                  <SelectItem value="last_month">{filterTranslations.last_month}</SelectItem>
                  <SelectItem value="last_3months">{filterTranslations.last_3months}</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={filters.affectsMembers}
                onValueChange={(value) => updateFilter('affectsMembers', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterTranslations.affectsMembers} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{filterTranslations.allImpacts}</SelectItem>
                  <SelectItem value="yes">{filterTranslations.yes}</SelectItem>
                  <SelectItem value="no">{filterTranslations.no}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                value={filters.affectsOperations}
                onValueChange={(value) => updateFilter('affectsOperations', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filterTranslations.affectsOperations} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{filterTranslations.allImpacts}</SelectItem>
                  <SelectItem value="yes">{filterTranslations.yes}</SelectItem>
                  <SelectItem value="no">{filterTranslations.no}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Active filters display */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex flex-wrap gap-2">
              {filters.searchQuery && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Sökning: "{filters.searchQuery}"
                  <X 
                    className="w-3 h-3 cursor-pointer hover:text-red-500"
                    onClick={() => updateFilter('searchQuery', '')}
                  />
                </Badge>
              )}
              
              {Object.entries(filters).map(([key, value]) => {
                if (key === 'searchQuery' || value === 'all' || value === '') return null;
                
                const label = filterTranslations[key as keyof typeof filterTranslations];
                const valueLabel = filterTranslations[value as keyof typeof filterTranslations] || value;
                
                return (
                  <Badge key={key} variant="secondary" className="flex items-center gap-1">
                    {label}: {valueLabel}
                    <X 
                      className="w-3 h-3 cursor-pointer hover:text-red-500"
                      onClick={() => updateFilter(key as keyof ErrorFilterOptions, 'all')}
                    />
                  </Badge>
                );
              })}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <X className="w-4 h-4" />
              {filterTranslations.clearFilters}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}