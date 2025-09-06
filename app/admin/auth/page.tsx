/**
 * Admin Authentication Testing Page
 * Testing interface for authentication system functionality
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Key,
  UserCheck,
  Lock,
  Shield,
  TestTube,
  CheckCircle,
  AlertTriangle,
  Clock,
  Users
} from 'lucide-react';

const authTests = [
  {
    category: 'Inloggning',
    tests: [
      {
        name: 'Testa giltig inloggning',
        description: 'Verifiera att giltiga uppgifter loggar in användare',
        status: 'ready',
        href: '/admin/auth/login/test-valid'
      },
      {
        name: 'Testa ogiltig inloggning',
        description: 'Verifiera att felaktiga uppgifter avvisas',
        status: 'ready',
        href: '/admin/auth/login/test-invalid'
      },
      {
        name: 'Testa kontolåsning',
        description: 'Verifiera att konton låses efter misslyckade försök',
        status: 'warning',
        href: '/admin/auth/login/test-lockout'
      }
    ]
  },
  {
    category: 'Registrering',
    tests: [
      {
        name: 'Testa användarregistrering',
        description: 'Skapa nya användarkonton med validering',
        status: 'ready',
        href: '/admin/auth/register/test'
      },
      {
        name: 'Testa e-postverifiering',
        description: 'Verifiera e-postverifieringsprocessen',
        status: 'pending',
        href: '/admin/auth/register/email-verification'
      }
    ]
  },
  {
    category: 'Lösenordshantering',
    tests: [
      {
        name: 'Testa lösenordsåterställning',
        description: 'Hela flödet för lösenordsåterställning',
        status: 'ready',
        href: '/admin/auth/password-reset/test'
      },
      {
        name: 'Testa lösenordsstyrka',
        description: 'Validering av lösenordskrav',
        status: 'ready',
        href: '/admin/auth/password/strength-test'
      }
    ]
  },
  {
    category: 'Tvåfaktorsautentisering',
    tests: [
      {
        name: 'Testa 2FA-setup',
        description: 'Installation av tvåfaktorsautentisering',
        status: 'development',
        href: '/admin/auth/2fa/setup-test'
      },
      {
        name: 'Testa 2FA-verifiering',
        description: 'Verifiering med TOTP-koder',
        status: 'development',
        href: '/admin/auth/2fa/verify-test'
      },
      {
        name: 'Testa backup-koder',
        description: 'Användning av backup-koder',
        status: 'development',
        href: '/admin/auth/2fa/backup-codes-test'
      }
    ]
  },
  {
    category: 'Sessionshantering',
    tests: [
      {
        name: 'Testa sessionstimeout',
        description: 'Automatisk utloggning efter inaktivitet',
        status: 'ready',
        href: '/admin/auth/session/timeout-test'
      },
      {
        name: 'Testa samtidiga sessioner',
        description: 'Hantering av flera aktiva sessioner',
        status: 'warning',
        href: '/admin/auth/session/concurrent-test'
      }
    ]
  }
];

function getStatusIcon(status: string) {
  switch (status) {
    case 'ready':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-blue-600" />;
    case 'development':
      return <TestTube className="h-4 w-4 text-purple-600" />;
    default:
      return <Clock className="h-4 w-4 text-gray-600" />;
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'ready':
      return <Badge className="bg-green-100 text-green-800">Redo</Badge>;
    case 'warning':
      return <Badge className="bg-yellow-100 text-yellow-800">Varning</Badge>;
    case 'pending':
      return <Badge className="bg-blue-100 text-blue-800">Väntar</Badge>;
    case 'development':
      return <Badge className="bg-purple-100 text-purple-800">Utveckling</Badge>;
    default:
      return <Badge className="bg-gray-100 text-gray-800">Okänt</Badge>;
  }
}

export default function AuthTestingPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Autentiseringstest</h1>
        <p className="mt-2 text-gray-600">
          Testverktyg för att validera autentiseringssystemets funktionalitet
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">Redo att testa</p>
                <p className="text-lg font-bold">
                  {authTests.flatMap(cat => cat.tests).filter(test => test.status === 'ready').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TestTube className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm font-medium">Under utveckling</p>
                <p className="text-lg font-bold">
                  {authTests.flatMap(cat => cat.tests).filter(test => test.status === 'development').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-sm font-medium">Kräver uppmärksamhet</p>
                <p className="text-lg font-bold">
                  {authTests.flatMap(cat => cat.tests).filter(test => test.status === 'warning').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">Totala tester</p>
                <p className="text-lg font-bold">
                  {authTests.flatMap(cat => cat.tests).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Categories */}
      <div className="grid gap-6">
        {authTests.map((category) => (
          <Card key={category.category}>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TestTube className="h-5 w-5" />
                <span>{category.category}</span>
              </CardTitle>
              <CardDescription>
                {category.tests.length} tillgängliga tester
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {category.tests.map((test) => (
                  <div
                    key={test.name}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(test.status)}
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {test.name}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {test.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {getStatusBadge(test.status)}
                      <Link href={test.href}>
                        <Button size="sm" variant="outline">
                          Kör test
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Snabbåtgärder</CardTitle>
          <CardDescription>
            Vanliga autentiseringsrelaterade administrationsuppgifter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/users">
              <Button className="w-full justify-start" variant="outline">
                <Users className="h-4 w-4 mr-2" />
                Hantera användare
              </Button>
            </Link>
            
            <Link href="/admin/auth/session-monitor">
              <Button className="w-full justify-start" variant="outline">
                <Activity className="h-4 w-4 mr-2" />
                Övervaka sessioner
              </Button>
            </Link>
            
            <Link href="/admin/testing/security">
              <Button className="w-full justify-start" variant="outline">
                <Shield className="h-4 w-4 mr-2" />
                Säkerhetstester
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}