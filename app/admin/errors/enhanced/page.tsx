'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Download, Trash2, Clock, TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import ErrorFilters, { ErrorFilterOptions } from '@/components/errors/ErrorFilters';
import ErrorDetailDialog, { ErrorLogDetail } from '@/components/errors/ErrorDetailDialog';

/**
 * Enhanced Error Management Page for BRF Portal
 * Comprehensive error logging and management system with Swedish localization
 */

interface ErrorMetrics {
  totalErrors: number;
  uniqueErrors: number;
  criticalErrors: number;
  resolvedErrors: number;
  errorRate: number;
  avgResolutionTime: number;
  categoryBreakdown: Record<string, number>;
  brfContextBreakdown: Record<string, number>;
  trendsLast24h: {
    errorCount: number;
    trend: 'up' | 'down' | 'stable';
    changePercent: number;
  };
  topErrorPatterns: {
    pattern: string;
    count: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }[];
}

interface ErrorSummary {
  id: number;
  errorId: string;
  errorLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'fatal';
  errorCategory: string;
  brfContext?: string;
  errorMessage: string;
  errorMessageSv?: string;
  errorCode?: string;
  occurrenceCount: number;
  firstOccurrenceAt: string;
  lastOccurrenceAt: string;
  isResolved: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  affectsOperations: boolean;
  affectsMembers: boolean;
  userRole?: string;
  apartmentId?: string;
  caseId?: string;
}

