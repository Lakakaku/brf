'use client';

/**
 * BankID Mock Component for BRF Portal
 * Provides authentic Swedish BankID user experience for testing and development
 */

import React, { useState, useEffect, useCallback } from 'react';
import { QrCode, Smartphone, CheckCircle, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { 
  validatePersonnummer, 
  formatPersonnummer, 
  generateMockBankIDOrderRef, 
  generateMockBankIDQR 
} from '@/lib/utils/swedish';

/**
 * BankID authentication states following Swedish BankID flow
 */
export type BankIDState = 
  | 'idle' 
  | 'pending' 
  | 'outstanding_transaction' 
  | 'no_client' 
  | 'user_sign' 
  | 'complete' 
  | 'failed' 
  | 'cancelled'
  | 'expired';

export interface BankIDError {
  code: string;
  message: string;
  details?: string;
}

export interface BankIDUser {
  personalNumber: string;
  name: string;
  givenName: string;
  surname: string;
}

export interface BankIDMockProps {
  /**
   * Callback fired when authentication completes successfully
   */
  onSuccess?: (user: BankIDUser, orderRef: string) => void;
  /**
   * Callback fired when authentication fails
   */
  onError?: (error: BankIDError) => void;
  /**
   * Callback fired when authentication is cancelled
   */
  onCancel?: () => void;
  /**
   * Whether to show same-device flow (mobile) or different device (desktop with QR)
   */
  deviceType?: 'same' | 'different';
  /**
   * Whether to show the personnummer input field
   */
  showPersonnummerInput?: boolean;
  /**
   * Auto-start authentication with provided personnummer
   */
  autoStart?: boolean;
  /**
   * Personnummer to use for auto-start
   */
  personnummer?: string;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Mock data for Swedish names
 */
const MOCK_SWEDISH_NAMES = [
  { given: 'Anna', surname: 'Andersson' },
  { given: 'Erik', surname: 'Eriksson' },
  { given: 'Maria', surname: 'Johansson' },
  { given: 'Lars', surname: 'Larsson' },
  { given: 'Ingrid', surname: 'Nilsson' },
  { given: 'Gunnar', surname: 'Persson' },
  { given: 'Astrid', surname: 'Svensson' },
  { given: 'Björn', surname: 'Gustafsson' },
  { given: 'Margareta', surname: 'Pettersson' },
  { given: 'Nils', surname: 'Jonsson' },
];

export function BankIDMock({
  onSuccess,
  onError,
  onCancel,
  deviceType = 'different',
  showPersonnummerInput = true,
  autoStart = false,
  personnummer: initialPersonnummer = '',
  className
}: BankIDMockProps) {
  const [state, setState] = useState<BankIDState>('idle');
  const [orderRef, setOrderRef] = useState<string>('');
  const [qrData, setQrData] = useState<string>('');
  const [personnummer, setPersonnummer] = useState(initialPersonnummer);
  const [progress, setProgress] = useState(0);
  const [hintCode, setHintCode] = useState<string>('');
  const [error, setError] = useState<BankIDError | null>(null);

  /**
   * Generate mock QR code as SVG
   */
  const generateQRCodeSVG = useCallback((data: string) => {
    // Simplified QR code representation for mock purposes
    const size = 200;
    const moduleSize = 4;
    const modules = size / moduleSize;
    
    let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">`;
    svg += `<rect width="${size}" height="${size}" fill="white"/>`;
    
    // Generate random pattern based on data
    const seed = data.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    let random = seed;
    
    for (let x = 0; x < modules; x++) {
      for (let y = 0; y < modules; y++) {
        random = (random * 1103515245 + 12345) % 2147483648;
        if (random % 2) {
          svg += `<rect x="${x * moduleSize}" y="${y * moduleSize}" width="${moduleSize}" height="${moduleSize}" fill="black"/>`;
        }
      }
    }
    
    svg += '</svg>';
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  }, []);

  /**
   * Start BankID authentication
   */
  const startAuthentication = useCallback(async () => {
    if (showPersonnummerInput) {
      const pnrInfo = validatePersonnummer(personnummer);
      if (!pnrInfo.isValid) {
        setError({
          code: 'INVALID_PERSONNUMMER',
          message: 'Felaktigt personnummer',
          details: 'Kontrollera att personnumret är korrekt angivet.'
        });
        return;
      }
    }

    setError(null);
    setState('pending');
    setProgress(0);
    
    const newOrderRef = generateMockBankIDOrderRef();
    const newQrData = generateMockBankIDQR(newOrderRef);
    
    setOrderRef(newOrderRef);
    setQrData(newQrData);

    // Simulate initial delay
    setTimeout(() => {
      setState('outstanding_transaction');
      setHintCode('outstandingTransaction');
    }, 1000);

  }, [personnummer, showPersonnummerInput]);

  /**
   * Cancel authentication
   */
  const cancelAuthentication = useCallback(() => {
    setState('cancelled');
    setProgress(0);
    setHintCode('');
    onCancel?.();
    
    // Reset to idle after delay
    setTimeout(() => {
      setState('idle');
      setOrderRef('');
      setQrData('');
    }, 2000);
  }, [onCancel]);

  /**
   * Simulate authentication progress
   */
  useEffect(() => {
    if (state !== 'outstanding_transaction') return;

    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 15;
        
        if (newProgress >= 100) {
          // Randomly succeed or fail for demo purposes
          const shouldSucceed = Math.random() > 0.2; // 80% success rate
          
          if (shouldSucceed) {
            setState('user_sign');
            setHintCode('userSign');
            
            // Complete authentication after user_sign phase
            setTimeout(() => {
              setState('complete');
              
              // Generate mock user data
              const nameData = MOCK_SWEDISH_NAMES[Math.floor(Math.random() * MOCK_SWEDISH_NAMES.length)];
              const mockUser: BankIDUser = {
                personalNumber: personnummer || '198001011234',
                name: `${nameData.given} ${nameData.surname}`,
                givenName: nameData.given,
                surname: nameData.surname
              };
              
              setTimeout(() => {
                onSuccess?.(mockUser, orderRef);
              }, 1500);
              
            }, 2000);
          } else {
            // Simulate various failure scenarios
            const failures = [
              { code: 'USER_CANCEL', message: 'Användaren avbröt', details: 'Autentiseringen avbröts av användaren.' },
              { code: 'EXPIRED_TRANSACTION', message: 'Tiden löpte ut', details: 'Autentiseringen tog för lång tid.' },
              { code: 'CERTIFICATE_ERR', message: 'Certifikatfel', details: 'Problem med BankID-certifikatet.' },
              { code: 'START_FAILED', message: 'Kunde inte starta', details: 'BankID-appen kunde inte startas.' }
            ];
            
            const failure = failures[Math.floor(Math.random() * failures.length)];
            setState('failed');
            setError(failure);
            onError?.(failure);
          }
          
          return 100;
        }
        
        return newProgress;
      });
    }, 200);

    return () => clearInterval(interval);
  }, [state, personnummer, orderRef, onSuccess, onError]);

  /**
   * Auto-start authentication if enabled
   */
  useEffect(() => {
    if (autoStart && state === 'idle') {
      startAuthentication();
    }
  }, [autoStart, state, startAuthentication]);

  /**
   * Get status text based on current state and hint code
   */
  const getStatusText = (): { title: string; message: string; color: string } => {
    switch (state) {
      case 'idle':
        return {
          title: 'Redo att legitimera',
          message: deviceType === 'same' ? 'Tryck på Legitimera för att starta BankID.' : 'Ange personnummer och tryck Legitimera.',
          color: 'text-blue-600'
        };
      
      case 'pending':
        return {
          title: 'Startar BankID...',
          message: 'Förbereder autentisering.',
          color: 'text-blue-600'
        };
      
      case 'outstanding_transaction':
        if (deviceType === 'same') {
          return {
            title: 'Starta BankID-appen',
            message: 'Tryck på knappen nedan för att öppna BankID-appen på denna enhet.',
            color: 'text-blue-600'
          };
        } else {
          return {
            title: 'Skanna QR-koden',
            message: 'Öppna BankID-appen på din mobil och skanna QR-koden.',
            color: 'text-blue-600'
          };
        }
      
      case 'user_sign':
        return {
          title: 'Legitimera i BankID',
          message: 'Öppna BankID-appen och följ instruktionerna för att legitimera dig.',
          color: 'text-orange-600'
        };
      
      case 'complete':
        return {
          title: 'Legitimering klar',
          message: 'Du har legitimerats med BankID.',
          color: 'text-green-600'
        };
      
      case 'failed':
        return {
          title: 'Legitimering misslyckades',
          message: error?.message || 'Ett okänt fel uppstod.',
          color: 'text-red-600'
        };
      
      case 'cancelled':
        return {
          title: 'Legitimering avbruten',
          message: 'Autentiseringen avbröts.',
          color: 'text-gray-600'
        };
      
      case 'expired':
        return {
          title: 'Tiden löpte ut',
          message: 'Legitimeringen tog för lång tid. Försök igen.',
          color: 'text-red-600'
        };
      
      default:
        return {
          title: 'Okänd status',
          message: 'Något gick fel.',
          color: 'text-gray-600'
        };
    }
  };

  const statusInfo = getStatusText();

  return (
    <div className={cn('w-full max-w-md mx-auto', className)}>
      <Card className="border-2 border-blue-100">
        <CardHeader className="pb-4 text-center bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center justify-center mb-2">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
              <span className="text-white font-bold text-sm">ID</span>
            </div>
            <span className="ml-2 text-lg font-semibold text-blue-900">BankID</span>
          </div>
          <CardTitle className={cn('text-lg font-medium', statusInfo.color)}>
            {statusInfo.title}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Status Message */}
          <div className="text-center">
            <p className="text-sm text-gray-600">{statusInfo.message}</p>
            {error?.details && (
              <p className="text-xs text-red-500 mt-1">{error.details}</p>
            )}
          </div>

          {/* Personnummer Input */}
          {showPersonnummerInput && state === 'idle' && (
            <div className="space-y-2">
              <Label htmlFor="personnummer" className="text-sm font-medium">
                Personnummer
              </Label>
              <Input
                id="personnummer"
                type="text"
                value={personnummer}
                onChange={(e) => setPersonnummer(formatPersonnummer(e.target.value))}
                placeholder="YYYYMMDD-NNNN"
                className="text-center font-mono"
                maxLength={13}
              />
            </div>
          )}

          {/* QR Code Display */}
          {state === 'outstanding_transaction' && deviceType === 'different' && qrData && (
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-white p-4 rounded-lg border shadow-sm">
                <img
                  src={generateQRCodeSVG(qrData)}
                  alt="BankID QR Code"
                  className="w-40 h-40"
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                QR-kod uppdateras automatiskt
              </p>
            </div>
          )}

          {/* Mobile Device Mockup */}
          {state === 'outstanding_transaction' && deviceType === 'same' && (
            <div className="flex flex-col items-center space-y-3">
              <div className="relative">
                <Smartphone className="w-16 h-16 text-blue-600" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">ID</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => {
                  // Simulate opening BankID app
                  setState('user_sign');
                  setHintCode('userSign');
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Öppna BankID-appen
              </Button>
            </div>
          )}

          {/* Progress Bar */}
          {(state === 'outstanding_transaction' || state === 'user_sign') && (
            <div className="space-y-2">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-center text-gray-500">
                {Math.round(progress)}% slutfört
              </p>
            </div>
          )}

          {/* Status Icons */}
          <div className="flex justify-center">
            {state === 'pending' && (
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            )}
            {state === 'outstanding_transaction' && (
              <QrCode className="w-8 h-8 text-blue-600 animate-pulse" />
            )}
            {state === 'user_sign' && (
              <AlertTriangle className="w-8 h-8 text-orange-600 animate-pulse" />
            )}
            {state === 'complete' && (
              <CheckCircle className="w-8 h-8 text-green-600" />
            )}
            {(state === 'failed' || state === 'expired') && (
              <XCircle className="w-8 h-8 text-red-600" />
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {state === 'idle' && (
              <Button
                onClick={startAuthentication}
                disabled={showPersonnummerInput && !validatePersonnummer(personnummer).isValid}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Legitimera med BankID
              </Button>
            )}
            
            {(state === 'outstanding_transaction' || state === 'user_sign') && (
              <Button
                onClick={cancelAuthentication}
                variant="outline"
                className="flex-1"
              >
                Avbryt
              </Button>
            )}
            
            {(state === 'failed' || state === 'expired') && (
              <Button
                onClick={() => {
                  setState('idle');
                  setError(null);
                  setProgress(0);
                  setOrderRef('');
                  setQrData('');
                }}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Försök igen
              </Button>
            )}
          </div>

          {/* Help Text */}
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>Har du problem med BankID?</p>
            <a
              href="https://www.bankid.com/support"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Få hjälp på bankid.com
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}