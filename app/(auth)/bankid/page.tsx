'use client';

/**
 * BankID Authentication Page for BRF Portal
 * Provides authentic Swedish BankID login experience with device detection
 */

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Monitor, Smartphone, Shield, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BankIDMock, type BankIDUser, type BankIDError } from '@/components/auth/BankIDMock';
import { cn } from '@/lib/utils';

/**
 * Device detection for BankID flow selection
 */
function useDeviceDetection() {
  const [isMobile, setIsMobile] = useState(false);
  const [deviceType, setDeviceType] = useState<'same' | 'different'>('different');

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const mobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
      
      setIsMobile(mobile);
      setDeviceType(mobile ? 'same' : 'different');
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, deviceType, setDeviceType };
}

export default function BankIDPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isMobile, deviceType, setDeviceType } = useDeviceDetection();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeviceSelection, setShowDeviceSelection] = useState(!isMobile);

  // Get return URL from search params
  const returnUrl = searchParams.get('returnUrl') || '/dashboard';
  const cooperativeId = searchParams.get('cooperativeId');

  /**
   * Handle successful BankID authentication
   */
  const handleBankIDSuccess = async (user: BankIDUser, orderRef: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Send authentication data to API
      const response = await fetch('/api/auth/bankid/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderRef,
          user,
          cooperativeId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Successful authentication - redirect to intended page
        router.push(returnUrl);
      } else {
        setError(data.error || 'Autentiseringen misslyckades');
      }
    } catch (err) {
      console.error('BankID verification error:', err);
      setError('Ett tekniskt fel uppstod. Försök igen.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle BankID authentication error
   */
  const handleBankIDError = (error: BankIDError) => {
    setError(error.message);
  };

  /**
   * Handle BankID cancellation
   */
  const handleBankIDCancel = () => {
    setError(null);
  };

  /**
   * Toggle device type for testing
   */
  const handleDeviceTypeChange = (type: 'same' | 'different') => {
    setDeviceType(type);
    setShowDeviceSelection(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Legitimera med BankID</h1>
            <p className="text-lg text-gray-600 mt-2">
              Säker inloggning till BRF Portal
            </p>
          </div>

          {/* Security Badges */}
          <div className="flex justify-center space-x-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Lock className="w-3 h-3 mr-1" />
              Säker
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              <Shield className="w-3 h-3 mr-1" />
              BankID
            </Badge>
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              SSL-krypterat
            </Badge>
          </div>
        </div>

        {/* Device Selection */}
        {showDeviceSelection && (
          <Card className="border-2 border-blue-100">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Välj hur du vill legitimera dig</CardTitle>
              <CardDescription>
                Välj den metod som passar ditt scenario bäst
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Button
                  variant="outline"
                  className="h-16 flex items-center justify-start space-x-4 hover:bg-blue-50"
                  onClick={() => handleDeviceTypeChange('different')}
                >
                  <Monitor className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium">Annan enhet (QR-kod)</div>
                    <div className="text-sm text-gray-500">Skanna med mobilen</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-16 flex items-center justify-start space-x-4 hover:bg-blue-50"
                  onClick={() => handleDeviceTypeChange('same')}
                >
                  <Smartphone className="w-8 h-8 text-blue-600" />
                  <div className="text-left">
                    <div className="font-medium">Samma enhet</div>
                    <div className="text-sm text-gray-500">BankID-app på denna enhet</div>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* BankID Authentication */}
        {!showDeviceSelection && (
          <div className="space-y-4">
            {/* Device Type Indicator */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    {deviceType === 'same' ? (
                      <>
                        <Smartphone className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          Samma enhet - BankID-app
                        </span>
                      </>
                    ) : (
                      <>
                        <Monitor className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">
                          QR-kod för annan enhet
                        </span>
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeviceSelection(true)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    Ändra
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Error Display */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* BankID Component */}
            <BankIDMock
              onSuccess={handleBankIDSuccess}
              onError={handleBankIDError}
              onCancel={handleBankIDCancel}
              deviceType={deviceType}
              showPersonnummerInput={deviceType === 'different'}
              className="w-full"
            />

            {/* Loading Overlay */}
            {isLoading && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Verifierar legitimation...</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Footer Links */}
        <div className="text-center space-y-4">
          {/* Back to Login */}
          <div>
            <Link
              href="/auth/login"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 underline"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Tillbaka till vanlig inloggning
            </Link>
          </div>

          {/* Help and Information */}
          <div className="border-t pt-4 space-y-2">
            <h3 className="text-sm font-medium text-gray-900">Vad är BankID?</h3>
            <p className="text-xs text-gray-600 max-w-md mx-auto">
              BankID är en elektronisk legitimation som möjliggör säker identifiering och underskrifter online. 
              Det är utfärdat av din bank och är samma legitimation som du använder för internetbanken.
            </p>
            
            <div className="flex justify-center space-x-4 text-xs">
              <a
                href="https://www.bankid.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Om BankID
              </a>
              <a
                href="https://www.bankid.com/privat/skaffa-bankid"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Skaffa BankID
              </a>
              <a
                href="https://www.bankid.com/privat/support"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                Få hjälp
              </a>
            </div>
          </div>

          {/* Security Notice */}
          <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <Lock className="w-3 h-3" />
              <span className="font-medium">Säkerhetsinformation</span>
            </div>
            <p>
              Din BankID-legitimation överförs krypterat och lagras säkert. 
              Vi delar aldrig dina personuppgifter med tredje part utan ditt samtycke.
            </p>
          </div>

          {/* Alternative Login */}
          <div className="text-sm text-gray-600">
            <p>
              Har du inget BankID?{' '}
              <Link
                href="/auth/login"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Logga in med e-post istället
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}