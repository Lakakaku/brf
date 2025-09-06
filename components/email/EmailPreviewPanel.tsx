'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmailTemplateViewer } from './EmailTemplateViewer';
import { 
  emailTemplates, 
  type EmailTemplateKey,
  type EmailTemplate,
  sendMockEmail,
  type MockEmailResult 
} from '@/lib/email/templates';
import { Mail, Send, Settings, User, Calendar, Wrench } from 'lucide-react';

// Swedish BRF-specific sample data
const sampleData = {
  emailVerification: {
    firstName: 'Anna',
    verificationCode: '123456',
    verificationUrl: 'https://brfportal.se/verifiera?token=abc123',
    expiresInMinutes: 30,
  },
  registrationApproval: {
    firstName: 'Lars',
    lastName: 'Andersson',
    cooperativeName: 'BRF Solbacken',
    apartmentNumber: 'Lägenhet 3B',
    loginUrl: 'https://brfportal.se/logga-in',
    boardMemberName: 'Eva Lindström',
  },
  passwordReset: {
    firstName: 'Maria',
    resetUrl: 'https://brfportal.se/aterstall-losenord?token=xyz789',
    resetCode: '789012',
    expiresInMinutes: 15,
  },
  loginNotification: {
    firstName: 'Johan',
    loginTime: '2024-01-15 14:30',
    ipAddress: '192.168.1.100',
    userAgent: 'Chrome 120.0 på Windows 10',
    location: 'Stockholm, Sverige',
  },
  boardMeetingNotification: {
    firstName: 'Ingrid',
    meetingDate: '15 februari 2024',
    meetingTime: '19:00',
    location: 'Föreningslokalen, plan 1',
    agenda: [
      'Mötets öppnande',
      'Genomgång av ekonomisk rapport',
      'Diskussion om kommande renoveringar',
      'Val av ny styrelseledamot',
      'Övriga frågor',
      'Mötets avslutning'
    ],
    rsvpUrl: 'https://brfportal.se/styrelsemote/anmalan',
    cooperativeName: 'BRF Karlastaden',
  },
  maintenanceNotification: {
    firstName: 'Per',
    maintenanceType: 'Rörstamsbyte',
    startDate: '20 mars 2024, 08:00',
    endDate: '22 mars 2024, 17:00',
    affectedAreas: ['Alla lägenheter på våning 2-4', 'Tvättstuga', 'Källarförråd'],
    contactPerson: 'Sven Byggström',
    contactPhone: '08-555 234 56',
    description: 'Vi kommer att byta ut gamla rörstammar i byggnad A för att förbättra vattentrycket och förebygga framtida läckage.',
  },
};

interface EmailPreviewPanelProps {
  className?: string;
}

