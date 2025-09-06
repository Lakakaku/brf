/**
 * Credentials Distribution API Route
 * Manages bulk user onboarding and credential distribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  createUserCredentials,
  bulkImportUsers,
  exportUsersToCSV,
  resendCredentials,
  getCredentialDistributionStatus,
  initializeCredentialTables
} from '@/lib/auth/credentials-distribution';
import { validateSession } from '@/lib/auth/tokens';
import { AuthError, AuthErrorType } from '@/lib/auth/types';

// Initialize credential tables on first import
initializeCredentialTables();

/**
 * POST /api/auth/distribute-credentials - Create/distribute credentials
 */
export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Validate session
    const sessionResult = await validateSession(token);
    if (!sessionResult.valid || !sessionResult.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const currentUser = sessionResult.user;

    // Check if user is admin or chairman
    if (currentUser.role !== 'admin' && currentUser.role !== 'chairman') {
      return NextResponse.json(
        { error: 'Insufficient permissions to distribute credentials' },
        { status: 403 }
      );
    }

    // Get request body
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'single': {
        // Create credentials for a single user
        const { email, firstName, lastName, apartmentNumber, role, phoneNumber, sendEmail } = body;

        if (!email || !firstName || !lastName || !apartmentNumber || !role) {
          return NextResponse.json(
            { error: 'Missing required user information' },
            { status: 400 }
          );
        }

        const credential = await createUserCredentials({
          email,
          firstName,
          lastName,
          apartmentNumber,
          role,
          phoneNumber,
          cooperativeId: currentUser.cooperativeId,
          createdBy: currentUser.id,
          sendEmail: sendEmail !== false
        });

        return NextResponse.json({
          success: true,
          user: {
            id: credential.id,
            email: credential.email,
            firstName: credential.firstName,
            lastName: credential.lastName,
            apartmentNumber: credential.apartmentNumber,
            role: credential.role,
            temporaryPassword: credential.temporaryPassword,
            invitationSentAt: credential.invitationSentAt
          }
        });
      }

      case 'bulk': {
        // Bulk import users from CSV
        const { csvData, sendEmails, batchName } = body;

        if (!csvData) {
          return NextResponse.json(
            { error: 'CSV data is required for bulk import' },
            { status: 400 }
          );
        }

        const result = await bulkImportUsers({
          csvData,
          cooperativeId: currentUser.cooperativeId,
          createdBy: currentUser.id,
          sendEmails: sendEmails !== false,
          batchName
        });

        return NextResponse.json({
          success: true,
          result: {
            successCount: result.success,
            failedCount: result.failed,
            errors: result.errors,
            users: result.users.map(u => ({
              id: u.id,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              apartmentNumber: u.apartmentNumber,
              role: u.role
            }))
          }
        });
      }

      case 'resend': {
        // Resend credentials to a user
        const { userId } = body;

        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          );
        }

        await resendCredentials(userId, currentUser.id);

        return NextResponse.json({
          success: true,
          message: 'Credentials resent successfully'
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Credential distribution error:', error);
    
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/auth/distribute-credentials - Get credential distribution status or export
 */
export async function GET(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Validate session
    const sessionResult = await validateSession(token);
    if (!sessionResult.valid || !sessionResult.user) {
      return NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      );
    }

    const currentUser = sessionResult.user;

    // Check permissions
    if (currentUser.role !== 'admin' && currentUser.role !== 'chairman') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query parameters
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'status': {
        // Get distribution status
        const status = await getCredentialDistributionStatus(currentUser.cooperativeId);
        
        return NextResponse.json({
          success: true,
          status
        });
      }

      case 'export': {
        // Export users to CSV
        const includePasswords = url.searchParams.get('includePasswords') === 'true';
        
        // Only admins can export with passwords
        if (includePasswords && currentUser.role !== 'admin') {
          return NextResponse.json(
            { error: 'Only admins can export passwords' },
            { status: 403 }
          );
        }

        const csvData = await exportUsersToCSV(
          currentUser.cooperativeId,
          includePasswords
        );

        // Return as CSV file download
        return new NextResponse(csvData, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="users-${new Date().toISOString().split('T')[0]}.csv"`
          }
        });
      }

      case 'template': {
        // Return CSV template for import
        const template = [
          'email,first_name,last_name,apartment_number,role,phone_number',
          'john.doe@example.com,John,Doe,101,member,+46701234567',
          'jane.smith@example.com,Jane,Smith,102,board,+46709876543'
        ].join('\n');

        return new NextResponse(template, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename="import-template.csv"'
          }
        });
      }

      default: {
        // Default: return distribution status
        const status = await getCredentialDistributionStatus(currentUser.cooperativeId);
        
        return NextResponse.json({
          success: true,
          status
        });
      }
    }

  } catch (error) {
    console.error('Get credential distribution error:', error);
    
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}