'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type EmailTemplate } from '@/lib/email/templates';

interface EmailTemplateViewerProps {
  template: EmailTemplate;
  templateKey: string;
  processedData?: Record<string, any>;
  className?: string;
}

export function EmailTemplateViewer({
  template,
  templateKey,
  processedData = {},
  className,
}: EmailTemplateViewerProps) {
  const [viewMode, setViewMode] = React.useState<'html' | 'text'>('html');

  // Process template variables
  const processTemplate = (content: string): string => {
    let processed = content;
    Object.entries(processedData).forEach(([key, value]) => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(placeholder, String(value || `{{${key}}}`));
    });
    return processed;
  };

  const processedHtml = processTemplate(template.html);
  const processedText = processTemplate(template.text);
  const processedSubject = processTemplate(template.subject);

  // Extract template type for display
  const getTemplateTypeInfo = (key: string) => {
    const types = {
      emailVerification: { name: 'E-postverifiering', color: 'blue' as const },
      registrationApproval: { name: 'Registrering godkänd', color: 'green' as const },
      passwordReset: { name: 'Lösenordsåterställning', color: 'orange' as const },
      loginNotification: { name: 'Inloggningsnotifiering', color: 'purple' as const },
      boardMeetingNotification: { name: 'Styrelsemöte', color: 'indigo' as const },
      maintenanceNotification: { name: 'Underhållsarbete', color: 'red' as const },
    };
    return types[key as keyof typeof types] || { name: key, color: 'gray' as const };
  };

  const typeInfo = getTemplateTypeInfo(templateKey);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">{typeInfo.name}</CardTitle>
            <CardDescription>
              Förhandsvisning av e-postmall med svenska BRF-anpassningar
            </CardDescription>
          </div>
          <Badge variant="secondary" className="ml-2">
            {typeInfo.name}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Subject Preview */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Ämnesrad</h4>
          <div className="p-3 bg-muted rounded-md font-medium">
            {processedSubject}
          </div>
        </div>

        <Separator />

        {/* Content Tabs */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'html' | 'text')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="html">HTML-vy</TabsTrigger>
            <TabsTrigger value="text">Textvy</TabsTrigger>
          </TabsList>

          <TabsContent value="html" className="mt-4">
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 text-sm text-muted-foreground border-b">
                HTML-förhandsvisning
              </div>
              <div className="max-h-[600px] overflow-auto">
                <iframe
                  srcDoc={processedHtml}
                  className="w-full min-h-[400px] border-none"
                  title="E-postförhandsvisning"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="text" className="mt-4">
            <div className="border rounded-md overflow-hidden">
              <div className="bg-muted px-3 py-2 text-sm text-muted-foreground border-b">
                Textformat (fallback)
              </div>
              <div className="p-4 max-h-[600px] overflow-auto">
                <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
                  {processedText}
                </pre>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Template Variables Info */}
        {Object.keys(processedData).length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">
                Aktuella variabler
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(processedData).map(([key, value]) => (
                  <div key={key} className="p-2 bg-muted rounded-md text-sm">
                    <span className="font-mono text-muted-foreground">{key}:</span>{' '}
                    <span className="font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}