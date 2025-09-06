/**
 * Feature Flags Admin Dashboard
 * Main page for managing feature flags in the BRF Portal
 */

'use client';

import React, { useState, useMemo } from 'react';
import { useFeatureFlagManagement } from '@/hooks/useFeatureFlags';
import { FeatureFlag, FeatureCategory, FeatureStatus } from '@/lib/features/types';
import FeatureFlagCard from '@/components/features/FeatureFlagCard';
import FeatureFlagForm from '@/components/features/FeatureFlagForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Plus,
  Search,
  Filter,
  RefreshCw,
  BarChart3,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Globe
} from 'lucide-react';

export default function FeaturesPage() {
  // TODO: Get cooperative ID from session/context
  const cooperativeId = undefined;
  
  const { 
    flags, 
    isLoading, 
    error, 
    createFlag, 
    updateFlag, 
    toggleFlag, 
    deleteFlag, 
    refresh 
  } = useFeatureFlagManagement(cooperativeId);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FeatureCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<FeatureStatus | 'all'>('all');
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | undefined>();

  // Filter and search flags
  const filteredFlags = useMemo(() => {
    return flags.filter(flag => {
      const matchesSearch = !searchQuery || 
        flag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flag.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flag.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = selectedCategory === 'all' || flag.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || flag.status === selectedStatus;
      const matchesEnvironment = selectedEnvironment === 'all' || flag.environment === selectedEnvironment;

      return matchesSearch && matchesCategory && matchesStatus && matchesEnvironment;
    });
  }, [flags, searchQuery, selectedCategory, selectedStatus, selectedEnvironment]);

  // Group flags by category for better organization
  const flagsByCategory = useMemo(() => {
    const groups: Record<FeatureCategory, FeatureFlag[]> = {
      general: [],
      auth: [],
      payments: [],
      documents: [],
      bookings: [],
      admin: [],
      ui: [],
      api: [],
    };

    filteredFlags.forEach(flag => {
      groups[flag.category].push(flag);
    });

    return groups;
  }, [filteredFlags]);

  // Statistics
  const stats = useMemo(() => {
    const total = flags.length;
    const enabled = flags.filter(f => f.is_enabled && f.status === 'active').length;
    const expired = flags.filter(f => f.expires_at && new Date(f.expires_at) < new Date()).length;
    const global = flags.filter(f => f.cooperative_id === null).length;

    return { total, enabled, expired, global };
  }, [flags]);

  const handleCreateFlag = () => {
    setEditingFlag(undefined);
    setIsFormOpen(true);
  };

  const handleEditFlag = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setIsFormOpen(true);
  };

  const handleDuplicateFlag = (flag: FeatureFlag) => {
    setEditingFlag({
      ...flag,
      id: '',
      key: `${flag.key}_copy`,
      name: `${flag.name} (Kopia)`,
      is_enabled: false,
      created_at: '',
      updated_at: '',
    } as FeatureFlag);
    setIsFormOpen(true);
  };

  const handleSaveFlag = async (flagData: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingFlag && editingFlag.id) {
      await updateFlag(editingFlag.id, flagData);
    } else {
      await createFlag(flagData);
    }
    setIsFormOpen(false);
    setEditingFlag(undefined);
  };

  const handleToggleFlag = async (id: string, enabled: boolean) => {
    await toggleFlag(id, enabled);
  };

  const handleDeleteFlag = async (id: string) => {
    if (confirm('Är du säker på att du vill ta bort denna feature flag?')) {
      await deleteFlag(id);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedEnvironment('all');
  };

  if (error) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Fel vid laddning av feature flags: {error}
          </AlertDescription>
        </Alert>
        <Button onClick={refresh} variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Försök igen
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Feature Flags</h1>
          <p className="mt-2 text-gray-600">
            Hantera och kontrollera systemfunktioner med feature flags för säker utrullning och testning.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={refresh} variant="outline" disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Uppdatera
          </Button>
          <Button onClick={handleCreateFlag}>
            <Plus className="mr-2 h-4 w-4" />
            Ny Feature Flag
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totalt</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Feature flags</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiverade</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.enabled / stats.total) * 100) : 0}% av totalt
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utgångna</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats.expired}</div>
            <p className="text-xs text-muted-foreground">Kräver uppmärksamhet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Globala</CardTitle>
            <Globe className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.global}</div>
            <p className="text-xs text-muted-foreground">Gäller alla BRF:er</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter och sök
          </CardTitle>
          <CardDescription>
            Filtrera feature flags efter kategori, status och miljö.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Sök efter namn, nyckel eller beskrivning..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as FeatureCategory | 'all')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kategorier</SelectItem>
                <SelectItem value="general">Allmänt</SelectItem>
                <SelectItem value="auth">Autentisering</SelectItem>
                <SelectItem value="payments">Betalningar</SelectItem>
                <SelectItem value="documents">Dokument</SelectItem>
                <SelectItem value="bookings">Bokningar</SelectItem>
                <SelectItem value="admin">Administration</SelectItem>
                <SelectItem value="ui">UI/UX</SelectItem>
                <SelectItem value="api">API</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as FeatureStatus | 'all')}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla status</SelectItem>
                <SelectItem value="draft">Utkast</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="archived">Arkiverad</SelectItem>
                <SelectItem value="deprecated">Föråldrad</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Miljö" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla miljöer</SelectItem>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters}>
              Rensa filter
            </Button>
          </div>

          {(searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedEnvironment !== 'all') && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-gray-500">Aktiva filter:</span>
              {searchQuery && <Badge variant="secondary">Sök: "{searchQuery}"</Badge>}
              {selectedCategory !== 'all' && <Badge variant="secondary">Kategori: {selectedCategory}</Badge>}
              {selectedStatus !== 'all' && <Badge variant="secondary">Status: {selectedStatus}</Badge>}
              {selectedEnvironment !== 'all' && <Badge variant="secondary">Miljö: {selectedEnvironment}</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Flags Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Laddar feature flags...</p>
          </div>
        </div>
      ) : filteredFlags.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Inga feature flags hittades</h3>
            <p className="text-gray-600 mb-4">
              {flags.length === 0 
                ? 'Det finns inga feature flags än. Skapa din första för att komma igång.'
                : 'Inga feature flags matchar dina filterkriterier.'
              }
            </p>
            {flags.length === 0 ? (
              <Button onClick={handleCreateFlag}>
                <Plus className="mr-2 h-4 w-4" />
                Skapa första feature flag
              </Button>
            ) : (
              <Button variant="outline" onClick={clearFilters}>
                Rensa filter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="grid" className="space-y-4">
          <TabsList>
            <TabsTrigger value="grid">Rutnätsvy</TabsTrigger>
            <TabsTrigger value="category">Kategorier</TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFlags.map((flag) => (
                <FeatureFlagCard
                  key={flag.id}
                  flag={flag}
                  onToggle={handleToggleFlag}
                  onEdit={handleEditFlag}
                  onDelete={handleDeleteFlag}
                  onDuplicate={handleDuplicateFlag}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="category" className="space-y-6">
            {Object.entries(flagsByCategory).map(([category, categoryFlags]) => {
              if (categoryFlags.length === 0) return null;
              
              return (
                <div key={category} className="space-y-4">
                  <h3 className="text-lg font-semibold capitalize flex items-center gap-2">
                    {category === 'general' && 'Allmänt'}
                    {category === 'auth' && 'Autentisering'}
                    {category === 'payments' && 'Betalningar'}
                    {category === 'documents' && 'Dokument'}
                    {category === 'bookings' && 'Bokningar'}
                    {category === 'admin' && 'Administration'}
                    {category === 'ui' && 'UI/UX'}
                    {category === 'api' && 'API'}
                    <Badge variant="secondary">{categoryFlags.length}</Badge>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categoryFlags.map((flag) => (
                      <FeatureFlagCard
                        key={flag.id}
                        flag={flag}
                        onToggle={handleToggleFlag}
                        onEdit={handleEditFlag}
                        onDelete={handleDeleteFlag}
                        onDuplicate={handleDuplicateFlag}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      )}

      {/* Feature Flag Form Dialog */}
      <FeatureFlagForm
        flag={editingFlag}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingFlag(undefined);
        }}
        onSave={handleSaveFlag}
        cooperativeId={cooperativeId}
      />
    </div>
  );
}