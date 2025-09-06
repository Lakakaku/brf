'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Database, 
  Eye, 
  FileText, 
  Gavel,
  LineChart,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Zap 
} from 'lucide-react';
import { 
  LineChart as RechartsLineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface QueryInspectorProps {
  cooperativeId: string;
}

interface DashboardData {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  categoryPerformance: Record<string, {
    executionTime: number;
    memoryUsage: number;
    indexUsageScore: number;
    cacheHitRatio: number;
  }>;
  complianceStatus: Record<string, {
    regulation: string;
    compliant: boolean;
    violations: string[];
    recommendations: string[];
  }>;
  topIssues: string[];
  optimizationOpportunities: Array<{
    type: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    estimatedImpact: number;
    brfContext?: string;
  }>;
  swedishRegulatoryStatus: Record<string, boolean>;
}

interface QueryPerformanceTrend {
  date: string;
  avgExecutionTime: number;
  slowQueries: number;
  totalQueries: number;
}

interface BRFCategoryMetrics {
  category: string;
  displayName: string;
  icon: React.ElementType;
  queries: number;
  avgTime: number;
  performance: 'excellent' | 'good' | 'fair' | 'poor';
  issues: number;
  compliance: boolean;
}

const HEALTH_COLORS = {
  excellent: 'text-green-600',
  good: 'text-blue-600', 
  fair: 'text-yellow-600',
  poor: 'text-red-600'
};

const PRIORITY_COLORS = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'warning',
  low: 'secondary'
};

const BRF_CATEGORIES: Record<string, { displayName: string; icon: React.ElementType }> = {
  member_management: { displayName: 'Medlemshantering', icon: Users },
  apartment_operations: { displayName: 'Lägenhetsdrift', icon: Database },
  financial_operations: { displayName: 'Ekonomi & K2/K3', icon: LineChart },
  document_management: { displayName: 'Dokumenthantering', icon: FileText },
  case_management: { displayName: 'Ärendehantering', icon: Activity },
  board_governance: { displayName: 'Styrelsearbete', icon: Gavel },
  energy_monitoring: { displayName: 'Energiövervakning', icon: Zap },
  booking_system: { displayName: 'Bokningssystem', icon: Clock },
  queue_management: { displayName: 'Köhantering', icon: TrendingUp },
  audit_compliance: { displayName: 'Revision & Compliance', icon: Shield }
};

