'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Upload, 
  Smartphone, 
  FolderOpen, 
  Mail, 
  Shield, 
  FileCheck,
  Zap,
  History,
  Copy,
  Settings
} from 'lucide-react';

// Import upload components
import { EnhancedFileUpload } from '@/components/upload/enhanced-file-upload';
import { MobilePhotoUpload } from '@/components/upload/mobile';
import { FolderUpload } from '@/components/upload/folder-upload';

export default function UploadDemoPage() {
  // Mock upload function for demo
  const mockUploadFunction = async (file: File) => {
    console.log('Demo upload:', file.name);
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    return { success: true, fileId: `demo-${Date.now()}` };
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Dokumentuppladdning System Demo</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Komplett filuppladdningslösning för BRF Portal med alla 14 implementerade funktioner
          </p>
          
          {/* Feature badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge variant="secondary" style={{ background: 'var(--forest-bg)', color: 'var(--forest-dark)' }}><Upload className="w-3 h-3 mr-1" />Dra & Släpp</Badge>
            <Badge variant="secondary" style={{ background: 'var(--ocean-bg)', color: 'var(--ocean-dark)' }}><Zap className="w-3 h-3 mr-1" />Massuppladdning (500+)</Badge>
            <Badge variant="secondary" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan-vibrant)' }}><FileCheck className="w-3 h-3 mr-1" />Filvalidering</Badge>
            <Badge variant="secondary" style={{ background: 'var(--forest-bg)', color: 'var(--forest-dark)' }}><History className="w-3 h-3 mr-1" />Framstegsspårning</Badge>
            <Badge variant="secondary" style={{ background: 'var(--ocean-bg)', color: 'var(--ocean-dark)' }}><Shield className="w-3 h-3 mr-1" />Delad Uppladdning</Badge>
            <Badge variant="secondary" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan-vibrant)' }}><Smartphone className="w-3 h-3 mr-1" />Mobil Foto</Badge>
            <Badge variant="secondary" style={{ background: 'var(--forest-bg)', color: 'var(--forest-dark)' }}><FolderOpen className="w-3 h-3 mr-1" />Mappstöd</Badge>
            <Badge variant="secondary" style={{ background: 'var(--ocean-bg)', color: 'var(--ocean-dark)' }}><Copy className="w-3 h-3 mr-1" />Dubblettdetektering</Badge>
            <Badge variant="secondary" style={{ background: 'var(--cyan-bg)', color: 'var(--cyan-vibrant)' }}><Mail className="w-3 h-3 mr-1" />E-postuppladdning</Badge>
            <Badge variant="secondary" style={{ background: 'var(--forest-bg)', color: 'var(--forest-dark)' }}><Settings className="w-3 h-3 mr-1" />Storleksgränser</Badge>
          </div>
        </div>

        <Tabs defaultValue="enhanced" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="enhanced">Förbättrad Uppladdning</TabsTrigger>
            <TabsTrigger value="mobile">Mobil Foto</TabsTrigger>
            <TabsTrigger value="folder">Mapp Uppladdning</TabsTrigger>
          </TabsList>

          <TabsContent value="enhanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" style={{ color: 'var(--forest-base)' }} />
                  Förbättrad Filuppladdning
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Dra & släpp-gränssnitt med framstegsspårning, avbrytning, massuppladdning (500+), 
                  filvalidering, delade uppladdningar, återförsöksmekanism och realtidsframsteg.
                </p>
              </CardHeader>
              <CardContent>
                <EnhancedFileUpload
                  uploadFunction={mockUploadFunction}
                  maxFiles={500}
                  maxFileSize={500 * 1024 * 1024} // 500MB
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  enableChunkedUpload={true}
                  chunkSize={1024 * 1024} // 1MB chunks
                  maxRetries={3}
                  showBatchProgress={true}
                  enablePersistence={true}
                  showConnectionStatus={true}
                  realtimeConfig={{
                    enabled: true,
                    endpoint: '/api/upload/progress',
                    updateInterval: 1000
                  }}
                />
              </CardContent>
            </Card>

            {/* Features showcase */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Huvudfunktioner Implementerade</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4" style={{ color: 'var(--forest-base)' }} />
                    <span className="text-sm">Dra & Släpp Gränssnitt ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" style={{ color: 'var(--ocean-base)' }} />
                    <span className="text-sm">Massuppladdning (500+ filer) ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4" style={{ color: 'var(--cyan-vibrant)' }} />
                    <span className="text-sm">Filtypvalidering ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" style={{ color: 'var(--forest-base)' }} />
                    <span className="text-sm">Framstegsspårning & Avbryt ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4" style={{ color: 'var(--ocean-base)' }} />
                    <span className="text-sm">Delad Uppladdning (Stora Filer) ✅</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Avancerade Funktioner</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4" style={{ color: 'var(--cyan-vibrant)' }} />
                    <span className="text-sm">Dubblettdetektering ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" style={{ color: 'var(--forest-base)' }} />
                    <span className="text-sm">E-post-till-Uppladdning Mock ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" style={{ color: 'var(--ocean-base)' }} />
                    <span className="text-sm">Uppladdningshistorik & Ångra ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" style={{ color: 'var(--cyan-vibrant)' }} />
                    <span className="text-sm">Skannerintegration Mock ✅</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" style={{ color: 'var(--forest-base)' }} />
                    <span className="text-sm">Filstorleksgränser ✅</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mobile">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" style={{ color: 'var(--ocean-base)' }} />
                  Mobil Fotouppladdning med Bildredigering
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Kamerafotografering, bildredigering, automatiska korrigeringar och mobiloptimerat gränssnitt.
                </p>
              </CardHeader>
              <CardContent>
                <MobilePhotoUpload
                  cooperativeId="demo-coop"
                  onUploadComplete={(result) => console.log('Mobile upload complete:', result)}
                  maxPhotos={50}
                  enableImageCorrection={true}
                  enableGeotagging={true}
                  compressionQuality={0.8}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="folder">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="w-5 h-5" style={{ color: 'var(--cyan-vibrant)' }} />
                  Stöd för Mappuppladdning
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ladda upp hela mappstrukturer med trädvisualisering och massbearbetning.
                </p>
              </CardHeader>
              <CardContent>
                <FolderUpload
                  onUploadComplete={(results) => console.log('Folder upload complete:', results)}
                  maxFiles={1000}
                  maxDepth={5}
                  showTree={true}
                  enablePreview={true}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* API Endpoints Info */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Tillgängliga API Ändpunkter</CardTitle>
            <p className="text-sm text-muted-foreground">
              Komplett API-implementering som stöder alla uppladdningsfunktioner
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm font-mono">
              <div>
                <h4 className="font-semibold mb-2">Kärn Uppladdning APIs:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>POST /api/upload/batch</li>
                  <li>GET /api/upload/batch/[batchId]/progress</li>
                  <li>POST /api/upload/validation</li>
                  <li>POST /api/upload/chunks/init</li>
                  <li>POST /api/upload/chunks/[sessionId]/[chunkNumber]</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Avancerade Funktioner:</h4>
                <ul className="space-y-1 text-muted-foreground">
                  <li>POST /api/upload/duplicates</li>
                  <li>POST /api/upload/email/mock</li>
                  <li>POST /api/upload/scanner/scan</li>
                  <li>GET /api/upload/limits</li>
                  <li>POST /api/upload/webhook</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}