'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Database, 
  Server, 
  Clock, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Home,
  Zap
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface SystemMetrics {
  cpuUsage: number;
  memoryUsage: number;
  memoryTotal: number;
  uptime: number;
  eventLoopLag: number;
}

interface DatabaseMetrics {
  totalQueries: number;
  slowQueries: number;
  averageResponseTime: number;
  queriesByType: Record<string, number>;
  topSlowQueries: Array<{
    query: string;
    executionTime: number;
    table: string;
  }>;
}

interface ApiMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  requestsByEndpoint: Array<{
    endpoint: string;
    count: number;
    avgResponseTime: number;
  }>;
  statusCodes: Record<string, number>;
}

interface BrfMetrics {
  activeMembers: number;
  monthlyFeeCollectionRate: number;
  openCases: number;
  energyCostPerSqm: number;
  invoicesProcessed: number;
  overduePayments: number;
  bookingUtilization: number;
}

interface PerformanceData {
  system: SystemMetrics;
  database: DatabaseMetrics;
  api: ApiMetrics;
  brf: BrfMetrics;
  alerts: Array<{
    id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

interface PerformanceDashboardProps {
  cooperativeId: string;
  refreshInterval?: number; // milliseconds
}

export default function PerformanceDashboard({ 
  cooperativeId, 
  refreshInterval = 30000 
}: PerformanceDashboardProps) {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const fetchPerformanceData = useCallback(async () => {
    try {
      const response = await fetch(`/api/monitoring/dashboard?cooperativeId=${cooperativeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }
      const result = await response.json();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [cooperativeId]);

  useEffect(() => {
    fetchPerformanceData();
    
    const interval = setInterval(fetchPerformanceData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPerformanceData, refreshInterval]);

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          {error || 'Failed to load performance data'}
        </AlertDescription>
      </Alert>
    );
  }

  const CHART_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prestationsövervakning</h2>
          <p className="text-muted-foreground">
            Systemövervakning för BRF-portalen
            {lastUpdated && (
              <span className="ml-2 text-sm">
                Senast uppdaterad: {lastUpdated.toLocaleTimeString('sv-SE')}
              </span>
            )}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <Activity className="w-4 h-4 mr-1" />
          Live
        </Badge>
      </div>

      {/* Active Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Aktiva Larm</h3>
          {data.alerts.map((alert) => (
            <Alert key={alert.id} className="border-destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="flex justify-between items-center">
                <span>{alert.message}</span>
                <Badge variant={getSeverityColor(alert.severity)}>
                  {alert.severity}
                </Badge>
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Server className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">CPU-användning</p>
                <p className="text-2xl font-bold">
                  {data.system.cpuUsage.toFixed(1)}%
                </p>
              </div>
            </div>
            <Progress value={data.system.cpuUsage} className="mt-3" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Databassvar (ms)</p>
                <p className="text-2xl font-bold">
                  {data.database.averageResponseTime.toFixed(0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">API-svarstid (ms)</p>
                <p className="text-2xl font-bold">
                  {data.api.averageResponseTime.toFixed(0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aktiva medlemmar</p>
                <p className="text-2xl font-bold">
                  {data.brf.activeMembers}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="system" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="database">Databas</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="brf">BRF-metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Systemresurser</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Minne</span>
                      <span>{formatBytes(data.system.memoryUsage)} / {formatBytes(data.system.memoryTotal)}</span>
                    </div>
                    <Progress value={(data.system.memoryUsage / data.system.memoryTotal) * 100} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Uptime</p>
                      <p className="font-semibold">{formatUptime(data.system.uptime)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Event Loop Lag</p>
                      <p className="font-semibold">{data.system.eventLoopLag.toFixed(2)} ms</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API-statuskoder</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={Object.entries(data.api.statusCodes).map(([code, count]) => ({
                        name: code,
                        value: count
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {Object.entries(data.api.statusCodes).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Databasstatistik</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{data.database.totalQueries}</p>
                    <p className="text-sm text-muted-foreground">Totala queries</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{data.database.slowQueries}</p>
                    <p className="text-sm text-muted-foreground">Långsamma queries</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Query-typer</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={Object.entries(data.database.queriesByType).map(([type, count]) => ({
                      type,
                      count
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {data.database.topSlowQueries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Långsammaste queries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.database.topSlowQueries.slice(0, 5).map((query, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-mono text-sm truncate">{query.query}</p>
                        <p className="text-xs text-muted-foreground">Tabell: {query.table}</p>
                      </div>
                      <Badge variant="secondary">
                        {query.executionTime.toFixed(0)} ms
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold">{data.api.totalRequests}</p>
                <p className="text-sm text-muted-foreground">Totala förfrågningar</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold">{data.api.averageResponseTime.toFixed(0)} ms</p>
                <p className="text-sm text-muted-foreground">Genomsnittlig svarstid</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-2xl font-bold text-red-600">{data.api.errorRate.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Felfrekvens</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>API-endpoints prestanda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.api.requestsByEndpoint.slice(0, 10).map((endpoint, index) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <div className="flex-1">
                      <p className="font-mono text-sm">{endpoint.endpoint}</p>
                      <p className="text-xs text-muted-foreground">{endpoint.count} förfrågningar</p>
                    </div>
                    <Badge variant="secondary">
                      {endpoint.avgResponseTime.toFixed(0)} ms
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="brf" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Inbetalningsgrad</p>
                    <p className="text-2xl font-bold">
                      {data.brf.monthlyFeeCollectionRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <Progress value={data.brf.monthlyFeeCollectionRate} className="mt-3" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Öppna ärenden</p>
                    <p className="text-2xl font-bold">{data.brf.openCases}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Zap className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Energikostnad/kvm</p>
                    <p className="text-2xl font-bold">
                      {data.brf.energyCostPerSqm.toFixed(0)} kr
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Home className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Bokningsnyttjande</p>
                    <p className="text-2xl font-bold">
                      {data.brf.bookingUtilization.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <Progress value={data.brf.bookingUtilization} className="mt-3" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Finansiell översikt</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Fakturor bearbetade</span>
                    <span className="font-semibold">{data.brf.invoicesProcessed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Förfallna betalningar</span>
                    <span className="font-semibold text-red-600">{data.brf.overduePayments}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Inbetalningsgrad</span>
                    <span className="font-semibold">
                      {data.brf.monthlyFeeCollectionRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Energieffektivitet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold text-green-600">
                    {data.brf.energyCostPerSqm.toFixed(0)}
                  </p>
                  <p className="text-sm text-muted-foreground">SEK per kvm/år</p>
                  <div className="mt-4 text-xs text-muted-foreground">
                    Baserat på senaste 12 månaderna
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}