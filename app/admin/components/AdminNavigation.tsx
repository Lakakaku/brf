/**
 * Admin Navigation Sidebar Component
 * Provides navigation to all admin features and testing tools
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutDashboard,
  Users,
  FileText,
  CreditCard,
  Calendar,
  Settings,
  Database,
  TestTube,
  ChevronDown,
  ChevronRight,
  Shield,
  Key,
  Mail,
  BarChart3,
  Workflow,
  Home,
  UserCheck,
  Lock,
  AlertTriangle,
  CheckCircle,
  ToggleLeft
} from 'lucide-react';

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  description?: string;
  badge?: string;
  children?: NavItem[];
}

const navigation: NavItem[] = [
  {
    name: 'Översikt',
    href: '/admin',
    icon: LayoutDashboard,
    description: 'Dashboard översikt'
  },
  {
    name: 'Autentisering',
    href: '/admin/auth',
    icon: Shield,
    description: 'Testa autentiseringsfunktioner',
    badge: 'Test',
    children: [
      {
        name: 'Inloggning',
        href: '/admin/auth/login',
        icon: Key,
        description: 'Testa inloggningsflöden'
      },
      {
        name: 'Registrering',
        href: '/admin/auth/register',
        icon: UserCheck,
        description: 'Testa användarregistrering'
      },
      {
        name: 'Lösenordsåterställning',
        href: '/admin/auth/password-reset',
        icon: Lock,
        description: 'Testa lösenordsåterställning'
      },
      {
        name: 'Tvåfaktor (2FA)',
        href: '/admin/auth/2fa',
        icon: Shield,
        description: 'Testa tvåfaktorsautentisering'
      }
    ]
  },
  {
    name: 'Användare',
    href: '/admin/users',
    icon: Users,
    description: 'Hantera användare och roller',
    children: [
      {
        name: 'Alla användare',
        href: '/admin/users',
        icon: Users,
        description: 'Visa alla användare'
      },
      {
        name: 'Roller & behörigheter',
        href: '/admin/users/roles',
        icon: Shield,
        description: 'Hantera roller och behörigheter'
      },
      {
        name: 'Aktivitetslogg',
        href: '/admin/users/activity',
        icon: BarChart3,
        description: 'Användaraktiviteter'
      }
    ]
  },
  {
    name: 'Dokument',
    href: '/admin/documents',
    icon: FileText,
    description: 'Dokumenthantering',
    children: [
      {
        name: 'Alla dokument',
        href: '/admin/documents',
        icon: FileText,
        description: 'Visa alla dokument'
      },
      {
        name: 'Protokoll',
        href: '/admin/documents/protocols',
        icon: FileText,
        description: 'Styrelsemötesprotokoll'
      },
      {
        name: 'Godkännanden',
        href: '/admin/documents/approvals',
        icon: CheckCircle,
        description: 'Dokument som väntar på godkännande'
      }
    ]
  },
  {
    name: 'Fakturor',
    href: '/admin/invoices',
    icon: CreditCard,
    description: 'Fakturahantering',
    children: [
      {
        name: 'Alla fakturor',
        href: '/admin/invoices',
        icon: CreditCard,
        description: 'Visa alla fakturor'
      },
      {
        name: 'Väntar godkännande',
        href: '/admin/invoices/pending',
        icon: AlertTriangle,
        description: 'Fakturor som väntar på godkännande'
      },
      {
        name: 'Betalningshistorik',
        href: '/admin/invoices/history',
        icon: BarChart3,
        description: 'Betalningshistorik'
      }
    ]
  },
  {
    name: 'Bokningar',
    href: '/admin/bookings',
    icon: Calendar,
    description: 'Bokningssystem',
    children: [
      {
        name: 'Alla bokningar',
        href: '/admin/bookings',
        icon: Calendar,
        description: 'Visa alla bokningar'
      },
      {
        name: 'Resurser',
        href: '/admin/bookings/resources',
        icon: Home,
        description: 'Hantera bokningsbara resurser'
      }
    ]
  },
  {
    name: 'E-post',
    href: '/admin/email',
    icon: Mail,
    description: 'E-postsystem',
    badge: 'Test',
    children: [
      {
        name: 'Mallförhandsvisning',
        href: '/admin/email-preview',
        icon: Mail,
        description: 'Förhandsgranska e-postmallar'
      },
      {
        name: 'Skicka testmail',
        href: '/admin/email/test',
        icon: TestTube,
        description: 'Testa e-postfunktioner'
      },
      {
        name: 'Mallar',
        href: '/admin/email/templates',
        icon: FileText,
        description: 'E-postmallar'
      },
      {
        name: 'Logg',
        href: '/admin/email/log',
        icon: BarChart3,
        description: 'E-postlogg'
      }
    ]
  },
  {
    name: 'Database',
    href: '/admin/database',
    icon: Database,
    description: 'Databashantering',
    badge: 'Dev',
    children: [
      {
        name: 'Schema',
        href: '/admin/database/schema',
        icon: Database,
        description: 'Databasschema'
      },
      {
        name: 'Migrations',
        href: '/admin/database/migrations',
        icon: Workflow,
        description: 'Databas migrations'
      },
      {
        name: 'SQL Query',
        href: '/admin/database/query',
        icon: TestTube,
        description: 'Kör SQL-frågor'
      }
    ]
  },
  {
    name: 'Feature Flags',
    href: '/admin/features',
    icon: ToggleLeft,
    description: 'Hantera feature toggles och testning',
    badge: 'Test',
    children: [
      {
        name: 'Alla flags',
        href: '/admin/features',
        icon: ToggleLeft,
        description: 'Hantera feature flags'
      },
      {
        name: 'A/B-testning',
        href: '/admin/features/ab-testing',
        icon: TestTube,
        description: 'A/B-testning och varianter'
      },
      {
        name: 'Användningsstatistik',
        href: '/admin/features/analytics',
        icon: BarChart3,
        description: 'Statistik över feature flag användning'
      },
      {
        name: 'Exempel',
        href: '/admin/features/examples',
        icon: TestTube,
        description: 'Exempel på feature flag användning'
      }
    ]
  },
  {
    name: 'Övervakning',
    href: '/admin/monitoring',
    icon: BarChart3,
    description: 'Systemövervakning och prestanda',
    badge: 'Live',
    children: [
      {
        name: 'Dashboard',
        href: '/admin/monitoring',
        icon: BarChart3,
        description: 'Prestanda dashboard'
      },
      {
        name: 'Larm',
        href: '/admin/monitoring/alerts',
        icon: AlertTriangle,
        description: 'Hantera prestandalarm'
      },
      {
        name: 'Grafana',
        href: 'http://localhost:3001',
        icon: BarChart3,
        description: 'Öppna Grafana dashboard'
      },
      {
        name: 'Prometheus',
        href: 'http://localhost:9090',
        icon: Database,
        description: 'Prometheus metrics'
      }
    ]
  },
  {
    name: 'Systemtest',
    href: '/admin/testing',
    icon: TestTube,
    description: 'Systemtestverktyg',
    badge: 'Dev',
    children: [
      {
        name: 'API-testverktyg',
        href: '/admin/testing/api',
        icon: TestTube,
        description: 'Testa API-endpoints'
      },
      {
        name: 'Prestanda',
        href: '/admin/testing/performance',
        icon: BarChart3,
        description: 'Prestandatester'
      },
      {
        name: 'Säkerhet',
        href: '/admin/testing/security',
        icon: Shield,
        description: 'Säkerhetstester'
      }
    ]
  },
  {
    name: 'Inställningar',
    href: '/admin/settings',
    icon: Settings,
    description: 'Systeminställningar'
  }
];

export default function AdminNavigation() {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = (href: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(href)) {
      newExpanded.delete(href);
    } else {
      newExpanded.add(href);
    }
    setExpandedItems(newExpanded);
  };

  const isActive = (href: string) => {
    return pathname === href || (href !== '/admin' && pathname?.startsWith(href));
  };

  const renderNavItem = (item: NavItem, level = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedItems.has(item.href);
    const active = isActive(item.href);

    return (
      <div key={item.href}>
        {hasChildren ? (
          <button
            onClick={() => toggleExpanded(item.href)}
            className={cn(
              'w-full flex items-center justify-between px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              level > 0 && 'ml-4',
              active
                ? 'bg-blue-100 text-blue-900'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <div className="flex items-center space-x-3">
              <item.icon className="h-5 w-5" />
              <span>{item.name}</span>
              {item.badge && (
                <Badge variant="secondary" className="text-xs">
                  {item.badge}
                </Badge>
              )}
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <Link
            href={item.href}
            className={cn(
              'flex items-center space-x-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              level > 0 && 'ml-4',
              active
                ? 'bg-blue-100 text-blue-900'
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span>{item.name}</span>
            {item.badge && (
              <Badge variant="secondary" className="text-xs">
                {item.badge}
              </Badge>
            )}
          </Link>
        )}

        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map(child => renderNavItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className="w-64 bg-white border-r border-gray-200 h-[calc(100vh-4rem)] overflow-y-auto">
      <div className="p-4">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Administrationsverktyg
        </h2>
        
        <div className="space-y-1">
          {navigation.map(item => renderNavItem(item))}
        </div>
      </div>
    </nav>
  );
}