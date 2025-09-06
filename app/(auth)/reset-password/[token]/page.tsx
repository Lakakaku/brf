/**
 * Reset Password Page for BRF Portal
 * Provides password reset completion functionality with Swedish localization
 * Dynamic route: /reset-password/[token]
 */

import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

interface ResetPasswordPageProps {
  params: {
    token: string;
  };
}

export const metadata: Metadata = {
  title: 'Återställ lösenord - BRF Portal',
  description: 'Slutför återställningen av ditt lösenord för BRF Portalen. Ange ditt nya säkra lösenord.',
  robots: 'noindex, nofollow', // Prevent indexing of auth pages
  openGraph: {
    title: 'Återställ lösenord - BRF Portal',
    description: 'Slutför återställningen av ditt lösenord för BRF Portalen',
    type: 'website',
    locale: 'sv_SE',
  },
};

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = params;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex min-h-screen">
        {/* Left side - Branding/Security Info */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 via-blue-600 to-indigo-700 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 flex items-center justify-center p-12">
            <div className="max-w-md text-white space-y-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold">
                  🏠 BRF Portal
                </h1>
                <p className="text-xl text-blue-100">
                  Skapa nytt lösenord
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="bg-green-700/30 rounded-lg p-4">
                  <h3 className="font-semibold text-green-100 mb-2">✅ Återställningslänk verifierad</h3>
                  <p className="text-sm text-green-200">
                    Din återställningslänk är giltig. Du kan nu säkert ange ditt nya lösenord.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-blue-100">Lösenordskrav:</h4>
                  <ul className="space-y-2 text-sm text-blue-200">
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                      <span>Minst 8 tecken långt</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                      <span>Innehåller både bokstäver och siffror</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                      <span>Undvik vanliga mönster</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-blue-300 rounded-full" />
                      <span>Använd en unik kombination</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-blue-800/30 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-100 mb-2">🔐 Säkerhetsåtgärder</h4>
                  <ul className="space-y-1 text-sm text-blue-200">
                    <li>• Alla aktiva sessioner kommer att avslutas</li>
                    <li>• Du behöver logga in igen efter återställning</li>
                    <li>• Återställningslänken kan endast användas en gång</li>
                  </ul>
                </div>
              </div>

              <div className="pt-4">
                <div className="bg-amber-600/20 border border-amber-400/30 rounded-lg p-3">
                  <p className="text-xs text-amber-100">
                    <span className="font-semibold">Viktigt:</span> Om du inte begärde denna återställning, 
                    kontakta BRF-styrelsen omedelbart. Det kan indikera att någon försöker få tillgång till ditt konto.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-10 right-10 w-20 h-20 bg-green-400/20 rounded-full" />
          <div className="absolute bottom-20 left-10 w-16 h-16 bg-blue-400/20 rounded-full" />
          <div className="absolute top-1/3 right-20 w-12 h-12 bg-indigo-300/20 rounded-full" />
          <div className="absolute bottom-1/3 right-32 w-6 h-6 bg-green-300/20 rounded-full" />
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <ResetPasswordForm 
              token={token}
              onSuccess={(user) => {
                // Handle successful password reset
                console.log('Password reset successful for user:', user.email);
              }}
              onError={(error) => {
                // Handle error
                console.error('Password reset error:', error);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}