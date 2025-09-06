'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Search, Filter, X, Clock, User, AlertTriangle, Info, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';

/**
 * Error Log Viewer for BRF Portal
 * Swedish localized interface for viewing and managing application errors
 */

interface ErrorLog {
  id: number;
  errorId: string;
  errorLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'fatal';
  errorCategory: string;
  errorSubcategory?: string;
  brfContext?: string;
  errorMessage: string;
  errorMessageSv?: string;
  errorCode?: string;
  stackTrace?: string;
  endpoint?: string;
  userId?: string;
  userRole?: string;
  apartmentId?: string;
  caseId?: string;
  occurrenceCount: number;
  firstOccurrenceAt: string;
  lastOccurrenceAt: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  impactAssessment?: string;
  affectsOperations: boolean;
  affectsMembers: boolean;
  createdAt: string;
}

interface ErrorMetrics {
  totalErrors: number;
  uniqueErrors: number;
  criticalErrors: number;
  resolvedErrors: number;
  errorRate: number;
  avgResolutionTime: number;
  categoryBreakdown: Record<string, number>;
  brfContextBreakdown: Record<string, number>;
}

// Swedish translations
const translations = {
  title: 'Felloggar',
  subtitle: 'Översikt av systemfel och problem',
  searchPlaceholder: 'Sök i felmeddelanden...',
  filters: 'Filter',
  allLevels: 'Alla nivåer',
  allCategories: 'Alla kategorier',
  allStatus: 'Alla status',
  resolved: 'Löst',
  unresolved: 'Olöst',
  clearFilters: 'Rensa filter',
  
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
  
  // Priority
  low: 'Låg',
  medium: 'Medium',
  high: 'Hög',
  urgent: 'Brådskande',
  
  // Metrics
  totalErrors: 'Totalt antal fel',
  uniqueErrors: 'Unika fel',
  criticalErrors: 'Kritiska fel',
  resolvedErrors: 'Lösta fel',
  errorRate: 'Felhastighet (per timme)',
  avgResolutionTime: 'Genomsnittlig lösningstid (timmar)',
  resolutionRate: 'Lösningsgrad',
  
  // Actions
  viewDetails: 'Visa detaljer',
  markResolved: 'Markera som löst',
  exportLogs: 'Exportera loggar',
  refreshData: 'Uppdatera data',
  
  // Details
  errorDetails: 'Feldetaljer',
  stackTrace: 'Stack trace',
  occurrences: 'Förekomster',
  firstOccurrence: 'Första förekomst',
  lastOccurrence: 'Senaste förekomst',
  affectedUser: 'Berörd användare',
  relatedEntities: 'Relaterade objekt',
  apartment: 'Lägenhet',
  case: 'Ärende',
  resolution: 'Lösning',
  resolutionNotes: 'Lösningsanteckningar',
  resolvedBy: 'Löst av',
  resolvedAt: 'Löst datum',
  
  // Time formats
  timeAgo: (minutes: number) => {
    if (minutes < 1) return 'Nyss';
    if (minutes < 60) return `${Math.floor(minutes)} min sedan`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} tim sedan`;
    return `${Math.floor(minutes / 1440)} dagar sedan`;
  },
  
  // Status messages
  noErrors: 'Inga fel hittades',
  loadingErrors: 'Laddar fel...',
  errorLoadFailed: 'Kunde inte ladda fel'
};

// Mock data - replace with actual API calls
const mockErrors: ErrorLog[] = [
  {
    id: 1,
    errorId: 'err_001',
    errorLevel: 'critical',
    errorCategory: 'payment',
    brfContext: 'monthly_fees',
    errorMessage: 'Payment processing failed for monthly fee',
    errorMessageSv: 'Betalningsbehandling misslyckades för månadsavgift',
    errorCode: 'PAY_001',
    endpoint: '/api/payments/process',
    userId: 'user_123',
    userRole: 'member',
    apartmentId: 'apt_456',
    occurrenceCount: 5,
    firstOccurrenceAt: '2024-09-06T10:00:00Z',
    lastOccurrenceAt: '2024-09-06T14:30:00Z',
    isResolved: false,
    priority: 'urgent',
    impactAssessment: 'significant',
    affectsOperations: true,
    affectsMembers: true,
    createdAt: '2024-09-06T10:00:00Z'
  },
  {
    id: 2,
    errorId: 'err_002',
    errorLevel: 'error',
    errorCategory: 'document',
    brfContext: 'document_approval',
    errorMessage: 'Document upload failed due to file size limit',
    errorMessageSv: 'Dokumentuppladdning misslyckades på grund av filstorleksgräns',
    errorCode: 'DOC_002',
    endpoint: '/api/documents/upload',
    userId: 'user_789',
    userRole: 'board',
    occurrenceCount: 2,
    firstOccurrenceAt: '2024-09-06T12:00:00Z',
    lastOccurrenceAt: '2024-09-06T13:15:00Z',
    isResolved: true,
    resolvedAt: '2024-09-06T13:30:00Z',
    resolvedBy: 'admin_001',
    resolutionNotes: 'Increased file size limit to 10MB',
    priority: 'medium',
    impactAssessment: 'minor',
    affectsOperations: false,
    affectsMembers: true,
    createdAt: '2024-09-06T12:00:00Z'
  }
];

const mockMetrics: ErrorMetrics = {
  totalErrors: 25,
  uniqueErrors: 12,
  criticalErrors: 3,
  resolvedErrors: 18,
  errorRate: 2.1,
  avgResolutionTime: 4.5,
  categoryBreakdown: {
    payment: 8,
    document: 5,
    auth: 4,
    booking: 3,
    system: 5
  },
  brfContextBreakdown: {
    monthly_fees: 8,
    document_approval: 5,
    member_registration: 4,
    booking_system: 3,
    payment_processing: 5
  }
};

// Helper functions
const getErrorLevelIcon = (level: string) => {
  switch (level) {
    case 'critical':
    case 'fatal':
      return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case 'error':
      return <AlertCircle className="w-4 h-4 text-orange-500" />;
    case 'warning':
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    case 'info':
      return <Info className="w-4 h-4 text-blue-500" />;
    default:
      return <Info className="w-4 h-4 text-gray-500" />;
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

export default function ErrorLogsPage() {
  const [errors, setErrors] = useState<ErrorLog[]>(mockErrors);
  const [metrics, setMetrics] = useState<ErrorMetrics>(mockMetrics);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter errors based on search and filters
  const filteredErrors = useMemo(() => {
    return errors.filter(error => {
      const matchesSearch = !searchQuery || 
        error.errorMessage.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (error.errorMessageSv && error.errorMessageSv.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (error.errorCode && error.errorCode.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesLevel = selectedLevel === 'all' || error.errorLevel === selectedLevel;
      const matchesCategory = selectedCategory === 'all' || error.errorCategory === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || 
        (selectedStatus === 'resolved' && error.isResolved) ||
        (selectedStatus === 'unresolved' && !error.isResolved);
      
      return matchesSearch && matchesLevel && matchesCategory && matchesStatus;
    });
  }, [errors, searchQuery, selectedLevel, selectedCategory, selectedStatus]);

  // Calculate resolution rate
  const resolutionRate = metrics.totalErrors > 0 ? (metrics.resolvedErrors / metrics.totalErrors) * 100 : 0;

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedLevel('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
  };

  // Load error data (mock implementation)
  const loadErrorData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setErrors(mockErrors);
    setMetrics(mockMetrics);
    setLoading(false);
  };

  useEffect(() => {
    loadErrorData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{translations.title}</h1>
            <p className="text-gray-600 mt-1">{translations.subtitle}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {translations.filters}
            </Button>
            <Button
              onClick={loadErrorData}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {translations.refreshData}
            </Button>
          </div>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{translations.totalErrors}</p>
                  <p className="text-2xl font-bold text-gray-900">{metrics.totalErrors}</p>
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
                </div>
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{translations.resolutionRate}</p>
                  <p className="text-2xl font-bold text-green-600">{resolutionRate.toFixed(1)}%</p>
                </div>
                <div className="w-8 h-8 flex items-center justify-center">
                  <Progress value={resolutionRate} className="w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">{translations.avgResolutionTime}</p>
                  <p className="text-2xl font-bold text-blue-600">{metrics.avgResolutionTime.toFixed(1)}h</p>
                </div>
                <Clock className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    placeholder={translations.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              {showFilters && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t">
                  <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                    <SelectTrigger>
                      <SelectValue placeholder={translations.allLevels} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{translations.allLevels}</SelectItem>
                      <SelectItem value="critical">{translations.critical}</SelectItem>
                      <SelectItem value="error">{translations.error}</SelectItem>
                      <SelectItem value="warning">{translations.warning}</SelectItem>
                      <SelectItem value="info">{translations.info}</SelectItem>
                      <SelectItem value="debug">{translations.debug}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder={translations.allCategories} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{translations.allCategories}</SelectItem>
                      <SelectItem value="payment">{translations.payment}</SelectItem>
                      <SelectItem value="document">{translations.document}</SelectItem>
                      <SelectItem value="auth">{translations.auth}</SelectItem>
                      <SelectItem value="booking">{translations.booking}</SelectItem>
                      <SelectItem value="member_management">{translations.member_management}</SelectItem>
                      <SelectItem value="system">{translations.system}</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder={translations.allStatus} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{translations.allStatus}</SelectItem>
                      <SelectItem value="resolved">{translations.resolved}</SelectItem>
                      <SelectItem value="unresolved">{translations.unresolved}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {(searchQuery || selectedLevel !== 'all' || selectedCategory !== 'all' || selectedStatus !== 'all') && (
                <div className="flex justify-end">
                  <Button variant="ghost" onClick={clearFilters} className="flex items-center gap-2">
                    <X className="w-4 h-4" />
                    {translations.clearFilters}
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Error List */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                Felloggar ({filteredErrors.length})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                {translations.loadingErrors}
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
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedError(error)}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        {getErrorLevelIcon(error.errorLevel)}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
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
                                {translations.resolved}
                              </Badge>
                            )}
                          </div>
                          
                          <h3 className="font-medium text-gray-900 mb-1 truncate">
                            {error.errorMessageSv || error.errorMessage}
                          </h3>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-500">
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
                            
                            {error.userId && (
                              <>
                                <span>•</span>
                                <User className="w-3 h-3 inline" />
                                <span>{error.userRole}</span>
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
      </div>

      {/* Error Detail Dialog */}
      <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedError && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {getErrorLevelIcon(selectedError.errorLevel)}
                  <div>
                    <DialogTitle>
                      {selectedError.errorMessageSv || selectedError.errorMessage}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedError.errorCode} • {translations[selectedError.errorCategory as keyof typeof translations]}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">{translations.firstOccurrence}</label>
                    <p className="text-gray-900">{new Date(selectedError.firstOccurrenceAt).toLocaleString('sv-SE')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">{translations.lastOccurrence}</label>
                    <p className="text-gray-900">{new Date(selectedError.lastOccurrenceAt).toLocaleString('sv-SE')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">{translations.occurrences}</label>
                    <p className="text-gray-900">{selectedError.occurrenceCount}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Prioritet</label>
                    <Badge className={getPriorityColor(selectedError.priority)}>
                      {translations[selectedError.priority as keyof typeof translations]}
                    </Badge>
                  </div>
                </div>

                {/* Stack Trace */}
                {selectedError.stackTrace && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">{translations.stackTrace}</label>
                    <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                      {selectedError.stackTrace}
                    </pre>
                  </div>
                )}

                {/* Resolution */}
                {selectedError.isResolved && (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-green-900 mb-2">{translations.resolution}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-green-700">{translations.resolvedBy}:</span>
                        <span className="text-green-900 ml-2">{selectedError.resolvedBy}</span>
                      </div>
                      <div>
                        <span className="text-green-700">{translations.resolvedAt}:</span>
                        <span className="text-green-900 ml-2">
                          {selectedError.resolvedAt && new Date(selectedError.resolvedAt).toLocaleString('sv-SE')}
                        </span>
                      </div>
                    </div>
                    {selectedError.resolutionNotes && (
                      <div className="mt-2">
                        <span className="text-green-700">{translations.resolutionNotes}:</span>
                        <p className="text-green-900 mt-1">{selectedError.resolutionNotes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  {!selectedError.isResolved && (
                    <Button variant="outline">
                      {translations.markResolved}
                    </Button>
                  )}
                  <Button variant="outline">
                    {translations.viewDetails}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}