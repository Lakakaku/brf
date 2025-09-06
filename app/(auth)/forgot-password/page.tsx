/**
 * Forgot Password Page for BRF Portal
 * Provides password reset request functionality with Swedish localization
 */

import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Glömt lösenord - BRF Portal',
  description: 'Återställ ditt lösenord för BRF Portalen. Ange din e-postadress så skickar vi dig instruktioner för att återställa lösenordet.',
  robots: 'noindex, nofollow', // Prevent indexing of auth pages
  openGraph: {
    title: 'Glömt lösenord - BRF Portal',
    description: 'Återställ ditt lösenord för BRF Portalen',
    type: 'website',
    locale: 'sv_SE',
  },
};

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="flex min-h-screen">
        {/* Left side - Branding/Info */}
        <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10" />
          <div className="relative z-10 flex items-center justify-center p-12">
            <div className="max-w-md text-white space-y-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold">
                  🏠 BRF Portal
                </h1>
                <p className="text-xl text-blue-100">
                  Återställ ditt lösenord
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-sm font-bold text-blue-900">1</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-100">Ange din e-postadress</h3>
                    <p className="text-sm text-blue-200 mt-1">
                      Använd samma e-postadress som du registrerade kontot med
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-sm font-bold text-blue-900">2</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-100">Kontrollera din e-post</h3>
                    <p className="text-sm text-blue-200 mt-1">
                      Vi skickar dig en säker länk för att återställa lösenordet
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center mt-0.5">
                    <span className="text-sm font-bold text-blue-900">3</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-blue-100">Skapa nytt lösenord</h3>
                    <p className="text-sm text-blue-200 mt-1">
                      Klicka på länken och ange ditt nya säkra lösenord
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-blue-500/30">
                <div className="bg-blue-800/30 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-100 mb-2">🔒 Säkerhet först</h4>
                  <ul className="space-y-1 text-sm text-blue-200">
                    <li>• Återställningslänken är giltig i 1 timme</li>
                    <li>• Länken kan endast användas en gång</li>
                    <li>• Alla sessioner avslutas efter återställning</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-10 right-10 w-20 h-20 bg-blue-400/20 rounded-full" />
          <div className="absolute bottom-20 left-10 w-16 h-16 bg-indigo-400/20 rounded-full" />
          <div className="absolute top-1/2 right-20 w-8 h-8 bg-blue-300/20 rounded-full" />
        </div>

        {/* Right side - Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <ForgotPasswordForm 
              onSuccess={(email) => {
                // Handle successful password reset request
                console.log('Password reset requested for:', email);
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