/**
 * Feature Flag Form Component
 * Form for creating and editing feature flags
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { FeatureFlag, FeatureCategory, FeatureEnvironment, FeatureStatus, FeatureTargetType, BRF_FEATURE_CONFIGS } from '@/lib/features/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { X, Plus, InfoIcon } from 'lucide-react';

interface FeatureFlagFormData {
  key: string;
  name: string;
  description?: string;
  category: FeatureCategory;
  environment: FeatureEnvironment;
  target_type: FeatureTargetType;
  status: FeatureStatus;
  rollout_percentage: number;
  is_enabled: boolean;
  expires_at?: string;
  tags: string[];
  dependencies: string[];
  conflicts: string[];
  testing_notes?: string;
}

interface FeatureFlagFormProps {
  flag?: FeatureFlag;
  isOpen: boolean;
  onClose: () => void;
  onSave: (flag: Omit<FeatureFlag, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  cooperativeId?: string;
}

const categoryOptions: { value: FeatureCategory; label: string; description: string }[] = [
  { value: 'general', label: 'Allmänt', description: 'Allmänna funktioner' },
  { value: 'auth', label: 'Autentisering', description: 'Inloggning och säkerhet' },
  { value: 'payments', label: 'Betalningar', description: 'Betalningssystem och avgifter' },
  { value: 'documents', label: 'Dokument', description: 'Dokumenthantering' },
  { value: 'bookings', label: 'Bokningar', description: 'Bokningssystem' },
  { value: 'admin', label: 'Administration', description: 'Administrativa funktioner' },
  { value: 'ui', label: 'Användargränssnitt', description: 'UI/UX funktioner' },
  { value: 'api', label: 'API', description: 'API-relaterade funktioner' },
];

const environmentOptions: { value: FeatureEnvironment; label: string }[] = [
  { value: 'all', label: 'Alla miljöer' },
  { value: 'development', label: 'Development' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

const statusOptions: { value: FeatureStatus; label: string; description: string }[] = [
  { value: 'draft', label: 'Utkast', description: 'Under utveckling' },
  { value: 'active', label: 'Aktiv', description: 'Redo för användning' },
  { value: 'archived', label: 'Arkiverad', description: 'Inte längre i bruk' },
  { value: 'deprecated', label: 'Föråldrad', description: 'Kommer att tas bort' },
];

const targetTypeOptions: { value: FeatureTargetType; label: string; description: string }[] = [
  { value: 'all', label: 'Alla användare', description: 'Aktiverad för alla' },
  { value: 'percentage', label: 'Procentuell', description: 'Aktiverad för en viss procent användare' },
  { value: 'users', label: 'Specifika användare', description: 'Aktiverad för valda användare' },
  { value: 'roles', label: 'Användarroller', description: 'Aktiverad för vissa roller' },
  { value: 'apartments', label: 'Specifika lägenheter', description: 'Aktiverad för valda lägenheter' },
];

export default function FeatureFlagForm({
  flag,
  isOpen,
  onClose,
  onSave,
  cooperativeId,
}: FeatureFlagFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [availablePresets] = useState(Object.keys(BRF_FEATURE_CONFIGS));

  const { register, control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FeatureFlagFormData>({
    defaultValues: {
      key: '',
      name: '',
      description: '',
      category: 'general',
      environment: 'all',
      target_type: 'all',
      status: 'draft',
      rollout_percentage: 100,
      is_enabled: false,
      tags: [],
      dependencies: [],
      conflicts: [],
    },
  });

  const watchedTags = watch('tags') || [];
  const watchedTargetType = watch('target_type');
  const watchedKey = watch('key');

  // Populate form when editing
  useEffect(() => {
    if (flag) {
      reset({
        key: flag.key,
        name: flag.name,
        description: flag.description || '',
        category: flag.category,
        environment: flag.environment,
        target_type: flag.target_type,
        status: flag.status,
        rollout_percentage: flag.rollout_percentage,
        is_enabled: flag.is_enabled,
        expires_at: flag.expires_at ? flag.expires_at.split('T')[0] : '',
        tags: flag.tags || [],
        dependencies: flag.dependencies || [],
        conflicts: flag.conflicts || [],
        testing_notes: flag.testing_notes || '',
      });
    } else {
      reset({
        key: '',
        name: '',
        description: '',
        category: 'general',
        environment: 'all',
        target_type: 'all',
        status: 'draft',
        rollout_percentage: 100,
        is_enabled: false,
        tags: [],
        dependencies: [],
        conflicts: [],
      });
    }
  }, [flag, reset]);

  const onSubmit = async (data: FeatureFlagFormData) => {
    setIsLoading(true);
    try {
      await onSave({
        cooperative_id: cooperativeId || null,
        key: data.key,
        name: data.name,
        description: data.description,
        category: data.category,
        environment: data.environment,
        target_type: data.target_type,
        target_config: {},
        status: data.status,
        rollout_percentage: data.rollout_percentage,
        is_enabled: data.is_enabled,
        expires_at: data.expires_at || undefined,
        tags: data.tags,
        dependencies: data.dependencies,
        conflicts: data.conflicts,
        testing_notes: data.testing_notes,
        validation_rules: {},
        created_by: null, // TODO: Add current user ID
        updated_by: null, // TODO: Add current user ID
        enabled_at: undefined,
        disabled_at: undefined,
      });
      onClose();
    } catch (error) {
      console.error('Failed to save feature flag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPreset = (presetKey: string) => {
    const preset = BRF_FEATURE_CONFIGS[presetKey as keyof typeof BRF_FEATURE_CONFIGS];
    if (preset) {
      setValue('key', presetKey);
      setValue('name', preset.name || presetKey);
      setValue('description', preset.description || '');
      setValue('category', preset.category || 'general');
      setValue('tags', preset.tags || []);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !watchedTags.includes(newTag.trim())) {
      setValue('tags', [...watchedTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setValue('tags', watchedTags.filter(tag => tag !== tagToRemove));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {flag ? 'Redigera feature flag' : 'Skapa ny feature flag'}
          </DialogTitle>
          <DialogDescription>
            {flag 
              ? 'Uppdatera inställningar för denna feature flag.'
              : 'Konfigurera en ny feature flag för att styra funktionalitet i systemet.'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Grundläggande</TabsTrigger>
              <TabsTrigger value="targeting">Målgrupp</TabsTrigger>
              <TabsTrigger value="advanced">Avancerat</TabsTrigger>
              <TabsTrigger value="presets">Fördefinierade</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key">Nyckel *</Label>
                  <Input
                    id="key"
                    placeholder="t.ex. new_payment_system"
                    {...register('key', { required: 'Nyckel är obligatorisk' })}
                  />
                  {errors.key && (
                    <p className="text-sm text-red-600">{errors.key.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Namn *</Label>
                  <Input
                    id="name"
                    placeholder="t.ex. Nytt betalningssystem"
                    {...register('name', { required: 'Namn är obligatoriskt' })}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Beskrivning</Label>
                <Textarea
                  id="description"
                  placeholder="Beskriv vad denna feature flag styr..."
                  rows={3}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categoryOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-sm text-gray-500">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-sm text-gray-500">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Controller
                  name="is_enabled"
                  control={control}
                  render={({ field }) => (
                    <Switch 
                      checked={field.value} 
                      onCheckedChange={field.onChange} 
                    />
                  )}
                />
                <Label>Aktiverad</Label>
              </div>
            </TabsContent>

            <TabsContent value="targeting" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Målgrupp</Label>
                  <Controller
                    name="target_type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {targetTypeOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div>
                                <div className="font-medium">{option.label}</div>
                                <div className="text-sm text-gray-500">{option.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {watchedTargetType === 'percentage' && (
                  <div className="space-y-2">
                    <Label htmlFor="rollout_percentage">Utrullningsprocent (%)</Label>
                    <Input
                      id="rollout_percentage"
                      type="number"
                      min="0"
                      max="100"
                      {...register('rollout_percentage', { 
                        min: 0, 
                        max: 100,
                        valueAsNumber: true 
                      })}
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Miljö</Label>
                    <Controller
                      name="environment"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {environmentOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expires_at">Utgångsdatum</Label>
                    <Input
                      id="expires_at"
                      type="date"
                      {...register('expires_at')}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Taggar</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder="Lägg till tagg..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    />
                    <Button type="button" variant="outline" onClick={addTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {watchedTags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => removeTag(tag)} 
                        />
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="testing_notes">Testanteckningar</Label>
                  <Textarea
                    id="testing_notes"
                    placeholder="Anteckningar för testning och validering..."
                    rows={4}
                    {...register('testing_notes')}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="presets" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <InfoIcon className="h-4 w-4" />
                    Fördefinierade BRF Feature Flags
                  </CardTitle>
                  <CardDescription>
                    Välj en fördefinierad feature flag för svenska bostadsrättsföreningar.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                  {availablePresets.map((presetKey) => {
                    const preset = BRF_FEATURE_CONFIGS[presetKey as keyof typeof BRF_FEATURE_CONFIGS];
                    return (
                      <Button
                        key={presetKey}
                        type="button"
                        variant="outline"
                        className="h-auto p-3 justify-start"
                        onClick={() => loadPreset(presetKey)}
                      >
                        <div className="text-left">
                          <div className="font-medium text-sm">{preset.name}</div>
                          <div className="text-xs text-gray-500">{presetKey}</div>
                        </div>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Avbryt
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sparar...' : flag ? 'Uppdatera' : 'Skapa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}