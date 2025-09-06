/**
 * Authentication layout for BRF Portal
 * Provides consistent layout for authentication pages with Swedish branding
 */

import { Metadata } from 'next';
import Link from 'next/link';
import { Building, Home } from 'lucide-react';

export const metadata: Metadata = {
  title: {
    template: '%s | BRF Portal',
    default: 'BRF Portal - Bostadsrättsförening',
  },
  description: 'Inloggning till BRF-portalen för medlemmar och styrelse',
};

interface AuthLayoutProps {
  children: React.ReactNode;
}

/**
 * Authentication layout component
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg px-2 py-1"
            >
              <Building className="h-8 w-8" />
              <div className="flex flex-col">
                <span className="text-lg font-bold">BRF Portal</span>
                <span className="text-xs text-gray-500">Bostadsrättsförening</span>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden sm:flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-3 py-2"
              >
                <Home className="h-4 w-4" />
                <span>Startsida</span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-md">
          {/* Auth card container */}
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
            {children}
          </div>
          
          {/* Swedish branding footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Säker inloggning för svenska bostadsrättsföreningar
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2 text-gray-500 text-sm">
              <Building className="h-4 w-4" />
              <span>BRF Portal {new Date().getFullYear()}</span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <Link
                href="/privacy"
                className="text-gray-500 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              >
                Integritetspolicy
              </Link>
              <Link
                href="/terms"
                className="text-gray-500 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              >
                Användarvillkor
              </Link>
              <Link
                href="/support"
                className="text-gray-500 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
              >
                Support
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}