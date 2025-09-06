/**
 * Admin Dashboard Layout for BRF Portal
 * Provides navigation and common layout for admin features
 */

import { Metadata } from 'next';
import AdminNavigation from './components/AdminNavigation';
import AdminHeader from './components/AdminHeader';

export const metadata: Metadata = {
  title: 'Admin Dashboard - BRF Portal',
  description: 'Administrationspanel för BRF Portal - hantera alla systemfunktioner',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header */}
      <AdminHeader />
      
      {/* Admin Content */}
      <div className="flex">
        {/* Sidebar Navigation */}
        <AdminNavigation />
        
        {/* Main Content Area */}
        <main className="flex-1 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}