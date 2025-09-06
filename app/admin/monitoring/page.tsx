'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PerformanceDashboard from '@/components/monitoring/PerformanceDashboard';
import AlertManager from '@/components/monitoring/AlertManager';
import { 
  Activity, 
  Bell, 
  Database, 
  Server, 
  BarChart3, 
  Settings,
  ExternalLink
} from 'lucide-react';

export default function MonitoringPage() {
  const [activeCooperativeId] = useState('demo-brf-123'); // Would come from context

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Systemövervakning</h1>
          <p className="text-muted-foreground">
            Prestanda, larm och systemhälsa för BRF-portalen
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Button variant="outline" asChild>
            <a href="http://localhost:3001" target="_blank" rel="noopener noreferrer">
              <BarChart3 className="w-4 h-4 mr-2" />
              Grafana
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
          
          <Button variant="outline" asChild>
            <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer">
              <Database className="w-4 h-4 mr-2" />
              Prometheus
              <ExternalLink className="w-4 h-4 ml-2" />
            </a>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center space-x-2">
            <Activity className="w-4 h-4" />
            <span>Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span>Larm</span>
          </TabsTrigger>
          <TabsTrigger value="infrastructure" className="flex items-center space-x-2">
            <Server className="w-4 h-4" />
            <span>Infrastruktur</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center space-x-2">
            <Settings className="w-4 h-4" />
            <span>Inställningar</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <PerformanceDashboard 
            cooperativeId={activeCooperativeId}
            refreshInterval={30000}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <AlertManager cooperativeId={activeCooperativeId} />
        </TabsContent>

        <TabsContent value="infrastructure" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Database className="w-5 h-5" />
                  <span>Databas</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Typ:</span>
                    <Badge variant="secondary">SQLite</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Storlek:</span>
                    <span className="text-sm font-medium">~50 MB</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4"
                  asChild
                >
                  <a href="http://localhost:8081" target="_blank" rel="noopener noreferrer">
                    Öppna SQLite Web
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="w-5 h-5" />
                  <span>Cache</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Typ:</span>
                    <Badge variant="secondary">Redis</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Minne:</span>
                    <span className="text-sm font-medium">64 MB / 256 MB</span>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: '25%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Övervakning</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Prometheus:</span>
                    <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Grafana:</span>
                    <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">AlertManager:</span>
                    <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Container Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    'brf-portal',
                    'prometheus',
                    'grafana',
                    'redis',
                    'nginx'
                  ].map((container) => (
                    <div key={container} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{container}</span>
                      <Badge className="bg-green-100 text-green-800">Running</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Säkerhetskopiering</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Senaste backup:</span>
                    <span className="text-sm font-medium">2024-01-15 03:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Nästa backup:</span>
                    <span className="text-sm font-medium">2024-01-16 03:00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge className="bg-green-100 text-green-800">OK</Badge>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  Skapa backup nu
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SSL/TLS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Certifikat:</span>
                    <Badge className="bg-green-100 text-green-800">Giltigt</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Utgår:</span>
                    <span className="text-sm font-medium">2024-04-15</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Auto-renewal:</span>
                    <Badge className="bg-green-100 text-green-800">Aktiv</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Övervakningsinställningar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Uppdateringsintervall</label>
                  <select className="w-full p-2 border rounded">
                    <option value="15">15 sekunder</option>
                    <option value="30" selected>30 sekunder</option>
                    <option value="60">1 minut</option>
                    <option value="300">5 minuter</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Datalagring</label>
                  <select className="w-full p-2 border rounded">
                    <option value="30">30 dagar</option>
                    <option value="90" selected>90 dagar</option>
                    <option value="180">180 dagar</option>
                    <option value="365">1 år</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="enable-alerts" defaultChecked />
                  <label htmlFor="enable-alerts" className="text-sm">Aktivera larm</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="detailed-logging" defaultChecked />
                  <label htmlFor="detailed-logging" className="text-sm">Detaljerad loggning</label>
                </div>

                <Button className="w-full">Spara inställningar</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notifikatonsinställningar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">E-postadress för larm</label>
                  <input 
                    type="email" 
                    className="w-full p-2 border rounded" 
                    placeholder="admin@brf.se"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">SMS-nummer (valfritt)</label>
                  <input 
                    type="tel" 
                    className="w-full p-2 border rounded" 
                    placeholder="+46 70 123 45 67"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Slack Webhook (valfritt)</label>
                  <input 
                    type="url" 
                    className="w-full p-2 border rounded" 
                    placeholder="https://hooks.slack.com/..."
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="email-notifications" defaultChecked />
                  <label htmlFor="email-notifications" className="text-sm">E-postnotifieringar</label>
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="critical-only" />
                  <label htmlFor="critical-only" className="text-sm">Endast kritiska larm</label>
                </div>

                <Button className="w-full">Spara notifieringar</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}