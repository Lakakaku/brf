'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Download, 
  Upload, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Memory,
  Globe,
  Code
} from 'lucide-react';

interface MockConfig {
  id: string;
  name: string;
  description?: string;
  service: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  scenario: string;
  delay_ms: number;
  response_status: number;
  response_data: Record<string, any>;
  headers?: Record<string, string>;
  is_enabled: boolean;
  environment: 'development' | 'staging' | 'production' | 'test';
  tags?: string[];
  usage_count?: number;
  last_used_at?: string;
  created_at: string;
  created_by_name?: string;
  source: 'database' | 'memory';
}

interface MockStatistics {
  total: number;
  enabled: number;
  services: number;
  byService: Record<string, {
    total: number;
    enabled: number;
    scenarios: string[];
    environments: string[];
  }>;
}

interface ServiceConfig {
  baseUrl: string;
  defaultHeaders: Record<string, string>;
  authentication?: {
    type: string;
    config: Record<string, any>;
  };
  rateLimit?: {
    requests: number;
    windowMs: number;
  };
}

interface MockManagerDashboardProps {
  cooperativeId: string;
}

const MockManagerDashboard: React.FC<MockManagerDashboardProps> = ({ cooperativeId }) => {
  const [mockConfigs, setMockConfigs] = useState<MockConfig[]>([]);
  const [statistics, setStatistics] = useState<MockStatistics | null>(null);
  const [services, setServices] = useState<Record<string, ServiceConfig>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MockConfig | null>(null);
  const [testingConfig, setTestingConfig] = useState<string | null>(null);

  // Form states for creating/editing mocks
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    service: '',
    endpoint: '',
    method: 'POST' as const,
    scenario: '',
    delayMs: 0,
    responseStatus: 200,
    responseData: '{}',
    headers: '{}',
    isEnabled: true,
    environment: 'development' as const,
    tags: '',
  });

  useEffect(() => {
    fetchMockConfigs();
  }, [cooperativeId]);

  const fetchMockConfigs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/mocks?cooperative_id=${cooperativeId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch mock configurations');
      }
      
      const data = await response.json();
      setMockConfigs(data.configurations);
      setStatistics(data.statistics);
      setServices(data.available_services);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMock = async () => {
    try {
      let responseData, headers;
      
      try {
        responseData = JSON.parse(formData.responseData);
      } catch {
        throw new Error('Invalid JSON in response data');
      }
      
      try {
        headers = formData.headers ? JSON.parse(formData.headers) : {};
      } catch {
        throw new Error('Invalid JSON in headers');
      }

      const payload = {
        cooperative_id: cooperativeId,
        name: formData.name,
        description: formData.description || undefined,
        service: formData.service,
        endpoint: formData.endpoint,
        method: formData.method,
        scenario: formData.scenario,
        delayMs: formData.delayMs,
        responseStatus: formData.responseStatus,
        responseData,
        headers,
        isEnabled: formData.isEnabled,
        environment: formData.environment,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
      };

      const response = await fetch('/api/mocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create mock configuration');
      }

      setIsCreateDialogOpen(false);
      resetFormData();
      await fetchMockConfigs();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEditMock = async (config: MockConfig) => {
    setEditingConfig(config);
    setFormData({
      name: config.name,
      description: config.description || '',
      service: config.service,
      endpoint: config.endpoint,
      method: config.method,
      scenario: config.scenario,
      delayMs: config.delay_ms,
      responseStatus: config.response_status,
      responseData: JSON.stringify(config.response_data, null, 2),
      headers: JSON.stringify(config.headers || {}, null, 2),
      isEnabled: config.is_enabled,
      environment: config.environment,
      tags: config.tags?.join(', ') || '',
    });
  };

  const handleUpdateMock = async () => {
    if (!editingConfig) return;

    try {
      let responseData, headers;
      
      try {
        responseData = JSON.parse(formData.responseData);
      } catch {
        throw new Error('Invalid JSON in response data');
      }
      
      try {
        headers = formData.headers ? JSON.parse(formData.headers) : {};
      } catch {
        throw new Error('Invalid JSON in headers');
      }

      const payload = {
        cooperative_id: cooperativeId,
        name: formData.name,
        description: formData.description || undefined,
        delayMs: formData.delayMs,
        responseStatus: formData.responseStatus,
        responseData,
        headers,
        isEnabled: formData.isEnabled,
        environment: formData.environment,
        tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : [],
      };

      const response = await fetch(`/api/mocks/${editingConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update mock configuration');
      }

      setEditingConfig(null);
      resetFormData();
      await fetchMockConfigs();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggleMock = async (configId: string, enabled: boolean) => {
    try {
      const response = await fetch(`/api/mocks/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enabled, 
          cooperative_id: cooperativeId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle mock configuration');
      }

      await fetchMockConfigs();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteMock = async (configId: string) => {
    if (!confirm('Are you sure you want to delete this mock configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/mocks/${configId}?cooperative_id=${cooperativeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete mock configuration');
      }

      await fetchMockConfigs();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleTestMock = async (config: MockConfig) => {
    setTestingConfig(config.id);
    
    try {
      // Simulate a test request to the mock endpoint
      const testPayload = {
        cooperative_id: cooperativeId,
        scenario: config.scenario,
        delay_seconds: Math.floor(config.delay_ms / 1000),
      };

      const mockEndpoint = `/api/webhooks/mocks/${config.service}`;
      const response = await fetch(mockEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      if (response.ok) {
        alert('Mock test initiated successfully! Check webhook events for results.');
      } else {
        const errorData = await response.json();
        alert(`Mock test failed: ${errorData.error}`);
      }
    } catch (err) {
      alert(`Mock test failed: ${err.message}`);
    } finally {
      setTestingConfig(null);
    }
  };

  const resetFormData = () => {
    setFormData({
      name: '',
      description: '',
      service: '',
      endpoint: '',
      method: 'POST',
      scenario: '',
      delayMs: 0,
      responseStatus: 200,
      responseData: '{}',
      headers: '{}',
      isEnabled: true,
      environment: 'development',
      tags: '',
    });
  };

  const exportConfigs = () => {
    const dataStr = JSON.stringify(mockConfigs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `brf-mock-configs-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const filteredConfigs = mockConfigs.filter(config => {
    return (selectedService === 'all' || config.service === selectedService) &&
           (selectedEnvironment === 'all' || config.environment === selectedEnvironment);
  });

  const getStatusIcon = (config: MockConfig) => {
    if (!config.is_enabled) {
      return <Pause className="h-4 w-4 text-gray-500" />;
    }
    return <Play className="h-4 w-4 text-green-500" />;
  };

  const getSourceIcon = (source: string) => {
    return source === 'database' ? 
      <Database className="h-4 w-4 text-blue-500" title="Database" /> :
      <Memory className="h-4 w-4 text-purple-500" title="Memory" />;
  };

  const getMethodColor = (method: string) => {
    const colors = {
      GET: 'bg-blue-100 text-blue-800',
      POST: 'bg-green-100 text-green-800',
      PUT: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      PATCH: 'bg-purple-100 text-purple-800',
    };
    return colors[method] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading mock configurations...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Mocks</p>
                  <p className="text-2xl font-bold">{statistics.total}</p>
                </div>
                <Settings className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Active Mocks</p>
                  <p className="text-2xl font-bold text-green-600">{statistics.enabled}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Services</p>
                  <p className="text-2xl font-bold">{statistics.services}</p>
                </div>
                <Globe className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Inactive Mocks</p>
                  <p className="text-2xl font-bold text-red-600">{statistics.total - statistics.enabled}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>API Mock Response Manager</CardTitle>
          <CardDescription>
            Manage mock responses for Swedish BRF services including BankID, Fortnox, Kivra, and Swedish banks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <div>
                <Label htmlFor="service-filter">Service</Label>
                <Select value={selectedService} onValueChange={setSelectedService}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Services</SelectItem>
                    {Object.keys(services).map(service => (
                      <SelectItem key={service} value={service}>
                        {service.charAt(0).toUpperCase() + service.slice(1).replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="environment-filter">Environment</Label>
                <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="development">Development</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="test">Test</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={exportConfigs}
                disabled={mockConfigs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Mock
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mock Configurations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mock Configurations ({filteredConfigs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Scenario</TableHead>
                  <TableHead>Delay</TableHead>
                  <TableHead>Status Code</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConfigs.map((config) => (
                  <TableRow key={config.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(config)}
                        <Switch
                          checked={config.is_enabled}
                          onCheckedChange={(enabled) => handleToggleMock(config.id, enabled)}
                          size="sm"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{config.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {config.service.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{config.endpoint}</TableCell>
                    <TableCell>
                      <Badge className={getMethodColor(config.method)}>
                        {config.method}
                      </Badge>
                    </TableCell>
                    <TableCell>{config.scenario}</TableCell>
                    <TableCell>
                      {config.delay_ms > 0 && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {config.delay_ms}ms
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.response_status < 400 ? "default" : "destructive"}>
                        {config.response_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{config.environment}</Badge>
                    </TableCell>
                    <TableCell>
                      {getSourceIcon(config.source)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTestMock(config)}
                          disabled={testingConfig === config.id}
                        >
                          {testingConfig === config.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditMock(config)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteMock(config.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredConfigs.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No mock configurations found. Create your first mock to get started.
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Mock Dialog */}
      <Dialog open={isCreateDialogOpen || editingConfig !== null} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setEditingConfig(null);
          resetFormData();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Edit Mock Configuration' : 'Create Mock Configuration'}
            </DialogTitle>
            <DialogDescription>
              Configure a new API mock response for testing and development.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="mock-name">Name *</Label>
              <Input
                id="mock-name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="Mock configuration name"
              />
            </div>
            
            <div>
              <Label htmlFor="mock-service">Service *</Label>
              <Select value={formData.service} onValueChange={(value) => setFormData({...formData, service: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(services).map(service => (
                    <SelectItem key={service} value={service}>
                      {service.charAt(0).toUpperCase() + service.slice(1).replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="mock-endpoint">Endpoint *</Label>
              <Input
                id="mock-endpoint"
                value={formData.endpoint}
                onChange={(e) => setFormData({...formData, endpoint: e.target.value})}
                placeholder="/api/endpoint"
              />
            </div>
            
            <div>
              <Label htmlFor="mock-method">Method *</Label>
              <Select value={formData.method} onValueChange={(value) => setFormData({...formData, method: value as any})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="mock-scenario">Scenario *</Label>
              <Input
                id="mock-scenario"
                value={formData.scenario}
                onChange={(e) => setFormData({...formData, scenario: e.target.value})}
                placeholder="success, failure, timeout, etc."
              />
            </div>
            
            <div>
              <Label htmlFor="mock-environment">Environment</Label>
              <Select value={formData.environment} onValueChange={(value) => setFormData({...formData, environment: value as any})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="production">Production</SelectItem>
                  <SelectItem value="test">Test</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="mock-delay">Delay (ms)</Label>
              <Input
                id="mock-delay"
                type="number"
                min="0"
                max="30000"
                value={formData.delayMs}
                onChange={(e) => setFormData({...formData, delayMs: parseInt(e.target.value) || 0})}
              />
            </div>
            
            <div>
              <Label htmlFor="mock-status">Response Status</Label>
              <Input
                id="mock-status"
                type="number"
                min="100"
                max="599"
                value={formData.responseStatus}
                onChange={(e) => setFormData({...formData, responseStatus: parseInt(e.target.value) || 200})}
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="mock-description">Description</Label>
              <Input
                id="mock-description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Optional description"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="mock-tags">Tags (comma separated)</Label>
              <Input
                id="mock-tags"
                value={formData.tags}
                onChange={(e) => setFormData({...formData, tags: e.target.value})}
                placeholder="test, brf, payment"
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="mock-response">Response Data (JSON) *</Label>
              <Textarea
                id="mock-response"
                value={formData.responseData}
                onChange={(e) => setFormData({...formData, responseData: e.target.value})}
                rows={8}
                className="font-mono text-sm"
                placeholder='{"message": "Success", "data": {}}'
              />
            </div>
            
            <div className="col-span-2">
              <Label htmlFor="mock-headers">Headers (JSON)</Label>
              <Textarea
                id="mock-headers"
                value={formData.headers}
                onChange={(e) => setFormData({...formData, headers: e.target.value})}
                rows={4}
                className="font-mono text-sm"
                placeholder='{"Content-Type": "application/json"}'
              />
            </div>
            
            <div className="col-span-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="mock-enabled"
                  checked={formData.isEnabled}
                  onCheckedChange={(checked) => setFormData({...formData, isEnabled: checked})}
                />
                <Label htmlFor="mock-enabled">Enable this mock</Label>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setEditingConfig(null);
                resetFormData();
              }}
            >
              Cancel
            </Button>
            <Button onClick={editingConfig ? handleUpdateMock : handleCreateMock}>
              {editingConfig ? 'Update Mock' : 'Create Mock'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MockManagerDashboard;