'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  Bell, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Mail,
  MessageSquare
} from 'lucide-react';

interface PerformanceAlert {
  id: string;
  alertName: string;
  alertType: 'threshold' | 'anomaly' | 'trend' | 'availability';
  metricName: string;
  metricCategory: 'system' | 'database' | 'api' | 'user_session' | 'brf_operations';
  thresholdValue?: number;
  thresholdOperator?: '>' | '<' | '>=' | '<=' | '=';
  thresholdDurationMinutes: number;
  isActive: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  notificationChannels: string[];
  notifyRoles: string[];
  notifyEmails: string[];
  suppressDurationMinutes: number;
  maxAlertsPerDay: number;
  lastTriggeredAt?: string;
  triggerCountToday: number;
  totalTriggerCount: number;
}

interface AlertManagerProps {
  cooperativeId: string;
}

const METRIC_OPTIONS = {
  system: [
    { value: 'cpu_usage', label: 'CPU-användning (%)' },
    { value: 'memory_usage', label: 'Minnesanvändning (%)' },
    { value: 'event_loop_lag', label: 'Event Loop Lag (ms)' },
    { value: 'uptime', label: 'Uptime (sekunder)' }
  ],
  database: [
    { value: 'query_response_time', label: 'Query-svarstid (ms)' },
    { value: 'slow_queries', label: 'Långsamma queries (antal)' },
    { value: 'query_errors', label: 'Query-fel (antal)' },
    { value: 'connection_count', label: 'Databasanslutningar' }
  ],
  api: [
    { value: 'response_time', label: 'API-svarstid (ms)' },
    { value: 'error_rate', label: 'Felfrekvens (%)' },
    { value: 'request_count', label: 'Förfrågningar per minut' },
    { value: '5xx_errors', label: '5xx-fel (antal)' }
  ],
  brf_operations: [
    { value: 'payment_collection_rate', label: 'Inbetalningsgrad (%)' },
    { value: 'overdue_payments', label: 'Förfallna betalningar (antal)' },
    { value: 'open_cases', label: 'Öppna ärenden (antal)' },
    { value: 'energy_cost_per_sqm', label: 'Energikostnad per kvm (SEK)' }
  ]
};

