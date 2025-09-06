'use client';

import React, { useState } from 'react';
import {
  AlertCircle, AlertTriangle, Info, X, User, MapPin, FileText,
  Clock, CheckCircle, Settings, Copy, ExternalLink, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';

/**
 * Error Detail Dialog Component
 * Comprehensive error details with Swedish localization for BRF context
 */

export interface ErrorLogDetail {
  id: number;
  errorId: string;
  correlationId?: string;
  errorLevel: 'debug' | 'info' | 'warning' | 'error' | 'critical' | 'fatal';
  errorCategory: string;
  errorSubcategory?: string;
  brfContext?: string;
  errorMessage: string;
  errorMessageSv?: string;
  errorCode?: string;
  
  // Stack trace and debugging
  stackTrace?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceFunction?: string;
  
  // Request context
  requestId?: string;
  sessionId?: string;
  endpoint?: string;
  httpMethod?: string;
  requestUrl?: string;
  
  // User context
  userId?: string;
  userRole?: string;
  userAgent?: string;
  ipAddress?: string;
  
  // Related entities
  apartmentId?: string;
  invoiceId?: string;
  caseId?: string;
  memberId?: string;
  documentId?: string;
  meetingId?: string;
  
  // Additional metadata
  environment?: string;
  applicationVersion?: string;
  browserInfo?: Record<string, any>;
  additionalData?: Record<string, any>;
  tags?: string[];
  
  // Priority and impact
  priority: 'low' | 'medium' | 'high' | 'urgent';
  impactAssessment?: string;
  affectsOperations: boolean;
  affectsMembers: boolean;
  
  // Compliance
  gdprRelevant: boolean;
  auditRequired: boolean;
  regulatoryImpact?: string;
  
  // Occurrence tracking
  occurrenceCount: number;
  firstOccurrenceAt: string;
  lastOccurrenceAt: string;
  
  // Resolution
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  resolutionType?: string;
  
  createdAt: string;
  updatedAt: string;
}

interface ErrorDetailDialogProps {
  error: ErrorLogDetail | null;
  isOpen: boolean;
  onClose: () => void;
  onResolve?: (errorId: string, notes: string, type: string) => Promise<void>;
  onReopen?: (errorId: string) => Promise<void>;
  canModify?: boolean;
}

// Swedish translations
const translations = {
  errorDetails: 'Feldetaljer',
  overview: 'Översikt',
  technical: 'Teknisk information',
  context: 'Sammanhang',
  resolution: 'Lösning',
  
  // Basic info
  errorId: 'Fel-ID',
  correlationId: 'Korrelations-ID',
  level: 'Nivå',
  category: 'Kategori',
  subcategory: 'Underkategori',
  brfContext: 'BRF-sammanhang',
  priority: 'Prioritet',
  status: 'Status',
  
  // Occurrence info
  occurrences: 'Antal förekomster',
  firstOccurrence: 'Första förekomst',
  lastOccurrence: 'Senaste förekomst',
  
  // Technical info
  stackTrace: 'Stack trace',
  sourceLocation: 'Källkodsplats',
  sourceFile: 'Fil',
  sourceLine: 'Rad',
  sourceFunction: 'Funktion',
  endpoint: 'API-endpoint',
  httpMethod: 'HTTP-metod',
  requestUrl: 'Förfrågnings-URL',
  requestId: 'Förfrågnings-ID',
  sessionId: 'Sessions-ID',
  
  // User context
  userInfo: 'Användarinformation',
  userId: 'Användar-ID',
  userRole: 'Användarroll',
  ipAddress: 'IP-adress',
  userAgent: 'Webbläsare',
  
  // Related entities
  relatedEntities: 'Relaterade objekt',
  apartment: 'Lägenhet',
  case: 'Ärende',
  invoice: 'Faktura',
  member: 'Medlem',
  document: 'Dokument',
  meeting: 'Möte',
  
  // Impact
  impact: 'Påverkan',
  affectsMembers: 'Påverkar medlemmar',
  affectsOperations: 'Påverkar verksamhet',
  impactAssessment: 'Påverkansbedömning',
  
  // Compliance
  compliance: 'Regelefterlevnad',
  gdprRelevant: 'GDPR-relevant',
  auditRequired: 'Revision krävs',
  regulatoryImpact: 'Regulatorisk påverkan',
  
  // Environment
  environment: 'Miljö',
  applicationVersion: 'Applikationsversion',
  
  // Resolution
  resolved: 'Löst',
  unresolved: 'Olöst',
  resolvedAt: 'Löst datum',
  resolvedBy: 'Löst av',
  resolutionType: 'Lösningstyp',
  resolutionNotes: 'Lösningsanteckningar',
  markResolved: 'Markera som löst',
  reopenError: 'Återöppna fel',
  
  // Resolution types
  fixed: 'Fixad',
  workaround: 'Tillfällig lösning',
  configuration: 'Konfigurationsändring',
  user_error: 'Användarfel',
  duplicate: 'Dublett',
  wont_fix: 'Kommer inte fixas',
  
  // Actions
  copy: 'Kopiera',
  copyStackTrace: 'Kopiera stack trace',
  copyErrorId: 'Kopiera fel-ID',
  viewRelated: 'Visa relaterat',
  showSensitive: 'Visa känslig data',
  hideSensitive: 'Dölj känslig data',
  
  // Messages
  noStackTrace: 'Ingen stack trace tillgänglig',
  noAdditionalData: 'Ingen ytterligare data tillgänglig',
  sensitiveDataWarning: 'Denna information kan innehålla känslig data',
  copySuccess: 'Kopierat till urklipp',
  
  // Levels
  debug: 'Felsökning',
  info: 'Information',
  warning: 'Varning',
  error: 'Fel',
  critical: 'Kritisk',
  fatal: 'Fatal',
  
  // Priorities
  low: 'Låg',
  medium: 'Medium',
  high: 'Hög',
  urgent: 'Brådskande',
  
  // Categories - matching the main component
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
  
  // Impact assessments
  no_impact: 'Ingen påverkan',
  minor: 'Mindre',
  moderate: 'Måttlig',
  significant: 'Betydande',
  critical_impact: 'Kritisk',
  
  // Common values
  yes: 'Ja',
  no: 'Nej',
  unknown: 'Okänt'
};

export default function ErrorDetailDialog({
  error,
  isOpen,
  onClose,
  onResolve,
  onReopen,
  canModify = false
}: ErrorDetailDialogProps) {
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionType, setResolutionType] = useState<string>('fixed');
  const [isResolving, setIsResolving] = useState(false);

  if (!error) return null;

  const getErrorLevelIcon = (level: string) => {
    switch (level) {
      case 'critical':
      case 'fatal':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log(`${label} ${translations.copySuccess}`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleResolve = async () => {
    if (!onResolve || !resolutionNotes.trim()) return;
    
    setIsResolving(true);
    try {
      await onResolve(error.errorId, resolutionNotes, resolutionType);
      onClose();
    } catch (err) {
      console.error('Failed to resolve error:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {getErrorLevelIcon(error.errorLevel)}
              <div>
                <DialogTitle className="text-xl">
                  {error.errorMessageSv || error.errorMessage}
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  <span>
                    {error.errorCode} • {translations[error.errorCategory as keyof typeof translations] || error.errorCategory}
                  </span>
                  {error.brfContext && (
                    <>
                      <span>•</span>
                      <span>{translations[error.brfContext as keyof typeof translations] || error.brfContext}</span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Badge className={getErrorLevelColor(error.errorLevel)}>
                {translations[error.errorLevel as keyof typeof translations]}
              </Badge>
              <Badge className={getPriorityColor(error.priority)}>
                {translations[error.priority as keyof typeof translations]}
              </Badge>
              {error.isResolved && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  {translations.resolved}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="overview" className="h-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">{translations.overview}</TabsTrigger>
              <TabsTrigger value="technical">{translations.technical}</TabsTrigger>
              <TabsTrigger value="context">{translations.context}</TabsTrigger>
              <TabsTrigger value="resolution">{translations.resolution}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Grundinformation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{translations.errorId}:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{error.errorId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(error.errorId, translations.errorId)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {error.correlationId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.correlationId}:</span>
                        <span className="font-mono text-sm">{error.correlationId}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{translations.occurrences}:</span>
                      <span className="font-semibold">{error.occurrenceCount}</span>
                    </div>
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{translations.firstOccurrence}:</span>
                        <span>{formatDateTime(error.firstOccurrenceAt)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{translations.lastOccurrence}:</span>
                        <span>{formatDateTime(error.lastOccurrenceAt)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Impact Assessment */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translations.impact}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{translations.affectsMembers}:</span>
                      <Badge variant={error.affectsMembers ? "destructive" : "secondary"}>
                        {error.affectsMembers ? translations.yes : translations.no}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{translations.affectsOperations}:</span>
                      <Badge variant={error.affectsOperations ? "destructive" : "secondary"}>
                        {error.affectsOperations ? translations.yes : translations.no}
                      </Badge>
                    </div>
                    
                    {error.impactAssessment && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.impactAssessment}:</span>
                        <span className="text-sm">
                          {translations[error.impactAssessment as keyof typeof translations] || error.impactAssessment}
                        </span>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{translations.gdprRelevant}:</span>
                        <Badge variant={error.gdprRelevant ? "destructive" : "secondary"}>
                          {error.gdprRelevant ? translations.yes : translations.no}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">{translations.auditRequired}:</span>
                        <Badge variant={error.auditRequired ? "destructive" : "secondary"}>
                          {error.auditRequired ? translations.yes : translations.no}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Error Message */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Felmeddelande</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="font-medium">{error.errorMessage}</p>
                      {error.errorMessageSv && error.errorMessageSv !== error.errorMessage && (
                        <p className="text-gray-600 mt-1 text-sm">
                          <strong>Svenska:</strong> {error.errorMessageSv}
                        </p>
                      )}
                    </div>
                    
                    {error.tags && error.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {error.tags.map((tag, index) => (
                          <Badge key={index} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="technical" className="space-y-4 mt-4">
              {/* Stack Trace */}
              {error.stackTrace && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">{translations.stackTrace}</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(error.stackTrace!, translations.stackTrace)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {translations.copy}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                      {error.stackTrace}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Source Location */}
              {(error.sourceFile || error.sourceLine || error.sourceFunction) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translations.sourceLocation}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {error.sourceFile && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.sourceFile}:</span>
                        <span className="font-mono text-sm">{error.sourceFile}</span>
                      </div>
                    )}
                    {error.sourceLine && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.sourceLine}:</span>
                        <span className="font-mono text-sm">{error.sourceLine}</span>
                      </div>
                    )}
                    {error.sourceFunction && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.sourceFunction}:</span>
                        <span className="font-mono text-sm">{error.sourceFunction}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Request Information */}
              {(error.endpoint || error.requestId || error.sessionId) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Förfrågningsinformation</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {error.endpoint && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.endpoint}:</span>
                        <span className="font-mono text-sm">{error.endpoint}</span>
                      </div>
                    )}
                    {error.httpMethod && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.httpMethod}:</span>
                        <Badge variant="outline">{error.httpMethod}</Badge>
                      </div>
                    )}
                    {error.requestUrl && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.requestUrl}:</span>
                        <span className="font-mono text-sm break-all">{error.requestUrl}</span>
                      </div>
                    )}
                    {error.requestId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.requestId}:</span>
                        <span className="font-mono text-sm">{error.requestId}</span>
                      </div>
                    )}
                    {error.sessionId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.sessionId}:</span>
                        <span className="font-mono text-sm">{error.sessionId}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Additional Data */}
              {error.additionalData && Object.keys(error.additionalData).length > 0 && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Ytterligare data</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowSensitiveData(!showSensitiveData)}
                    >
                      {showSensitiveData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {showSensitiveData ? translations.hideSensitive : translations.showSensitive}
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {showSensitiveData ? (
                      <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-auto max-h-64">
                        {JSON.stringify(error.additionalData, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-gray-500 text-center py-4">
                        {translations.sensitiveDataWarning}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="context" className="space-y-4 mt-4">
              {/* User Information */}
              {(error.userId || error.userRole || error.ipAddress) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translations.userInfo}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {error.userId && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.userId}:</span>
                        <span className="font-mono text-sm">{error.userId}</span>
                      </div>
                    )}
                    {error.userRole && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.userRole}:</span>
                        <Badge variant="outline">{error.userRole}</Badge>
                      </div>
                    )}
                    {error.ipAddress && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">{translations.ipAddress}:</span>
                        <span className="font-mono text-sm">{error.ipAddress}</span>
                      </div>
                    )}
                    {error.userAgent && (
                      <div>
                        <span className="text-sm text-gray-600 block mb-1">{translations.userAgent}:</span>
                        <span className="text-sm break-all">{error.userAgent}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Related Entities */}
              {(error.apartmentId || error.caseId || error.invoiceId || error.memberId || error.documentId) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{translations.relatedEntities}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {error.apartmentId && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{translations.apartment}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{error.apartmentId}</span>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {error.caseId && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{translations.case}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{error.caseId}</span>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {error.invoiceId && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{translations.invoice}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{error.invoiceId}</span>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {error.memberId && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{translations.member}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{error.memberId}</span>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                    {error.documentId && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">{translations.document}:</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{error.documentId}</span>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Environment Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Miljöinformation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {error.environment && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{translations.environment}:</span>
                      <Badge variant="outline">{error.environment}</Badge>
                    </div>
                  )}
                  {error.applicationVersion && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">{translations.applicationVersion}:</span>
                      <span className="font-mono text-sm">{error.applicationVersion}</span>
                    </div>
                  )}
                  {error.browserInfo && Object.keys(error.browserInfo).length > 0 && (
                    <div>
                      <span className="text-sm text-gray-600 block mb-2">Webbläsarinformation:</span>
                      <pre className="bg-gray-50 p-3 rounded text-xs overflow-auto">
                        {JSON.stringify(error.browserInfo, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resolution" className="space-y-4 mt-4">
              {error.isResolved ? (
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <CardTitle className="text-lg text-green-700">{translations.resolved}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-600">{translations.resolvedAt}:</span>
                        <p className="font-medium">
                          {error.resolvedAt && formatDateTime(error.resolvedAt)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">{translations.resolvedBy}:</span>
                        <p className="font-medium">{error.resolvedBy}</p>
                      </div>
                    </div>
                    
                    {error.resolutionType && (
                      <div>
                        <span className="text-sm text-gray-600">{translations.resolutionType}:</span>
                        <Badge className="ml-2">
                          {translations[error.resolutionType as keyof typeof translations] || error.resolutionType}
                        </Badge>
                      </div>
                    )}
                    
                    {error.resolutionNotes && (
                      <div>
                        <span className="text-sm text-gray-600 block mb-1">{translations.resolutionNotes}:</span>
                        <p className="p-3 bg-green-50 rounded-lg border border-green-200">
                          {error.resolutionNotes}
                        </p>
                      </div>
                    )}
                    
                    {canModify && onReopen && (
                      <div className="pt-3 border-t">
                        <Button
                          variant="outline"
                          onClick={() => onReopen(error.errorId)}
                        >
                          {translations.reopenError}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                canModify && onResolve && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{translations.markResolved}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">
                          {translations.resolutionType}
                        </label>
                        <select
                          value={resolutionType}
                          onChange={(e) => setResolutionType(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-md"
                        >
                          <option value="fixed">{translations.fixed}</option>
                          <option value="workaround">{translations.workaround}</option>
                          <option value="configuration">{translations.configuration}</option>
                          <option value="user_error">{translations.user_error}</option>
                          <option value="duplicate">{translations.duplicate}</option>
                          <option value="wont_fix">{translations.wont_fix}</option>
                        </select>
                      </div>
                      
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-2">
                          {translations.resolutionNotes}
                        </label>
                        <Textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          placeholder="Beskriv hur felet löstes..."
                          rows={4}
                        />
                      </div>
                      
                      <Button
                        onClick={handleResolve}
                        disabled={!resolutionNotes.trim() || isResolving}
                        className="w-full"
                      >
                        {isResolving ? 'Löser...' : translations.markResolved}
                      </Button>
                    </CardContent>
                  </Card>
                )
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}