export function EmailPreviewPanel({ className }: EmailPreviewPanelProps) {
  const [selectedTemplate, setSelectedTemplate] = React.useState<EmailTemplateKey>('emailVerification');
  const [templateData, setTemplateData] = React.useState<Record<string, any>>(sampleData[selectedTemplate]);
  const [testEmail, setTestEmail] = React.useState('test@brfportal.se');
  const [sendResult, setSendResult] = React.useState<MockEmailResult | null>(null);
  const [isSending, setIsSending] = React.useState(false);

  // Update template data when template selection changes
  React.useEffect(() => {
    setTemplateData(sampleData[selectedTemplate]);
    setSendResult(null);
  }, [selectedTemplate]);

  const currentTemplate: EmailTemplate = React.useMemo(() => {
    return emailTemplates[selectedTemplate](templateData);
  }, [selectedTemplate, templateData]);

  const handleDataChange = (key: string, value: any) => {
    setTemplateData(prev => ({ ...prev, [key]: value }));
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) return;
    
    setIsSending(true);
    setSendResult(null);

    try {
      const result = await sendMockEmail(testEmail, currentTemplate, {
        email: testEmail,
        ...templateData,
      });
      setSendResult(result);
    } catch (error) {
      setSendResult({
        success: false,
        messageId: '',
        deliveredAt: new Date(),
        error: 'Ett fel uppstod vid skickandet',
      });
    } finally {
      setIsSending(false);
    }
  };

  const getTemplateIcon = (key: EmailTemplateKey) => {
    const icons = {
      emailVerification: <Mail className="h-4 w-4" />,
      registrationApproval: <User className="h-4 w-4" />,
      passwordReset: <Settings className="h-4 w-4" />,
      loginNotification: <User className="h-4 w-4" />,
      boardMeetingNotification: <Calendar className="h-4 w-4" />,
      maintenanceNotification: <Wrench className="h-4 w-4" />,
    };
    return icons[key];
  };

  const templateOptions = [
    { key: 'emailVerification', label: 'E-postverifiering', description: 'Bekräfta e-postadress för nya medlemmar' },
    { key: 'registrationApproval', label: 'Registrering godkänd', description: 'Välkomstmeddelande för godkända medlemmar' },
    { key: 'passwordReset', label: 'Lösenordsåterställning', description: 'Hjälp medlemmar att återställa lösenord' },
    { key: 'loginNotification', label: 'Inloggningsnotifiering', description: 'Säkerhetsmeddelande om ny inloggning' },
    { key: 'boardMeetingNotification', label: 'Styrelsemöte', description: 'Inbjudan till styrelsemöten' },
    { key: 'maintenanceNotification', label: 'Underhållsarbete', description: 'Information om planerat underhåll' },
  ] as const;

  const renderVariableInputs = () => {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Mallvariabler</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(templateData).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key} className="text-xs font-medium text-muted-foreground">
                {key}
              </Label>
              {Array.isArray(value) ? (
                <Textarea
                  id={key}
                  value={value.join('\n')}
                  onChange={(e) => handleDataChange(key, e.target.value.split('\n'))}
                  placeholder={`Ange ${key}...`}
                  className="h-20 text-sm"
                />
              ) : (
                <Input
                  id={key}
                  value={String(value)}
                  onChange={(e) => handleDataChange(key, e.target.value)}
                  placeholder={`Ange ${key}...`}
                  className="text-sm"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${className}`}>
      {/* Control Panel */}
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Mallhantering
            </CardTitle>
            <CardDescription>
              Välj och anpassa e-postmallar för svenska BRF-system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template Selection */}
            <div className="space-y-2">
              <Label htmlFor="template-select">E-postmall</Label>
              <Select 
                value={selectedTemplate} 
                onValueChange={(value: EmailTemplateKey) => setSelectedTemplate(value)}
              >
                <SelectTrigger id="template-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      <div className="flex items-center gap-2">
                        {getTemplateIcon(option.key as EmailTemplateKey)}
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Variable Inputs */}
            {renderVariableInputs()}

            <Separator />

            {/* Test Email */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Skicka testmail</h4>
              <div className="space-y-2">
                <Label htmlFor="test-email">E-postadress</Label>
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="test@brfportal.se"
                />
              </div>
              <Button
                onClick={handleSendTestEmail}
                disabled={isSending || !testEmail}
                className="w-full"
              >
                {isSending ? (
                  'Skickar...'
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Skicka testmail
                  </>
                )}
              </Button>

              {/* Send Result */}
              {sendResult && (
                <Alert variant={sendResult.success ? 'default' : 'destructive'}>
                  <AlertDescription>
                    {sendResult.success ? (
                      <div className="space-y-1">
                        <div className="font-medium">✅ Testmail skickat!</div>
                        <div className="text-xs text-muted-foreground">
                          Message ID: {sendResult.messageId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Tid: {sendResult.deliveredAt.toLocaleTimeString('sv-SE')}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">❌ Fel vid skickande</div>
                        <div className="text-sm">{sendResult.error}</div>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preview Panel */}
      <div className="lg:col-span-2">
        <EmailTemplateViewer
          template={currentTemplate}
          templateKey={selectedTemplate}
          processedData={templateData}
        />
      </div>
    </div>
  );
}