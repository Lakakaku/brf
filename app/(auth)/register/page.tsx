'use client';

/**
 * Registration page for BRF Portal
 * Multi-step registration wizard with Swedish BRF context
 */

import React, { useState, Suspense } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building, ArrowLeft, Info, AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RegisterForm, type RegistrationData } from '@/components/auth/RegisterForm';

// Note: Can't use metadata in client components, will be handled by layout
// export const metadata: Metadata = {
//   title: 'Bli medlem | BRF Portal',
//   description: 'Ansök om medlemskap i bostadsrättsföreningen',
// };

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  // Get optional parameters
  const cooperativeId = searchParams.get('cooperativeId') || '';
  const invitationCode = searchParams.get('invitation') || '';

  /**
   * Handle successful registration
   */
  const handleRegistrationSuccess = (data: RegistrationData) => {
    setRegistrationSuccess(true);
    setRegistrationError(null);
  };

  /**
   * Handle registration error
   */
  const handleRegistrationError = (error: string) => {
    setRegistrationError(error);
  };

  // If user has invitation code, show form immediately
  React.useEffect(() => {
    if (invitationCode) {
      setShowForm(true);
    }
  }, [invitationCode]);

  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <Building className="w-8 h-8 text-green-600" />
            </div>
            
            <div>
              <h1 className="text-xl font-bold text-gray-900">Registrering skickad!</h1>
              <p className="text-gray-600 mt-2">
                Din ansökan om medlemskap har skickats till styrelsen för godkännande.
              </p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 text-left">
              <h3 className="font-medium text-green-900 mb-2">Vad händer nu?</h3>
              <ul className="text-sm text-green-800 space-y-1">
                <li>• Styrelsen granskar din ansökan</li>
                <li>• Du får besked inom 3-5 arbetsdagar</li>
                <li>• Vid godkännande aktiveras ditt konto</li>
                <li>• Du får sedan full tillgång till portalen</li>
              </ul>
            </div>

            <Button
              onClick={() => router.push('/auth/login')}
              className="w-full"
            >
              Gå till inloggning
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 py-8 px-4">
        {/* Back to info */}
        <div className="max-w-2xl mx-auto mb-4">
          <Button
            variant="ghost"
            onClick={() => setShowForm(false)}
            className="text-blue-600 hover:text-blue-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tillbaka till information
          </Button>
        </div>

        {/* Registration Form */}
        <RegisterForm
          onSuccess={handleRegistrationSuccess}
          onError={handleRegistrationError}
          cooperativeId={cooperativeId}
          invitationCode={invitationCode}
        />

        {/* Error Display */}
        {registrationError && (
          <div className="max-w-2xl mx-auto mt-4">
            <Card className="border-red-200 bg-red-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <p className="text-red-800">{registrationError}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        {/* Back to login link */}
        <div>
          <Link
            href="/auth/login"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Tillbaka till inloggning
          </Link>
        </div>

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Building className="w-8 h-8 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bli medlem</h1>
            <p className="text-lg text-gray-600 mt-2">
              Ansök om medlemskap i bostadsrättsföreningen
            </p>
          </div>
        </div>

        {/* Information Cards */}
        <div className="space-y-4">
          {/* Main Info Card */}
          <Card className="border-2 border-blue-100">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <Info className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Medlemskap i BRF
                    </h3>
                    <p className="text-gray-600">
                      För att få tillgång till BRF-portalen behöver du vara registrerad medlem 
                      i bostadsrättsföreningen. Som medlem får du tillgång till:
                    </p>
                  </div>
                  
                  <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Ekonomisk information och årsredovisningar
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Protokoll från styrelsemöten
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Bokning av gemensamma utrymmen
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Felanmälan och underhållsärenden
                    </li>
                    <li className="flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                      Kommunikation med grannar och styrelse
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Registration Options */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Så här ansöker du om medlemskap
              </h3>
              
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    1. Automatisk ansökan (Rekommenderat)
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Använd BankID för snabb och säker registrering. Dina uppgifter 
                    hämtas automatiskt och processen tar bara några minuter.
                  </p>
                  <Button
                    onClick={() => setShowForm(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    Starta ansökan med BankID
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">
                    2. Manuell ansökan
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Fyll i uppgifterna manuellt om du inte kan använda BankID. 
                    Kräver senare verifiering av identitet.
                  </p>
                  <Button
                    onClick={() => setShowForm(true)}
                    variant="outline"
                    className="w-full"
                  >
                    Manuell registrering
                  </Button>
                </div>

                <div className="p-4 border rounded-lg bg-purple-50">
                  <h4 className="font-medium text-gray-900 mb-2">
                    3. Har du en inbjudan från styrelsen?
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    Om du har fått en inbjudningskod från styrelsen kan du 
                    använda den för snabbare godkännande.
                  </p>
                  <Button
                    onClick={() => setShowForm(true)}
                    variant="outline"
                    className="w-full border-purple-200 text-purple-700 hover:bg-purple-100"
                  >
                    Använd inbjudningskod
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="bg-gray-50">
            <CardContent className="p-6">
              <h4 className="font-medium text-gray-900 mb-3">
                Frågor om medlemskap?
              </h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>Styrelsen:</strong> styrelsen@dinbrf.se
                </p>
                <p>
                  <strong>Telefon:</strong> 08-123 45 67 (vardagar 9-17)
                </p>
                <p>
                  <strong>Support:</strong> support@brfportal.se
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer Actions */}
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-600">
            <p>
              Redan medlem?{' '}
              <Link
                href="/auth/login"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Logga in här
              </Link>
            </p>
          </div>

          <div>
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Tillbaka till startsidan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <RegisterPageContent />
    </Suspense>
  );
}