// Swedish translations
const translations = {
  title: 'Felhantering',
  subtitle: 'Övervaka, analysera och hantera systemfel för BRF-portalen',
  
  // Tabs
  overview: 'Översikt',
  errorLog: 'Felloggar',
  patterns: 'Mönster',
  settings: 'Inställningar',
  
  // Metrics
  totalErrors: 'Totalt antal fel',
  uniqueErrors: 'Unika fel',
  criticalErrors: 'Kritiska fel',
  resolvedErrors: 'Lösta fel',
  resolutionRate: 'Lösningsgrad',
  avgResolutionTime: 'Genomsnittlig lösningstid',
  errorRate: 'Felhastighet (per timme)',
  trends24h: 'Trend (24h)',
  
  // Actions
  exportLogs: 'Exportera loggar',
  clearResolved: 'Rensa lösta fel',
  refreshData: 'Uppdatera data',
  bulkResolve: 'Massa-lös',
  
  // Categories
  categoryBreakdown: 'Fördelning per kategori',
  brfContextBreakdown: 'BRF-sammanhang',
  topPatterns: 'Vanligaste fel',
  
  // Status
  loading: 'Laddar...',
  noData: 'Ingen data tillgänglig',
  
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
  
  // BRF contexts
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
  
  // Priority
  low: 'Låg',
  medium: 'Medium',
  high: 'Hög',
  urgent: 'Brådskande',
  
  // Time formats
  timeAgo: (minutes: number) => {
    if (minutes < 1) return 'Nyss';
    if (minutes < 60) return `${Math.floor(minutes)} min sedan`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} tim sedan`;
    return `${Math.floor(minutes / 1440)} dagar sedan`;
  },
  
  // Messages
  noErrors: 'Inga fel hittades',
  selectedErrors: (count: number) => `${count} fel valda`,
  confirmBulkResolve: 'Är du säker på att du vill lösa alla valda fel?',
  confirmClearResolved: 'Är du säker på att du vill ta bort alla lösta fel?'
};

// Mock data - replace with actual API calls
const mockMetrics: ErrorMetrics = {
  totalErrors: 147,
  uniqueErrors: 23,
  criticalErrors: 5,
  resolvedErrors: 118,
  errorRate: 3.2,
  avgResolutionTime: 2.5,
  categoryBreakdown: {
    payment: 45,
    document: 28,
    auth: 22,
    booking: 18,
    member_management: 15,
    database: 12,
    system: 7
  },
  brfContextBreakdown: {
    monthly_fees: 35,
    payment_processing: 28,
    document_approval: 20,
    member_registration: 15,
    booking_system: 12,
    meeting_protocol: 8
  },
  trendsLast24h: {
    errorCount: 23,
    trend: 'down',
    changePercent: -15.2
  },
  topErrorPatterns: [
    { pattern: 'Payment validation failed', count: 15, trend: 'increasing' },
    { pattern: 'Document upload timeout', count: 12, trend: 'stable' },
    { pattern: 'Member authentication error', count: 8, trend: 'decreasing' },
    { pattern: 'Booking conflict detected', count: 6, trend: 'stable' },
    { pattern: 'Database connection timeout', count: 4, trend: 'decreasing' }
  ]
};

const mockErrors: ErrorSummary[] = [
  {
    id: 1,
    errorId: 'err_001',
    errorLevel: 'critical',
    errorCategory: 'payment',
    brfContext: 'monthly_fees',
    errorMessage: 'Monthly fee payment processing failed',
    errorMessageSv: 'Månadsavgiftsbetalning misslyckades',
    errorCode: 'PAY_001',
    occurrenceCount: 8,
    firstOccurrenceAt: '2024-09-06T08:00:00Z',
    lastOccurrenceAt: '2024-09-06T16:30:00Z',
    isResolved: false,
    priority: 'urgent',
    affectsOperations: true,
    affectsMembers: true,
    userRole: 'member',
    apartmentId: 'apt_123'
  },
  {
    id: 2,
    errorId: 'err_002',
    errorLevel: 'error',
    errorCategory: 'document',
    brfContext: 'document_approval',
    errorMessage: 'Document upload failed due to size limit',
    errorMessageSv: 'Dokumentuppladdning misslyckades - för stor fil',
    errorCode: 'DOC_002',
    occurrenceCount: 3,
    firstOccurrenceAt: '2024-09-06T10:00:00Z',
    lastOccurrenceAt: '2024-09-06T15:20:00Z',
    isResolved: true,
    priority: 'medium',
    affectsOperations: false,
    affectsMembers: true,
    userRole: 'board'
  },
  // Add more mock errors as needed
];

// Helper functions
const getErrorLevelIcon = (level: string) => {
  switch (level) {
    case 'critical':
    case 'fatal':
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    case 'info':
      return <AlertCircle className="w-4 h-4 text-blue-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-gray-500" />;
  }
};

const getErrorLevelColor = (level: string) => {
  switch (level) {
    case 'critical':
    case 'fatal':
      return 'bg-red-500 text-white';
    case 'error':
      return 'bg-orange-500 text-white';
    case 'warning':
      return 'bg-yellow-500 text-black';
    case 'info':
      return 'bg-blue-500 text-white';
    default:
      return 'bg-gray-500 text-white';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'high':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low':
      return 'bg-green-100 text-green-800 border-green-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const formatTimeAgo = (dateString: string) => {
  const now = new Date();
  const date = new Date(dateString);
  const minutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
  return translations.timeAgo(minutes);
};

export default function EnhancedErrorManagementPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [metrics, setMetrics] = useState<ErrorMetrics>(mockMetrics);
  const [errors, setErrors] = useState<ErrorSummary[]>(mockErrors);
  const [selectedError, setSelectedError] = useState<ErrorLogDetail | null>(null);
  const [selectedErrors, setSelectedErrors] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<ErrorFilterOptions>({
    searchQuery: '',
    errorLevel: 'all',
    errorCategory: 'all',
    brfContext: 'all',
    status: 'all',
    priority: 'all',
    timeRange: 'all',
    affectsMembers: 'all',
    affectsOperations: 'all'
  });

  // Filter errors based on current filters
  const filteredErrors = useMemo(() => {
    return errors.filter(error => {
      const matchesSearch = !filters.searchQuery || 
        error.errorMessage.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
        (error.errorMessageSv && error.errorMessageSv.toLowerCase().includes(filters.searchQuery.toLowerCase())) ||
        (error.errorCode && error.errorCode.toLowerCase().includes(filters.searchQuery.toLowerCase()));
      
      const matchesLevel = filters.errorLevel === 'all' || error.errorLevel === filters.errorLevel;
      const matchesCategory = filters.errorCategory === 'all' || error.errorCategory === filters.errorCategory;
      const matchesBrfContext = filters.brfContext === 'all' || error.brfContext === filters.brfContext;
      const matchesStatus = filters.status === 'all' || 
        (filters.status === 'resolved' && error.isResolved) ||
        (filters.status === 'unresolved' && !error.isResolved);
      const matchesPriority = filters.priority === 'all' || error.priority === filters.priority;
      const matchesAffectsMembers = filters.affectsMembers === 'all' ||
        (filters.affectsMembers === 'yes' && error.affectsMembers) ||
        (filters.affectsMembers === 'no' && !error.affectsMembers);
      const matchesAffectsOperations = filters.affectsOperations === 'all' ||
        (filters.affectsOperations === 'yes' && error.affectsOperations) ||
        (filters.affectsOperations === 'no' && !error.affectsOperations);
      
      return matchesSearch && matchesLevel && matchesCategory && matchesBrfContext && 
             matchesStatus && matchesPriority && matchesAffectsMembers && matchesAffectsOperations;
    });
  }, [errors, filters]);

  // Calculate resolution rate
  const resolutionRate = metrics.totalErrors > 0 ? (metrics.resolvedErrors / metrics.totalErrors) * 100 : 0;

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      errorLevel: 'all',
      errorCategory: 'all',
      brfContext: 'all',
      status: 'all',
      priority: 'all',
      timeRange: 'all',
      affectsMembers: 'all',
      affectsOperations: 'all'
    });
  };

  const loadData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setMetrics(mockMetrics);
    setErrors(mockErrors);
    setLoading(false);
  };

  const handleBulkResolve = async () => {
    if (selectedErrors.size === 0 || !window.confirm(translations.confirmBulkResolve)) {
      return;
    }
    
    // Implement bulk resolve logic
    console.log('Bulk resolving errors:', Array.from(selectedErrors));
    setSelectedErrors(new Set());
  };

  const handleClearResolved = async () => {
    if (!window.confirm(translations.confirmClearResolved)) {
      return;
    }
    
    // Implement clear resolved logic
    console.log('Clearing resolved errors');
  };

  const handleErrorSelect = (errorId: number, selected: boolean) => {
    const newSelected = new Set(selectedErrors);
    if (selected) {
      newSelected.add(errorId);
    } else {
      newSelected.delete(errorId);
    }
    setSelectedErrors(newSelected);
  };

  const exportLogs = () => {
    // Implement export functionality
    console.log('Exporting error logs');
  };

  const handleErrorClick = (errorSummary: ErrorSummary) => {
    // Convert ErrorSummary to ErrorLogDetail for the dialog
    const errorDetail: ErrorLogDetail = {
      ...errorSummary,
      correlationId: undefined,
      errorSubcategory: undefined,
      stackTrace: undefined,
      sourceFile: undefined,
      sourceLine: undefined,
      sourceFunction: undefined,
      requestId: undefined,
      sessionId: undefined,
      endpoint: undefined,
      httpMethod: undefined,
      requestUrl: undefined,
      userId: undefined,
      userAgent: undefined,
      ipAddress: undefined,
      invoiceId: undefined,
      memberId: undefined,
      documentId: undefined,
      meetingId: undefined,
      environment: 'production',
      applicationVersion: '1.0.0',
      browserInfo: {},
      additionalData: {},
      tags: [],
      impactAssessment: undefined,
      gdprRelevant: false,
      auditRequired: false,
      regulatoryImpact: undefined,
      resolvedAt: undefined,
      resolvedBy: undefined,
      resolutionNotes: undefined,
      resolutionType: undefined,
      createdAt: errorSummary.firstOccurrenceAt,
      updatedAt: errorSummary.lastOccurrenceAt
    };
    
    setSelectedError(errorDetail);
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{translations.title}</h1>
            <p className="text-gray-600 mt-1">{translations.subtitle}</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportLogs}>
              <Download className="w-4 h-4 mr-2" />
              {translations.exportLogs}
            </Button>
            <Button variant="outline" onClick={handleClearResolved}>
              <Trash2 className="w-4 h-4 mr-2" />
              {translations.clearResolved}
            </Button>
            {selectedErrors.size > 0 && (
              <Button onClick={handleBulkResolve}>
                <Zap className="w-4 h-4 mr-2" />
                {translations.bulkResolve} ({selectedErrors.size})
              </Button>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">{translations.overview}</TabsTrigger>
            <TabsTrigger value="errorLog">{translations.errorLog}</TabsTrigger>
            <TabsTrigger value="patterns">{translations.patterns}</TabsTrigger>
            <TabsTrigger value="settings">{translations.settings}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{translations.totalErrors}</p>
                      <p className="text-2xl font-bold text-gray-900">{metrics.totalErrors}</p>
                      <div className="flex items-center mt-1">
                        {metrics.trendsLast24h.trend === 'down' ? (
                          <TrendingDown className="w-4 h-4 text-green-500" />
                        ) : (
                          <TrendingUp className="w-4 h-4 text-red-500" />
                        )}
                        <span className={`text-xs ml-1 ${
                          metrics.trendsLast24h.trend === 'down' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {Math.abs(metrics.trendsLast24h.changePercent)}% (24h)
                        </span>
                      </div>
                    </div>
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{translations.criticalErrors}</p>
                      <p className="text-2xl font-bold text-red-600">{metrics.criticalErrors}</p>
                      <p className="text-xs text-gray-500 mt-1">Kräver omedelbar åtgärd</p>
                    </div>
                    <AlertCircle className="w-8 h-8 text-red-400" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{translations.resolutionRate}</p>
                      <p className="text-2xl font-bold text-green-600">{resolutionRate.toFixed(1)}%</p>
                      <Progress value={resolutionRate} className="mt-2 h-2" />
                    </div>
                    <Activity className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">{translations.avgResolutionTime}</p>
                      <p className="text-2xl font-bold text-blue-600">{metrics.avgResolutionTime}h</p>
                      <p className="text-xs text-gray-500 mt-1">Genomsnitt senaste månaden</p>
                    </div>
                    <Clock className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Category Breakdown and Top Patterns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{translations.categoryBreakdown}</CardTitle>
                  <CardDescription>Fel fördelade per kategori</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(metrics.categoryBreakdown).map(([category, count]) => {
                      const percentage = (count / metrics.totalErrors) * 100;
                      return (
                        <div key={category} className="flex items-center justify-between">
                          <span className="text-sm capitalize">
                            {translations[category as keyof typeof translations] || category}
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{translations.topPatterns}</CardTitle>
                  <CardDescription>Mest förekommande fel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.topErrorPatterns.map((pattern, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{pattern.pattern}</p>
                          <p className="text-xs text-gray-500">
                            {pattern.count} förekomster
                            {pattern.trend === 'increasing' && (
                              <span className="text-red-600 ml-2">↗ Ökar</span>
                            )}
                            {pattern.trend === 'decreasing' && (
                              <span className="text-green-600 ml-2">↘ Minskar</span>
                            )}
                            {pattern.trend === 'stable' && (
                              <span className="text-gray-600 ml-2">→ Stabilt</span>
                            )}
                          </p>
                        </div>
                        <Badge variant="outline">{pattern.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* BRF Context Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>{translations.brfContextBreakdown}</CardTitle>
                <CardDescription>Fel inom olika BRF-områden</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(metrics.brfContextBreakdown).map(([context, count]) => (
                    <div key={context} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm">
                        {translations[context as keyof typeof translations] || context}
                      </span>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errorLog" className="space-y-6">
            {/* Filters */}
            <ErrorFilters
              filters={filters}
              onFiltersChange={setFilters}
              showAdvanced={showAdvancedFilters}
              onToggleAdvanced={() => setShowAdvancedFilters(!showAdvancedFilters)}
              onClearFilters={clearFilters}
              onRefresh={loadData}
              isLoading={loading}
              resultCount={filteredErrors.length}
            />

            {/* Error List */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>
                    Felloggar ({filteredErrors.length})
                  </CardTitle>
                  {selectedErrors.size > 0 && (
                    <Badge variant="secondary">
                      {translations.selectedErrors(selectedErrors.size)}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">
                    {translations.loading}
                  </div>
                ) : filteredErrors.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {translations.noErrors}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredErrors.map((error) => (
                      <div
                        key={error.id}
                        className="p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start gap-4">
                          <input
                            type="checkbox"
                            checked={selectedErrors.has(error.id)}
                            onChange={(e) => handleErrorSelect(error.id, e.target.checked)}
                            className="mt-1"
                          />
                          
                          <div
                            className="flex items-start gap-3 flex-1 cursor-pointer"
                            onClick={() => handleErrorClick(error)}
                          >
                            {getErrorLevelIcon(error.errorLevel)}
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <Badge className={getErrorLevelColor(error.errorLevel)}>
                                  {translations[error.errorLevel as keyof typeof translations]}
                                </Badge>
                                
                                <Badge variant="outline" className={getPriorityColor(error.priority)}>
                                  {translations[error.priority as keyof typeof translations]}
                                </Badge>
                                
                                {error.errorCode && (
                                  <Badge variant="outline">{error.errorCode}</Badge>
                                )}
                                
                                {error.isResolved && (
                                  <Badge className="bg-green-100 text-green-800 border-green-200">
                                    Löst
                                  </Badge>
                                )}
                                
                                {error.affectsOperations && (
                                  <Badge variant="destructive" className="text-xs">
                                    Verksamhetspåverkan
                                  </Badge>
                                )}
                                
                                {error.affectsMembers && (
                                  <Badge variant="secondary" className="text-xs">
                                    Medlemspåverkan
                                  </Badge>
                                )}
                              </div>
                              
                              <h3 className="font-medium text-gray-900 mb-1">
                                {error.errorMessageSv || error.errorMessage}
                              </h3>
                              
                              <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
                                <span>{translations[error.errorCategory as keyof typeof translations]}</span>
                                
                                {error.brfContext && (
                                  <>
                                    <span>•</span>
                                    <span>{translations[error.brfContext as keyof typeof translations]}</span>
                                  </>
                                )}
                                
                                {error.occurrenceCount > 1 && (
                                  <>
                                    <span>•</span>
                                    <span>{error.occurrenceCount}x</span>
                                  </>
                                )}
                                
                                <span>•</span>
                                <span>{formatTimeAgo(error.lastOccurrenceAt)}</span>
                                
                                {error.userRole && (
                                  <>
                                    <span>•</span>
                                    <span className="capitalize">{error.userRole}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Felmönster</CardTitle>
                <CardDescription>
                  Analysera återkommande felmönster och trender
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Funktionalitet för mönsteranalys kommer snart...
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Inställningar</CardTitle>
                <CardDescription>
                  Konfigurera felhantering och notifieringar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Inställningar kommer snart...
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Error Detail Dialog */}
        <ErrorDetailDialog
          error={selectedError}
          isOpen={!!selectedError}
          onClose={() => setSelectedError(null)}
          canModify={true}
        />
      </div>
    </div>
  );
}