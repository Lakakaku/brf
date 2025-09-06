/**
 * Admin Users Management Page
 * Interface for managing users, roles, and permissions
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  Search,
  Plus,
  Shield,
  Edit,
  Trash2,
  Mail,
  Clock,
  UserCheck,
  UserX,
  Settings
} from 'lucide-react';

// Mock user data - in real app this would come from API
const mockUsers = [
  {
    id: '1',
    firstName: 'Anna',
    lastName: 'Andersson',
    email: 'anna.andersson@brf.se',
    role: 'admin',
    isActive: true,
    lastLogin: '2025-01-15 14:30',
    createdAt: '2024-12-01',
    apartmentNumber: 'A101'
  },
  {
    id: '2',
    firstName: 'Per',
    lastName: 'Svensson',
    email: 'per.svensson@brf.se',
    role: 'chairman',
    isActive: true,
    lastLogin: '2025-01-15 12:15',
    createdAt: '2024-11-15',
    apartmentNumber: 'B205'
  },
  {
    id: '3',
    firstName: 'Maria',
    lastName: 'Larsson',
    email: 'maria.larsson@brf.se',
    role: 'treasurer',
    isActive: true,
    lastLogin: '2025-01-15 10:45',
    createdAt: '2024-11-20',
    apartmentNumber: 'C312'
  },
  {
    id: '4',
    firstName: 'Erik',
    lastName: 'Nilsson',
    email: 'erik.nilsson@brf.se',
    role: 'board',
    isActive: true,
    lastLogin: '2025-01-15 09:20',
    createdAt: '2024-12-10',
    apartmentNumber: 'A203'
  },
  {
    id: '5',
    firstName: 'Sara',
    lastName: 'Johansson',
    email: 'sara.johansson@brf.se',
    role: 'member',
    isActive: false,
    lastLogin: '2025-01-10 16:30',
    createdAt: '2024-10-05',
    apartmentNumber: 'B108'
  },
  {
    id: '6',
    firstName: 'Lars',
    lastName: 'Petersson',
    email: 'lars.petersson@brf.se',
    role: 'member',
    isActive: true,
    lastLogin: '2025-01-14 20:15',
    createdAt: '2024-09-12',
    apartmentNumber: 'C407'
  }
];

function getRoleBadge(role: string) {
  const styles = {
    admin: 'bg-red-100 text-red-800',
    chairman: 'bg-purple-100 text-purple-800',
    treasurer: 'bg-blue-100 text-blue-800',
    board: 'bg-green-100 text-green-800',
    member: 'bg-gray-100 text-gray-800'
  };

  const labels = {
    admin: 'Administrator',
    chairman: 'Ordförande',
    treasurer: 'Kassör',
    board: 'Styrelseledamot',
    member: 'Medlem'
  };

  return (
    <Badge className={styles[role as keyof typeof styles] || styles.member}>
      {labels[role as keyof typeof labels] || 'Medlem'}
    </Badge>
  );
}

export default function UsersManagementPage() {
  const activeUsers = mockUsers.filter(user => user.isActive).length;
  const totalUsers = mockUsers.length;
  const adminUsers = mockUsers.filter(user => ['admin', 'chairman', 'treasurer'].includes(user.role)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Användarhantering</h1>
          <p className="mt-2 text-gray-600">
            Hantera användare, roller och behörigheter för BRF Portal
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Lägg till användare
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totala användare</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktiva användare</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inaktiva användare</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalUsers - activeUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Administratörer</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{adminUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Filtrera användare</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Sök efter namn, email eller lägenhetsnummer..."
                  className="pl-10"
                />
              </div>
            </div>
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Alla användare</CardTitle>
          <CardDescription>
            Lista över alla registrerade användare i systemet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Användare</TableHead>
                  <TableHead>Lägenhet</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Senaste inloggning</TableHead>
                  <TableHead>Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {user.apartmentNumber}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getRoleBadge(user.role)}
                    </TableCell>
                    <TableCell>
                      {user.isActive ? (
                        <Badge className="bg-green-100 text-green-800">
                          Aktiv
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800">
                          Inaktiv
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-gray-600">
                        <Clock className="h-3 w-3" />
                        <span>{user.lastLogin}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline">
                          <Mail className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Bulk-åtgärder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Mail className="h-4 w-4 mr-2" />
              Skicka mail till alla
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <UserCheck className="h-4 w-4 mr-2" />
              Aktivera markerade
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <UserX className="h-4 w-4 mr-2" />
              Inaktivera markerade
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rapporter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              Exportera användarlista
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Aktivitetsrapport
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Rollfördelning
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Inställningar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Shield className="h-4 w-4 mr-2" />
              Roller & behörigheter
            </Button>
            <Button variant="outline" className="w-full justify-start">
              Registreringsinställningar
            </Button>
            <Button variant="outline" className="w-full justify-start">
              E-postmallar
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}