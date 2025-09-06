'use client';

import * as React from 'react';
import { FileUpload, UploadFile } from './';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Example usage of the FileUpload component
 * Demonstrates various configurations for BRF Portal use cases
 */
export default function FileUploadExample() {
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = React.useState(false);

  // Mock upload function
  const mockUpload = async (file: File): Promise<{ id: string; url: string }> => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simulate occasional failure
    if (Math.random() < 0.1) {
      throw new Error('Nätverksfel, försök igen');
    }
    
    return {
      id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: URL.createObjectURL(file)
    };
  };

  const handleFilesSelect = (files: UploadFile[]) => {
    console.log('Valda filer:', files);
  };

  const handleFileRemove = (fileId: string) => {
    console.log('Ta bort fil:', fileId);
  };

  const handleUploadStart = (files: UploadFile[]) => {
    console.log('Startar uppladdning av:', files.length, 'filer');
    setIsUploading(true);
  };

  const handleUploadComplete = (fileId: string, result: any) => {
    console.log('Uppladdning klar:', fileId, result);
    setUploadedFiles(prev => [...prev, 
      ...prev.filter(f => f.id === fileId)
    ]);
  };

  const handleUploadError = (fileId: string, error: string) => {
    console.log('Uppladdningsfel:', fileId, error);
  };

  const handleAllUploadsComplete = () => {
    setIsUploading(false);
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">FileUpload Exempel</h1>
        <p className="text-muted-foreground">
          Exempel på hur man använder FileUpload komponenten i BRF Portal
        </p>
      </div>

      {/* Basic Example */}
      <Card>
        <CardHeader>
          <CardTitle>Grundläggande filuppladdning</CardTitle>
          <CardDescription>
            Enkel filuppladdning utan automatisk uppladdning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            accept="image/*,.pdf,.doc,.docx"
            multiple={true}
            maxSize={5 * 1024 * 1024} // 5MB
            maxFiles={3}
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
          />
        </CardContent>
      </Card>

      {/* BRF Document Upload */}
      <Card>
        <CardHeader>
          <CardTitle>BRF-dokument uppladdning</CardTitle>
          <CardDescription>
            Specialkonfiguration för BRF-dokument som protokoll, stadgar, etc.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            accept=".pdf,.doc,.docx,.xlsx,.xls,.jpg,.jpeg,.png"
            multiple={true}
            maxSize={25 * 1024 * 1024} // 25MB för större dokument
            maxFiles={10}
            uploadFunction={mockUpload}
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
            onUploadStart={handleUploadStart}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </CardContent>
      </Card>

      {/* Images Only */}
      <Card>
        <CardHeader>
          <CardTitle>Endast bilder</CardTitle>
          <CardDescription>
            Konfiguration för att bara acceptera bildfiler
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            accept="image/*"
            multiple={true}
            maxSize={10 * 1024 * 1024} // 10MB
            maxFiles={5}
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
          />
        </CardContent>
      </Card>

      {/* Single File */}
      <Card>
        <CardHeader>
          <CardTitle>Enkel fil</CardTitle>
          <CardDescription>
            Konfiguration för att bara välja en fil åt gången
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            accept=".pdf"
            multiple={false}
            maxSize={20 * 1024 * 1024} // 20MB
            maxFiles={1}
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
          />
        </CardContent>
      </Card>

      {/* Disabled State */}
      <Card>
        <CardHeader>
          <CardTitle>Inaktiverat tillstånd</CardTitle>
          <CardDescription>
            Så här ser komponenten ut när den är inaktiverad
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUpload
            accept="*/*"
            multiple={true}
            disabled={true}
            onFilesSelect={handleFilesSelect}
            onFileRemove={handleFileRemove}
          />
        </CardContent>
      </Card>

      {/* Status Display */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uppladdade filer</CardTitle>
            <CardDescription>
              Filer som har laddats upp framgångsrikt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-2 border rounded">
                  <span className="text-sm font-medium">{file.name}</span>
                  <Badge variant="success">Uppladdad</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Usage Info */}
      <Card>
        <CardHeader>
          <CardTitle>Användning</CardTitle>
          <CardDescription>
            Tips för att använda komponenten effektivt
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-2 text-sm">
            <li>• Dra och släpp filer direkt på uppladdningsområdet</li>
            <li>• Klicka på området för att öppna filbläddraren</li>
            <li>• Förhandsgranska bilder innan uppladdning</li>
            <li>• Ta bort filer genom att klicka på X-knappen</li>
            <li>• Alla meddelanden och fel visas på svenska</li>
            <li>• Komponenten stöder dark mode automatiskt</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}