# Admin Dashboard Documentation

## Overview

The Admin Dashboard provides a comprehensive testing and administration interface for the BRF Portal application. It allows administrators to test all system features, manage users, and monitor system health.

## Features

### 🏠 Dashboard Home (`/admin`)
- System status overview with health indicators
- Quick access to testing features
- Recent activity monitoring
- System statistics and metrics

### 🔐 Authentication Testing (`/admin/auth`)
- Login functionality testing
- User registration validation
- Password reset flow testing
- Two-factor authentication (2FA) testing
- Session management testing

### 👥 User Management (`/admin/users`)
- View and manage all users
- Role and permission management
- Bulk operations on users
- User activity monitoring
- Export user reports

### 📄 Document Management (`/admin/documents`)
- Document approval workflows
- Protocol management
- File upload testing
- Version control

### 💳 Invoice Management (`/admin/invoices`)
- Invoice approval processes
- Payment status tracking
- Financial reporting

### 📅 Booking System (`/admin/bookings`)
- Resource booking management
- Calendar system testing
- Booking validation

### 📧 Email System (`/admin/email`)
- Email template management
- Test email functionality
- Email delivery monitoring

### 🗄️ Database Tools (`/admin/database`)
- Schema visualization
- SQL query execution
- Migration management
- Data integrity checks

### 🧪 System Testing (`/admin/testing`)
- API endpoint testing
- Performance monitoring
- Security testing
- Integration tests

## Access Control

The admin dashboard is protected by role-based access control:

- **Admin Role Required**: Only users with the `admin` role can access `/admin/*` routes
- **Active Account**: User must have an active account (`isActive: true`)
- **Session Validation**: Valid session or JWT token required

### Middleware Protection

The dashboard uses Next.js middleware for route protection:
- Redirects unauthorized users to login page
- Preserves return URL for post-login redirection
- Handles authentication errors gracefully

## Components

### Layout Components
- `AdminLayout`: Main layout with navigation and header
- `AdminHeader`: Top navigation with user menu and logout
- `AdminNavigation`: Sidebar navigation with categorized menu items

### Page Components
- `AdminDashboard`: Main dashboard with overview widgets
- `AuthTestingPage`: Authentication testing interface
- `UsersManagementPage`: User administration interface

## Navigation Structure

```
Admin Dashboard
├── Overview (Dashboard home)
├── Authentication
│   ├── Login Testing
│   ├── Registration Testing
│   ├── Password Reset
│   └── Two-Factor Auth
├── Users
│   ├── All Users
│   ├── Roles & Permissions
│   └── Activity Log
├── Documents
│   ├── All Documents
│   ├── Protocols
│   └── Approvals
├── Invoices
│   ├── All Invoices
│   ├── Pending Approval
│   └── Payment History
├── Bookings
│   ├── All Bookings
│   └── Resources
├── Email
│   ├── Test Email
│   ├── Templates
│   └── Email Log
├── Database
│   ├── Schema
│   ├── Migrations
│   └── SQL Query
├── Testing
│   ├── API Testing
│   ├── Performance
│   └── Security
└── Settings
```

## Usage

### Accessing the Dashboard
1. Ensure you have an admin account
2. Navigate to `/admin`
3. If not logged in, you'll be redirected to login
4. After successful authentication with admin role, access the dashboard

### Testing Features
1. Use the navigation sidebar to access different testing areas
2. Each section provides specific tools for testing system components
3. Monitor system status from the main dashboard
4. Review recent activity and system health indicators

### User Management
1. Navigate to Users section
2. View all users with filtering and search capabilities
3. Manage user roles and permissions
4. Perform bulk operations on selected users
5. Export user data and reports

## Swedish Language Support

The entire admin interface is localized in Swedish:
- UI labels and descriptions in Swedish
- Swedish role names (Ordförande, Kassör, etc.)
- Swedish status indicators and error messages
- Swedish date and time formatting

## Development

### Adding New Admin Pages
1. Create new page in `/app/admin/[section]/` directory
2. Add navigation item to `AdminNavigation` component
3. Implement proper TypeScript interfaces
4. Follow the existing pattern for layout and styling

### Testing Access
- Use the development authentication utilities
- Create test admin users through the registration system
- Verify middleware protection works correctly

## Security Considerations

- All admin routes are protected by middleware
- User roles are verified on each request
- Session validation prevents unauthorized access
- Audit logging tracks administrative actions
- CSRF protection for sensitive operations

## Future Enhancements

- Real-time system monitoring
- Advanced reporting and analytics
- Automated testing execution
- Integration with external monitoring tools
- Enhanced security scanning and alerts