export default function AlertManager({ cooperativeId }: AlertManagerProps) {
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PerformanceAlert | null>(null);

  const [formData, setFormData] = useState({
    alertName: '',
    alertType: 'threshold' as const,
    metricName: '',
    metricCategory: 'system' as const,
    thresholdValue: 0,
    thresholdOperator: '>' as const,
    thresholdDurationMinutes: 5,
    isActive: true,
    severity: 'medium' as const,
    notificationChannels: ['email'],
    notifyRoles: ['admin'],
    notifyEmails: [] as string[],
    suppressDurationMinutes: 60,
    maxAlertsPerDay: 10,
  });

  useEffect(() => {
    fetchAlerts();
  }, [cooperativeId]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/monitoring/alerts?cooperativeId=${cooperativeId}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      const data = await response.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const method = editingAlert ? 'PUT' : 'POST';
      const url = editingAlert 
        ? `/api/monitoring/alerts/${editingAlert.id}` 
        : '/api/monitoring/alerts';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          cooperativeId,
          notificationChannels: JSON.stringify(formData.notificationChannels),
          notifyRoles: JSON.stringify(formData.notifyRoles),
          notifyEmails: JSON.stringify(formData.notifyEmails),
        }),
      });

      if (!response.ok) throw new Error('Failed to save alert');
      
      await fetchAlerts();
      setIsDialogOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save alert');
    }
  };

  const handleDelete = async (alertId: string) => {
    if (!confirm('Är du säker på att du vill ta bort detta larm?')) return;

    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete alert');
      await fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  };

  const handleToggleActive = async (alertId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) throw new Error('Failed to toggle alert');
      await fetchAlerts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle alert');
    }
  };

  const resetForm = () => {
    setFormData({
      alertName: '',
      alertType: 'threshold',
      metricName: '',
      metricCategory: 'system',
      thresholdValue: 0,
      thresholdOperator: '>',
      thresholdDurationMinutes: 5,
      isActive: true,
      severity: 'medium',
      notificationChannels: ['email'],
      notifyRoles: ['admin'],
      notifyEmails: [],
      suppressDurationMinutes: 60,
      maxAlertsPerDay: 10,
    });
    setEditingAlert(null);
  };

  const openEditDialog = (alert: PerformanceAlert) => {
    setEditingAlert(alert);
    setFormData({
      alertName: alert.alertName,
      alertType: alert.alertType,
      metricName: alert.metricName,
      metricCategory: alert.metricCategory,
      thresholdValue: alert.thresholdValue || 0,
      thresholdOperator: alert.thresholdOperator || '>',
      thresholdDurationMinutes: alert.thresholdDurationMinutes,
      isActive: alert.isActive,
      severity: alert.severity,
      notificationChannels: alert.notificationChannels,
      notifyRoles: alert.notifyRoles,
      notifyEmails: alert.notifyEmails,
      suppressDurationMinutes: alert.suppressDurationMinutes,
      maxAlertsPerDay: alert.maxAlertsPerDay,
    });
    setIsDialogOpen(true);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatLastTriggered = (timestamp?: string) => {
    if (!timestamp) return 'Aldrig';
    const date = new Date(timestamp);
    return date.toLocaleString('sv-SE');
  };

  if (loading) {
    return <div className="p-4">Laddar larm...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Larmhantering</h2>
          <p className="text-muted-foreground">
            Konfigurera och hantera prestandalarm för BRF-portalen
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Nytt Larm
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAlert ? 'Redigera Larm' : 'Skapa Nytt Larm'}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="alertName">Larmnamn</Label>
                  <Input
                    id="alertName"
                    value={formData.alertName}
                    onChange={(e) => setFormData(prev => ({ ...prev, alertName: e.target.value }))}
                    placeholder="T.ex. Hög CPU-användning"
                  />
                </div>
                
                <div>
                  <Label htmlFor="alertType">Larmtyp</Label>
                  <Select 
                    value={formData.alertType} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, alertType: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="threshold">Tröskelvärde</SelectItem>
                      <SelectItem value="anomaly">Anomali</SelectItem>
                      <SelectItem value="trend">Trend</SelectItem>
                      <SelectItem value="availability">Tillgänglighet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="metricCategory">Kategori</Label>
                  <Select 
                    value={formData.metricCategory} 
                    onValueChange={(value) => {
                      setFormData(prev => ({ 
                        ...prev, 
                        metricCategory: value as any,
                        metricName: '' // Reset metric when category changes
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="database">Databas</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="brf_operations">BRF-drift</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="metricName">Mätvärde</Label>
                  <Select 
                    value={formData.metricName} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, metricName: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Välj mätvärde" />
                    </SelectTrigger>
                    <SelectContent>
                      {METRIC_OPTIONS[formData.metricCategory]?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.alertType === 'threshold' && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="thresholdOperator">Operator</Label>
                    <Select 
                      value={formData.thresholdOperator} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, thresholdOperator: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=">">Större än (&gt;)</SelectItem>
                        <SelectItem value="<">Mindre än (&lt;)</SelectItem>
                        <SelectItem value=">=">Större än eller lika (&gt;=)</SelectItem>
                        <SelectItem value="<=">Mindre än eller lika (&lt;=)</SelectItem>
                        <SelectItem value="=">Lika med (=)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="thresholdValue">Tröskelvärde</Label>
                    <Input
                      id="thresholdValue"
                      type="number"
                      value={formData.thresholdValue}
                      onChange={(e) => setFormData(prev => ({ ...prev, thresholdValue: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="thresholdDuration">Varaktighet (min)</Label>
                    <Input
                      id="thresholdDuration"
                      type="number"
                      value={formData.thresholdDurationMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, thresholdDurationMinutes: parseInt(e.target.value) || 5 }))}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="severity">Allvarlighetsgrad</Label>
                  <Select 
                    value={formData.severity} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Låg</SelectItem>
                      <SelectItem value="medium">Medel</SelectItem>
                      <SelectItem value="high">Hög</SelectItem>
                      <SelectItem value="critical">Kritisk</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Aktivt larm</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="suppressDuration">Tystnadsperiod (min)</Label>
                  <Input
                    id="suppressDuration"
                    type="number"
                    value={formData.suppressDurationMinutes}
                    onChange={(e) => setFormData(prev => ({ ...prev, suppressDurationMinutes: parseInt(e.target.value) || 60 }))}
                  />
                </div>

                <div>
                  <Label htmlFor="maxAlerts">Max larm per dag</Label>
                  <Input
                    id="maxAlerts"
                    type="number"
                    value={formData.maxAlertsPerDay}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxAlertsPerDay: parseInt(e.target.value) || 10 }))}
                  />
                </div>
              </div>

              <div>
                <Label>E-postadresser (en per rad)</Label>
                <Textarea
                  value={formData.notifyEmails.join('\n')}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    notifyEmails: e.target.value.split('\n').filter(email => email.trim()) 
                  }))}
                  placeholder="exempel@brf.se"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Avbryt
                </Button>
                <Button onClick={handleSave}>
                  {editingAlert ? 'Uppdatera' : 'Skapa'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4">
        {alerts.map((alert) => (
          <Card key={alert.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold">{alert.alertName}</h3>
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    {alert.isActive ? (
                      <Badge variant="default">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Aktiv
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        Inaktiv
                      </Badge>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Mätvärde</p>
                      <p className="font-medium">
                        {METRIC_OPTIONS[alert.metricCategory]?.find(m => m.value === alert.metricName)?.label || alert.metricName}
                      </p>
                    </div>
                    
                    {alert.thresholdValue && (
                      <div>
                        <p className="text-muted-foreground">Tröskelvärde</p>
                        <p className="font-medium">
                          {alert.thresholdOperator} {alert.thresholdValue}
                        </p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-muted-foreground">Senast utlöst</p>
                      <p className="font-medium">{formatLastTriggered(alert.lastTriggeredAt)}</p>
                    </div>
                    
                    <div>
                      <p className="text-muted-foreground">Utlöst idag</p>
                      <p className="font-medium">{alert.triggerCountToday} / {alert.maxAlertsPerDay}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 mt-3 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Mail className="w-4 h-4 mr-1" />
                      {alert.notificationChannels.includes('email') && 'E-post'}
                      {alert.notificationChannels.includes('sms') && ' SMS'}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {alert.suppressDurationMinutes}min tystnadsperiod
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={alert.isActive}
                    onCheckedChange={(checked) => handleToggleActive(alert.id, checked)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditDialog(alert)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(alert.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {alerts.length === 0 && !loading && (
          <Card>
            <CardContent className="p-6 text-center">
              <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Inga larm konfigurerade</h3>
              <p className="text-muted-foreground mb-4">
                Skapa ditt första prestandalarm för att övervaka systemet
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Skapa Larm
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}