export default function QueryInspectorDashboard({ cooperativeId }: QueryInspectorProps) {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [performanceTrends, setPerformanceTrends] = useState<QueryPerformanceTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
  }, [cooperativeId]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // In a real implementation, these would be API calls
      const mockData: DashboardData = {
        overallHealth: 'good',
        categoryPerformance: {
          member_management: { executionTime: 45, memoryUsage: 2048, indexUsageScore: 85, cacheHitRatio: 0.92 },
          financial_operations: { executionTime: 120, memoryUsage: 8192, indexUsageScore: 78, cacheHitRatio: 0.85 },
          board_governance: { executionTime: 35, memoryUsage: 1536, indexUsageScore: 90, cacheHitRatio: 0.88 },
          apartment_operations: { executionTime: 65, memoryUsage: 3072, indexUsageScore: 82, cacheHitRatio: 0.90 },
          document_management: { executionTime: 80, memoryUsage: 4096, indexUsageScore: 75, cacheHitRatio: 0.83 }
        },
        complianceStatus: {
          gdpr: {
            regulation: 'GDPR/Dataskyddsförordningen',
            compliant: true,
            violations: [],
            recommendations: ['Implementera automatisk data-retention policy']
          },
          k2k3: {
            regulation: 'K2/K3 Redovisningsstandard',
            compliant: false,
            violations: ['3 finansiella frågor saknar fullständiga revisionsspår'],
            recommendations: ['Lägg till automatiska triggers för audit log', 'Implementera K3-kompatibel rapportering']
          },
          brl: {
            regulation: 'Bostadsrättslagen (BRL)',
            compliant: true,
            violations: [],
            recommendations: ['Förbättra transparens i styrelseprotokoll']
          }
        },
        topIssues: [
          '5 långsamma queries upptäckta senaste 24 timmarna',
          '2 GDPR-relevanta queries utan ordentlig loggning',
          'Index saknas för finansiella rapporter'
        ],
        optimizationOpportunities: [
          {
            type: 'index',
            description: 'Lägg till composite index för medlemshantering',
            priority: 'high',
            estimatedImpact: 60,
            brfContext: 'Förbättrar medlemsupplevelsen avsevärt'
          },
          {
            type: 'query_rewrite',
            description: 'Optimera finansiella rapporter för K2/K3-compliance',
            priority: 'critical',
            estimatedImpact: 45,
            brfContext: 'Säkerställer regelefterlevnad för svensk redovisning'
          }
        ],
        swedishRegulatoryStatus: {
          gdpr: true,
          k2k3: false,
          brl: true,
          pul: true
        }
      };

      // Mock performance trends
      const mockTrends: QueryPerformanceTrend[] = [
        { date: '2024-01-01', avgExecutionTime: 85, slowQueries: 12, totalQueries: 450 },
        { date: '2024-01-02', avgExecutionTime: 72, slowQueries: 8, totalQueries: 520 },
        { date: '2024-01-03', avgExecutionTime: 68, slowQueries: 5, totalQueries: 480 },
        { date: '2024-01-04', avgExecutionTime: 78, slowQueries: 9, totalQueries: 510 },
        { date: '2024-01-05', avgExecutionTime: 65, slowQueries: 4, totalQueries: 490 },
        { date: '2024-01-06', avgExecutionTime: 70, slowQueries: 6, totalQueries: 530 },
        { date: '2024-01-07', avgExecutionTime: 62, slowQueries: 3, totalQueries: 495 }
      ];

      setDashboardData(mockData);
      setPerformanceTrends(mockTrends);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBRFCategoryMetrics = (): BRFCategoryMetrics[] => {
    if (!dashboardData) return [];

    return Object.entries(dashboardData.categoryPerformance).map(([category, metrics]) => {
      const categoryInfo = BRF_CATEGORIES[category];
      const performance = metrics.indexUsageScore >= 85 ? 'excellent' : 
                         metrics.indexUsageScore >= 70 ? 'good' :
                         metrics.indexUsageScore >= 55 ? 'fair' : 'poor';
      
      return {
        category,
        displayName: categoryInfo?.displayName || category,
        icon: categoryInfo?.icon || Database,
        queries: Math.floor(Math.random() * 100) + 50, // Mock data
        avgTime: metrics.executionTime,
        performance,
        issues: performance === 'poor' ? 3 : performance === 'fair' ? 1 : 0,
        compliance: Math.random() > 0.3 // Mock compliance status
      };
    });
  };

  const getHealthBadgeVariant = (health: string) => {
    switch (health) {
      case 'excellent': return 'success';
      case 'good': return 'info'; 
      case 'fair': return 'warning';
      case 'poor': return 'destructive';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Fel vid laddning</AlertTitle>
        <AlertDescription>
          Kunde inte ladda dashboard-data. Försök igen senare.
        </AlertDescription>
      </Alert>
    );
  }

  const categoryMetrics = getBRFCategoryMetrics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Query Inspector</h1>
          <p className="text-muted-foreground">
            Databasövervakning och prestationsanalys för svensk BRF-hantering
          </p>
        </div>
        <Button onClick={loadDashboardData}>
          <Activity className="h-4 w-4 mr-2" />
          Uppdatera
        </Button>
      </div>

      {/* Overall Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Systemmets Allmänna Hälsa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge variant={getHealthBadgeVariant(dashboardData.overallHealth) as any} className="text-lg px-4 py-2">
                {dashboardData.overallHealth === 'excellent' && 'Utmärkt'}
                {dashboardData.overallHealth === 'good' && 'Bra'}
                {dashboardData.overallHealth === 'fair' && 'OK'}
                {dashboardData.overallHealth === 'poor' && 'Dåligt'}
              </Badge>
              <div className="text-sm text-muted-foreground">
                Systemets prestanda och regelefterlevnad
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Senast uppdaterad</div>
              <div className="text-sm font-medium">{new Date().toLocaleString('sv-SE')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Issues Alert */}
      {dashboardData.topIssues.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Viktiga Problem som Kräver Uppmärksamhet</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1">
              {dashboardData.topIssues.map((issue, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-red-500">•</span>
                  {issue}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Översikt</TabsTrigger>
          <TabsTrigger value="performance">Prestanda</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="optimization">Optimering</TabsTrigger>
          <TabsTrigger value="categories">BRF-Kategorier</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Performance Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Prestandatrender (7 dagar)</CardTitle>
              <CardDescription>
                Genomsnittlig exekveringstid och antal långsamma queries över tid
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={performanceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line 
                    yAxisId="left" 
                    type="monotone" 
                    dataKey="avgExecutionTime" 
                    stroke="#3b82f6" 
                    name="Snitt exekveringstid (ms)" 
                  />
                  <Line 
                    yAxisId="right" 
                    type="monotone" 
                    dataKey="slowQueries" 
                    stroke="#ef4444" 
                    name="Långsamma queries" 
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Förbättring denna vecka</p>
                    <p className="text-2xl font-bold">15%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Eye className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Övervakade queries</p>
                    <p className="text-2xl font-bold">3,247</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">GDPR-kompatibla</p>
                    <p className="text-2xl font-bold">98.5%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prestanda per BRF-kategori</CardTitle>
              <CardDescription>
                Genomsnittlig prestanda för olika områden i BRF-systemet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={Object.entries(dashboardData.categoryPerformance).map(([category, metrics]) => ({
                  category: BRF_CATEGORIES[category]?.displayName || category,
                  executionTime: metrics.executionTime,
                  indexScore: metrics.indexUsageScore
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="executionTime" fill="#3b82f6" name="Exekveringstid (ms)" />
                  <Bar yAxisId="right" dataKey="indexScore" fill="#10b981" name="Index-poäng" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          {/* Swedish Regulatory Compliance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Svensk Regelefterlevnad</CardTitle>
                <CardDescription>Status för svenska lagar och förordningar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(dashboardData.swedishRegulatoryStatus).map(([regulation, compliant]) => (
                  <div key={regulation} className="flex items-center justify-between">
                    <span className="font-medium">
                      {regulation === 'gdpr' && 'GDPR/Dataskyddsförordningen'}
                      {regulation === 'k2k3' && 'K2/K3 Redovisningsstandard'}
                      {regulation === 'brl' && 'Bostadsrättslagen'}
                      {regulation === 'pul' && 'Personuppgiftslagen'}
                    </span>
                    <Badge variant={compliant ? 'success' : 'destructive'}>
                      {compliant ? 'Kompatibel' : 'Behöver åtgärd'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detaljerad Compliance-status</CardTitle>
                <CardDescription>Specifika krav och rekommendationer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(dashboardData.complianceStatus).map(([key, status]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{status.regulation}</span>
                      <Badge variant={status.compliant ? 'success' : 'destructive'}>
                        {status.compliant ? 'OK' : 'Behöver åtgärd'}
                      </Badge>
                    </div>
                    {status.violations.length > 0 && (
                      <div className="text-sm text-red-600">
                        <strong>Överträdelser:</strong>
                        <ul className="ml-4 list-disc">
                          {status.violations.map((violation, idx) => (
                            <li key={idx}>{violation}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {status.recommendations.length > 0 && (
                      <div className="text-sm text-blue-600">
                        <strong>Rekommendationer:</strong>
                        <ul className="ml-4 list-disc">
                          {status.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Optimeringsmöjligheter</CardTitle>
              <CardDescription>
                Rekommenderade åtgärder för att förbättra prestanda och compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {dashboardData.optimizationOpportunities.map((opportunity, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">{opportunity.description}</h4>
                    <Badge variant={PRIORITY_COLORS[opportunity.priority] as any}>
                      {opportunity.priority === 'critical' && 'Kritiskt'}
                      {opportunity.priority === 'high' && 'Högt'}
                      {opportunity.priority === 'medium' && 'Medel'}
                      {opportunity.priority === 'low' && 'Lågt'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Typ:</span>
                      <span className="text-sm font-medium">{opportunity.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Förväntad förbättring:</span>
                      <span className="text-sm font-medium">{opportunity.estimatedImpact}%</span>
                    </div>
                  </div>
                  {opportunity.brfContext && (
                    <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                      <strong>BRF-kontext:</strong> {opportunity.brfContext}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryMetrics.map((metric) => {
              const IconComponent = metric.icon;
              return (
                <Card key={metric.category} className="relative">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconComponent className="h-5 w-5" />
                      {metric.displayName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Queries:</span>
                        <div className="font-medium">{metric.queries}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Snitt tid:</span>
                        <div className="font-medium">{metric.avgTime}ms</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Prestanda:</span>
                        <Badge variant={getHealthBadgeVariant(metric.performance) as any}>
                          {metric.performance === 'excellent' && 'Utmärkt'}
                          {metric.performance === 'good' && 'Bra'}
                          {metric.performance === 'fair' && 'OK'}
                          {metric.performance === 'poor' && 'Dåligt'}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Compliance:</span>
                        <Badge variant={metric.compliance ? 'success' : 'destructive'}>
                          {metric.compliance ? 'OK' : 'Problem'}
                        </Badge>
                      </div>
                    </div>

                    {metric.issues > 0 && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertTriangle className="h-4 w-4" />
                        {metric.issues} problem{metric.issues > 1 ? '' : ''} identifierade
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}