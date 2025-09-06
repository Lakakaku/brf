'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Activity, 
  Settings, 
  Play, 
  Pause, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Zap,
  Database,
  Globe,
  Shield,
  BarChart3
} from 'lucide-react';

interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  service_type: string;
  is_active: boolean;
  is_verified: boolean;
  consecutive_failures: number;
  total_events: number;
  successful_events: number;
  failed_events: number;
  avg_response_time_ms: number;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
}

interface WebhookEvent {
  id: string;
  event_id: string;
  event_type: string;
  source_service: string;
  delivery_status: string;
  response_status_code: number | null;
  response_time_ms: number | null;
  error_message: string | null;
  created_at: string;
  endpoint_name: string;
  is_test_event: boolean;
  is_replayed: boolean;
}

interface WebhookStats {
  total_events: number;
  delivered: number;
  failed: number;
  pending: number;
  retrying: number;
  avg_response_time: number;
  avg_payload_size: number;
}

export default function WebhookTestingDashboard() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Filters and pagination
  const [filters, setFilters] = useState({
    service_type: '',
    delivery_status: '',
    is_test_event: '',
    from_date: '',
    to_date: '',
  });
  
  // New endpoint form
  const [showNewEndpointForm, setShowNewEndpointForm] = useState(false);
  const [newEndpoint, setNewEndpoint] = useState({
    name: '',
    url: '',
    service_type: 'custom',
    secret: '',
    events: [] as string[],
    timeout_seconds: 30,
    retry_attempts: 3,
    is_active: true,
  });

  const cooperativeId = 'demo-cooperative'; // This would come from auth context

  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch endpoints and events in parallel
      const [endpointsResponse, eventsResponse] = await Promise.all([
        fetch(`/api/webhooks/endpoints?cooperative_id=${cooperativeId}&${new URLSearchParams(filters)}`),
        fetch(`/api/webhooks/events?cooperative_id=${cooperativeId}&limit=50&${new URLSearchParams(filters)}`)
      ]);

      if (!endpointsResponse.ok || !eventsResponse.ok) {
        throw new Error('Failed to fetch webhook data');
      }

      const endpointsData = await endpointsResponse.json();
      const eventsData = await eventsResponse.json();

      setEndpoints(endpointsData.endpoints || []);
      setEvents(eventsData.events || []);
      setStats(eventsData.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleEndpoint = async (endpointId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/webhooks/endpoints/${endpointId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          cooperative_id: cooperativeId,
          is_active: !isActive 
        }),
      });

      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle endpoint:', err);
    }
  };

  const createEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/webhooks/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newEndpoint,
          cooperative_id: cooperativeId,
        }),
      });

      if (response.ok) {
        setShowNewEndpointForm(false);
        setNewEndpoint({
          name: '',
          url: '',
          service_type: 'custom',
          secret: '',
          events: [],
          timeout_seconds: 30,
          retry_attempts: 3,
          is_active: true,
        });
        await fetchData();
      }
    } catch (err) {
      console.error('Failed to create endpoint:', err);
    }
  };

  const simulateWebhook = async (serviceType: string, scenario: string) => {
    try {
      const response = await fetch(`/api/webhooks/mocks/${serviceType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cooperative_id: cooperativeId,
          scenario,
          delay_seconds: 1,
        }),
      });

      if (response.ok) {
        // Refresh events after a short delay to show the new simulated events
        setTimeout(() => fetchData(), 2000);
      }
    } catch (err) {
      console.error('Failed to simulate webhook:', err);
    }
  };

  const replayEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/webhooks/events/${eventId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cooperative_id: cooperativeId,
        }),
      });

      if (response.ok) {
        setTimeout(() => fetchData(), 1000);
      }
    } catch (err) {
      console.error('Failed to replay event:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Webhook Testing Dashboard</h1>
          <p className="text-gray-600 mt-2">Test and monitor Swedish BRF webhook integrations</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowNewEndpointForm(true)} className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            New Endpoint
          </Button>
          <Button onClick={fetchData} variant="outline" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Events</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_events}</div>
              <p className="text-xs text-muted-foreground">Last 24 hours</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.total_events > 0 ? Math.round((stats.delivered / stats.total_events) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.delivered} delivered, {stats.failed} failed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Math.round(stats.avg_response_time || 0)}ms</div>
              <p className="text-xs text-muted-foreground">Average delivery time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Endpoints</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {endpoints.filter(e => e.is_active).length}
              </div>
              <p className="text-xs text-muted-foreground">
                of {endpoints.length} total
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="simulator">Simulator</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Recent Events */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Events</CardTitle>
                <CardDescription>Latest webhook deliveries</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {events.slice(0, 5).map((event) => (
                    <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant={getEventStatusVariant(event.delivery_status)}>
                          {event.delivery_status}
                        </Badge>
                        <div>
                          <div className="font-medium">{event.event_type}</div>
                          <div className="text-sm text-gray-500">{event.endpoint_name}</div>
                        </div>
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Endpoint Health */}
            <Card>
              <CardHeader>
                <CardTitle>Endpoint Health</CardTitle>
                <CardDescription>Monitor endpoint performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {endpoints.slice(0, 5).map((endpoint) => (
                    <div key={endpoint.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${endpoint.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <div className="font-medium">{endpoint.name}</div>
                          <div className="text-sm text-gray-500">{endpoint.service_type}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">
                          {endpoint.total_events > 0 ? 
                            Math.round((endpoint.successful_events / endpoint.total_events) * 100) : 0
                          }%
                        </div>
                        <div className="text-sm text-gray-500">
                          {endpoint.consecutive_failures > 0 && `${endpoint.consecutive_failures} failures`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Webhook Endpoints</CardTitle>
              <CardDescription>Manage your webhook endpoints</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {endpoints.map((endpoint) => (
                  <div key={endpoint.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={endpoint.is_active}
                        onCheckedChange={() => toggleEndpoint(endpoint.id, endpoint.is_active)}
                      />
                      <div>
                        <div className="font-medium">{endpoint.name}</div>
                        <div className="text-sm text-gray-500">{endpoint.url}</div>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline">{endpoint.service_type}</Badge>
                          {endpoint.is_verified && <Badge variant="outline" className="text-green-600">Verified</Badge>}
                          {endpoint.consecutive_failures > 0 && (
                            <Badge variant="destructive">{endpoint.consecutive_failures} failures</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">
                        {endpoint.total_events} events
                      </div>
                      <div className="text-xs text-gray-500">
                        {endpoint.avg_response_time_ms}ms avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Event Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div>
                  <Label>Service Type</Label>
                  <Select value={filters.service_type} onValueChange={(value) => setFilters({...filters, service_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="All services" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All services</SelectItem>
                      <SelectItem value="bankid">BankID</SelectItem>
                      <SelectItem value="fortnox">Fortnox</SelectItem>
                      <SelectItem value="kivra">Kivra</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={filters.delivery_status} onValueChange={(value) => setFilters({...filters, delivery_status: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="retrying">Retrying</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Test Events</Label>
                  <Select value={filters.is_test_event} onValueChange={(value) => setFilters({...filters, is_test_event: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="All events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All events</SelectItem>
                      <SelectItem value="true">Test only</SelectItem>
                      <SelectItem value="false">Real only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={fetchData} className="mt-6">
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Events Table */}
          <Card>
            <CardHeader>
              <CardTitle>Webhook Events</CardTitle>
              <CardDescription>Recent webhook deliveries and their status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant={getEventStatusVariant(event.delivery_status)}>
                        {event.delivery_status}
                      </Badge>
                      <div>
                        <div className="font-medium">{event.event_type}</div>
                        <div className="text-sm text-gray-500">
                          {event.endpoint_name} • {event.source_service}
                        </div>
                        <div className="flex gap-2 mt-1">
                          {event.is_test_event && <Badge variant="outline">Test</Badge>}
                          {event.is_replayed && <Badge variant="outline">Replayed</Badge>}
                          {event.response_status_code && (
                            <Badge variant="outline">HTTP {event.response_status_code}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm">
                        <div>{new Date(event.created_at).toLocaleString()}</div>
                        {event.response_time_ms && (
                          <div className="text-gray-500">{event.response_time_ms}ms</div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => replayEvent(event.event_id)}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Replay
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="simulator" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {/* BankID Simulator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  BankID
                </CardTitle>
                <CardDescription>Simulate Swedish BankID authentication flows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => simulateWebhook('bankid', 'success')} 
                  className="w-full"
                  variant="outline"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Successful Auth
                </Button>
                <Button 
                  onClick={() => simulateWebhook('bankid', 'user_cancel')} 
                  className="w-full"
                  variant="outline"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  User Cancel
                </Button>
                <Button 
                  onClick={() => simulateWebhook('bankid', 'timeout')} 
                  className="w-full"
                  variant="outline"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Timeout
                </Button>
              </CardContent>
            </Card>

            {/* Fortnox Simulator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Fortnox
                </CardTitle>
                <CardDescription>Simulate accounting system events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => simulateWebhook('fortnox', 'invoice_created')} 
                  className="w-full"
                  variant="outline"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Invoice Created
                </Button>
                <Button 
                  onClick={() => simulateWebhook('fortnox', 'invoice_paid')} 
                  className="w-full"
                  variant="outline"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Invoice Paid
                </Button>
                <Button 
                  onClick={() => simulateWebhook('fortnox', 'invoice_overdue')} 
                  className="w-full"
                  variant="outline"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Invoice Overdue
                </Button>
              </CardContent>
            </Card>

            {/* Kivra Simulator */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Kivra
                </CardTitle>
                <CardDescription>Simulate digital mailbox events</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => simulateWebhook('kivra', 'message_delivered')} 
                  className="w-full"
                  variant="outline"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Message Delivered
                </Button>
                <Button 
                  onClick={() => simulateWebhook('kivra', 'message_read')} 
                  className="w-full"
                  variant="outline"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Message Read
                </Button>
                <Button 
                  onClick={() => simulateWebhook('kivra', 'message_failed')} 
                  className="w-full"
                  variant="outline"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Delivery Failed
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Endpoint Modal */}
      {showNewEndpointForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Create New Webhook Endpoint</CardTitle>
              <CardDescription>Configure a new webhook endpoint for testing</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={createEndpoint} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newEndpoint.name}
                      onChange={(e) => setNewEndpoint({...newEndpoint, name: e.target.value})}
                      placeholder="My Test Endpoint"
                      required
                    />
                  </div>
                  <div>
                    <Label>Service Type</Label>
                    <Select 
                      value={newEndpoint.service_type} 
                      onValueChange={(value) => setNewEndpoint({...newEndpoint, service_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bankid">BankID</SelectItem>
                        <SelectItem value="fortnox">Fortnox</SelectItem>
                        <SelectItem value="kivra">Kivra</SelectItem>
                        <SelectItem value="payment">Payment</SelectItem>
                        <SelectItem value="notification">Notification</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <Label>Webhook URL</Label>
                  <Input
                    value={newEndpoint.url}
                    onChange={(e) => setNewEndpoint({...newEndpoint, url: e.target.value})}
                    placeholder="https://your-app.com/webhook"
                    type="url"
                    required
                  />
                </div>

                <div>
                  <Label>Secret (optional)</Label>
                  <Input
                    value={newEndpoint.secret}
                    onChange={(e) => setNewEndpoint({...newEndpoint, secret: e.target.value})}
                    placeholder="webhook_secret_key"
                    type="password"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Timeout (seconds)</Label>
                    <Input
                      value={newEndpoint.timeout_seconds}
                      onChange={(e) => setNewEndpoint({...newEndpoint, timeout_seconds: parseInt(e.target.value) || 30})}
                      type="number"
                      min="1"
                      max="300"
                    />
                  </div>
                  <div>
                    <Label>Retry Attempts</Label>
                    <Input
                      value={newEndpoint.retry_attempts}
                      onChange={(e) => setNewEndpoint({...newEndpoint, retry_attempts: parseInt(e.target.value) || 3})}
                      type="number"
                      min="0"
                      max="10"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={newEndpoint.is_active}
                    onCheckedChange={(checked) => setNewEndpoint({...newEndpoint, is_active: checked})}
                  />
                  <Label>Active</Label>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit">Create Endpoint</Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowNewEndpointForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function getEventStatusVariant(status: string) {
  switch (status) {
    case 'delivered':
      return 'default' as const; // Green
    case 'failed':
      return 'destructive' as const; // Red
    case 'pending':
      return 'secondary' as const; // Gray
    case 'retrying':
      return 'outline' as const; // Yellow
    default:
      return 'secondary' as const;
  }
}