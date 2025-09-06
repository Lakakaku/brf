'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  Calendar, 
  Settings, 
  AlertTriangle, 
  CheckCircle,
  FastForward,
  Rewind,
  RefreshCw
} from 'lucide-react';
import { useTimeTravel, useTimeTravelScenarios } from '@/hooks/useTimeTravel';
import { formatSwedishDate, formatSwedishCurrency } from '@/lib/utils/time-travel';

/**
 * Time Travel Control Panel Component
 * 
 * Provides a comprehensive UI for controlling time manipulation during testing
 * of Swedish BRF (Bostadsrättförening) time-dependent features.
 */

export function TimeTravelPanel() {
  const timeTravel = useTimeTravel();
  const scenarios = useTimeTravelScenarios();
  
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState({
    years: 0,
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
  });

  const handleSetTime = () => {
    if (manualDate) {
      const dateTime = manualTime ? 
        new Date(`${manualDate}T${manualTime}:00`) : 
        new Date(manualDate);
      timeTravel.actions.setTime(dateTime);
    }
  };

  const handleAdvanceTime = () => {
    const nonZeroAmount = Object.fromEntries(
      Object.entries(advanceAmount).filter(([_, value]) => value !== 0)
    );
    
    if (Object.keys(nonZeroAmount).length > 0) {
      timeTravel.actions.advanceTime(nonZeroAmount);
    }
  };

  const getCurrentTimeDisplay = () => {
    return {
      date: formatSwedishDate(timeTravel.currentTime),
      time: timeTravel.currentTime.toLocaleTimeString('sv-SE'),
      full: timeTravel.currentTime.toLocaleString('sv-SE'),
    };
  };

  const getBRFContextInfo = () => {
    const { brfContext } = timeTravel;
    return [
      {
        label: 'Fiscal Year',
        value: brfContext.fiscalYear.fiscalYear,
        detail: `${brfContext.fiscalYear.daysUntilFiscalYearEnd} days until year end`,
      },
      {
        label: 'Payment Period',
        value: brfContext.paymentPeriod.currentMonth,
        detail: brfContext.paymentPeriod.isOverdue ? 
          'OVERDUE PAYMENTS' : 
          `${brfContext.paymentPeriod.daysUntilDue} days until payment due`,
        status: brfContext.paymentPeriod.isOverdue ? 'warning' : 'normal',
      },
      {
        label: 'Heating Period',
        value: brfContext.heatingPeriod.isHeatingPeriod ? 'Active' : 'Inactive',
        detail: brfContext.heatingPeriod.isHeatingPeriod ? 
          `Day ${brfContext.heatingPeriod.daysInHeatingPeriod} of heating season` :
          'Summer period - no heating costs',
        status: brfContext.heatingPeriod.isHeatingPeriod ? 'info' : 'normal',
      },
      {
        label: 'Maintenance Season',
        value: brfContext.maintenancePeriod.isMaintenanceSeason ? 'Active' : 'Inactive',
        detail: brfContext.maintenancePeriod.optimalMaintenanceWindow ? 
          'OPTIMAL MAINTENANCE WINDOW (Jun-Aug)' :
          brfContext.maintenancePeriod.isMaintenanceSeason ? 
            'Maintenance season (May-Sep)' : 
            'Winter period - limited maintenance',
        status: brfContext.maintenancePeriod.optimalMaintenanceWindow ? 'success' : 'normal',
      },
    ];
  };

  if (timeTravel.isLoading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            <span>Loading time travel state...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentTimeDisplay = getCurrentTimeDisplay();
  const brfContextInfo = getBRFContextInfo();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Travel Control Panel
              {timeTravel.timeTravelActive && (
                <Badge variant="secondary" className="ml-2">
                  Active
                </Badge>
              )}
              {timeTravel.frozen && (
                <Badge variant="outline" className="ml-2">
                  Frozen
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Control time for testing Swedish BRF time-dependent features
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={timeTravel.actions.refreshState}
            disabled={timeTravel.isLoading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {timeTravel.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{timeTravel.error}</AlertDescription>
          </Alert>
        )}

        {/* Current Time Display */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <div>
              <div className="text-2xl font-mono font-bold">
                {currentTimeDisplay.full}
              </div>
              <div className="text-sm text-muted-foreground">
                Europe/Stockholm timezone
                {timeTravel.timeTravelActive && (
                  <span className="ml-2 text-blue-600 font-medium">
                    (Time Travel Active)
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Real Time</div>
              <div className="font-mono text-sm">
                {timeTravel.realTime.toLocaleString('sv-SE')}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={timeTravel.frozen ? timeTravel.actions.unfreezeTime : timeTravel.actions.freezeTime}
              disabled={timeTravel.isLoading}
            >
              {timeTravel.frozen ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
              {timeTravel.frozen ? 'Unfreeze' : 'Freeze'} Time
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={timeTravel.actions.resetTime}
              disabled={timeTravel.isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Real Time
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => timeTravel.actions.advanceTime({ days: 1 })}
              disabled={timeTravel.isLoading}
            >
              <FastForward className="h-4 w-4 mr-2" />
              +1 Day
            </Button>
          </div>
        </div>

        <Separator />

        {/* Swedish BRF Context */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Swedish BRF Context</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {brfContextInfo.map((info, index) => (
              <div key={index} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{info.label}</span>
                  {info.status === 'warning' && (
                    <Badge variant="destructive" className="text-xs">Warning</Badge>
                  )}
                  {info.status === 'success' && (
                    <Badge variant="default" className="text-xs bg-green-600">Optimal</Badge>
                  )}
                  {info.status === 'info' && (
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  )}
                </div>
                <div className="text-lg font-semibold">{info.value}</div>
                <div className="text-sm text-muted-foreground">{info.detail}</div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Time Manipulation Controls */}
        <Tabs defaultValue="manual" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual Control</TabsTrigger>
            <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          
          <TabsContent value="manual" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Set Specific Date/Time */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Set Specific Date & Time
                </h4>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="manual-date">Date</Label>
                    <Input
                      id="manual-date"
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="manual-time">Time (optional)</Label>
                    <Input
                      id="manual-time"
                      type="time"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleSetTime} 
                    disabled={!manualDate || timeTravel.isLoading}
                    className="w-full"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    Set Time
                  </Button>
                </div>
              </div>

              {/* Advance Time */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold flex items-center gap-2">
                  <FastForward className="h-4 w-4" />
                  Advance Time
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Years</Label>
                    <Input
                      type="number"
                      min="0"
                      value={advanceAmount.years}
                      onChange={(e) => setAdvanceAmount(prev => ({
                        ...prev,
                        years: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Months</Label>
                    <Input
                      type="number"
                      min="0"
                      value={advanceAmount.months}
                      onChange={(e) => setAdvanceAmount(prev => ({
                        ...prev,
                        months: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Days</Label>
                    <Input
                      type="number"
                      min="0"
                      value={advanceAmount.days}
                      onChange={(e) => setAdvanceAmount(prev => ({
                        ...prev,
                        days: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Hours</Label>
                    <Input
                      type="number"
                      min="0"
                      value={advanceAmount.hours}
                      onChange={(e) => setAdvanceAmount(prev => ({
                        ...prev,
                        hours: parseInt(e.target.value) || 0
                      }))}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleAdvanceTime}
                  disabled={timeTravel.isLoading}
                  className="w-full"
                >
                  <FastForward className="h-4 w-4 mr-2" />
                  Advance Time
                </Button>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="scenarios" className="space-y-4">
            {scenarios.isLoading ? (
              <div className="text-center py-4">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                <div>Loading scenarios...</div>
              </div>
            ) : scenarios.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{scenarios.error}</AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Pre-configured scenarios for testing Swedish BRF features
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scenarios.scenarios?.scenarios.map((scenarioKey: string) => {
                    const scenarioDetails = scenarios.scenarios.details[scenarioKey];
                    return (
                      <Card key={scenarioKey} className="p-4">
                        <div className="space-y-3">
                          <div>
                            <div className="font-semibold">{scenarioDetails.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {scenarioDetails.description}
                            </div>
                          </div>
                          <div className="text-xs space-y-1">
                            <div><strong>Season:</strong> {scenarioDetails.context.season}</div>
                            <div><strong>Payment:</strong> {scenarioDetails.context.paymentContext}</div>
                            <div><strong>Context:</strong> {scenarioDetails.context.businessContext}</div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => timeTravel.actions.activateScenario(scenarioKey)}
                            disabled={timeTravel.isLoading}
                            className="w-full"
                          >
                            Activate Scenario
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="history" className="space-y-4">
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Recent time manipulations (latest first)
              </div>
              {timeTravel.manipulationHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No time manipulations recorded
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {[...timeTravel.manipulationHistory].reverse().map((entry, index) => (
                    <div key={index} className="p-3 border rounded-lg text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{entry.action.toUpperCase()}</span>
                        <span className="text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString('sv-SE')}
                        </span>
                      </div>
                      <div className="text-muted-foreground">{entry.description}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        From: {new Date(entry.fromTime).toLocaleString('sv-SE')} → 
                        To: {new Date(entry.toTime).toLocaleString('sv-SE')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}