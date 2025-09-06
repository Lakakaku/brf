/**
 * Admin Dashboard Home Page
 * Main overview dashboard with system status and quick access widgets
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import {
  Users,
  FileText,
  CreditCard,
  Calendar,
  Shield,
  Database,
  TestTube,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  Activity,
  Mail,
  Settings,
  BarChart3
} from 'lucide-react';

// Mock data - in real app this would come from API calls
const dashboardData = {
  stats: {
    totalUsers: 156,
    activeUsers: 142,
    totalDocuments: 89,
    pendingApprovals: 12,
    totalInvoices: 234,
    unpaidInvoices: 8,
    bookingsThisMonth: 45,
    systemHealth: 98
  },
  recentActivity: [
    {
      id: 1,
      action: 'Ny användare registrerad',
      user: 'Anna Andersson',
      timestamp: '2025-01-15 14:30',
      type: 'user'
    },
    {
      id: 2,
      action: 'Dokument godkänt',
      user: 'Per Svensson',
      timestamp: '2025-01-15 12:15',
      type: 'document'
    },
    {
      id: 3,
      action: 'Faktura betald',
      user: 'Maria Larsson',
      timestamp: '2025-01-15 10:45',
      type: 'invoice'
    },
    {
      id: 4,
      action: 'Bokning skapad',
      user: 'Erik Nilsson',
      timestamp: '2025-01-15 09:20',
      type: 'booking'
    }
  ],
  systemStatus: {
    database: 'healthy',
    authentication: 'healthy',
    email: 'warning',
    backups: 'healthy'
  }
};

const quickActions = [
  {
    title: 'Testa autentisering',
    description: 'Kör autentiseringstester',
    href: '/admin/auth',
    icon: Shield,
    badge: 'Test'
  },
  {
    title: 'Hantera användare',
    description: 'Visa och redigera användare',
    href: '/admin/users',
    icon: Users,
    badge: null
  },
  {
    title: 'Skicka testmail',
    description: 'Testa e-postfunktioner',
    href: '/admin/email/test',
    icon: Mail,
    badge: 'Test'
  },
  {
    title: 'Databas-verktyg',
    description: 'Hantera databas',
    href: '/admin/database',
    icon: Database,
    badge: 'Dev'
  }
];

function StatusIndicator({ status }: { status: string }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'error':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Frisk';
      case 'warning':
        return 'Varning';
      case 'error':
        return 'Fel';
      default:
        return 'Okänt';
    }
  };

  return (
    <Badge className={getStatusColor(status)}>
      {getStatusText(status)}
    </Badge>
  );
}

export default function AdminDashboard() {
  const { stats, recentActivity, systemStatus } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Översikt över systemstatus och snabbåtgärder för BRF Portal
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Användare</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">+{stats.activeUsers}</span> aktiva
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dokument</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-yellow-600">{stats.pendingApprovals}</span> väntar godkännande
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fakturor</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">{stats.unpaidInvoices}</span> obetalda
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bokningar</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bookingsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              denna månad
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Status and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Systemstatus</span>
            </CardTitle>
            <CardDescription>
              Aktuell status för systemkomponenter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Databas</span>
                </div>
                <StatusIndicator status={systemStatus.database} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Shield className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Autentisering</span>
                </div>
                <StatusIndicator status={systemStatus.authentication} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">E-post</span>
                </div>
                <StatusIndicator status={systemStatus.email} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Database className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">Säkerhetskopior</span>
                </div>
                <StatusIndicator status={systemStatus.backups} />
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Systemhälsa</span>
                  <span className="text-sm text-gray-600">{stats.systemHealth}%</span>
                </div>
                <Progress value={stats.systemHealth} className="w-full" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>Snabbåtgärder</span>
            </CardTitle>
            <CardDescription>
              Vanliga administrationsuppgifter
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-start space-y-2 w-full"
                  >
                    <div className="flex items-center space-x-2 w-full">
                      <action.icon className="h-4 w-4" />
                      {action.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {action.badge}
                        </Badge>
                      )}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{action.title}</p>
                      <p className="text-xs text-gray-500">{action.description}</p>
                    </div>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Senaste aktivitet</span>
          </CardTitle>
          <CardDescription>
            Nyligen genomförda åtgärder i systemet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3 py-2">
                <div className="flex-shrink-0">
                  {activity.type === 'user' && <Users className="h-4 w-4 text-blue-600" />}
                  {activity.type === 'document' && <FileText className="h-4 w-4 text-green-600" />}
                  {activity.type === 'invoice' && <CreditCard className="h-4 w-4 text-purple-600" />}
                  {activity.type === 'booking' && <Calendar className="h-4 w-4 text-orange-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.action}
                  </p>
                  <p className="text-xs text-gray-500">
                    {activity.user} • {activity.timestamp}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="pt-4 border-t">
            <Link href="/admin/users/activity">
              <Button variant="outline" size="sm">
                <BarChart3 className="h-4 w-4 mr-2" />
                Visa all aktivitet
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}