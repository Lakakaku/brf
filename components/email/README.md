# Email Preview System

A comprehensive email template preview and testing system for Swedish BRF (Bostadsrättsförening) cooperative housing management.

## Features

### 🎯 Core Functionality
- **Template Preview**: Real-time HTML and text format preview
- **Variable Substitution**: Live preview with dynamic data injection
- **Swedish BRF Context**: Specialized templates for cooperative housing
- **Test Email Sending**: Mock email system for development testing
- **Responsive Design**: Mobile-first responsive interface
- **Swedish UI Patterns**: Follows Swedish design conventions

### 📧 Email Templates
1. **E-postverifiering** - Email verification for new members
2. **Registrering godkänd** - Welcome messages for approved members
3. **Lösenordsåterställning** - Secure password reset functionality
4. **Inloggningsnotifiering** - Security notifications for new logins
5. **Styrelsemöte** - Board meeting invitations and agendas
6. **Underhållsarbete** - Maintenance work notifications

## Components

### EmailTemplateViewer
```tsx
<EmailTemplateViewer 
  template={emailTemplate}
  templateKey="boardMeetingNotification"
  processedData={dynamicData}
/>
```

**Props:**
- `template: EmailTemplate` - The email template object
- `templateKey: string` - Template identifier for styling
- `processedData?: Record<string, any>` - Data for variable substitution
- `className?: string` - Additional CSS classes

**Features:**
- HTML and text format tabs
- Subject line preview
- Variable substitution display
- Responsive iframe for HTML preview
- Template type badges and icons

### EmailPreviewPanel
```tsx
<EmailPreviewPanel className="w-full" />
```

**Props:**
- `className?: string` - Additional CSS classes

**Features:**
- Template selection dropdown with descriptions
- Dynamic variable input forms
- Live preview updates
- Test email sending functionality
- Swedish BRF sample data
- Responsive grid layout

## Usage

### Admin Interface
Navigate to `/admin/email-preview` to access the email preview system.

### Template Selection
1. Choose from 6 different email template types
2. Each template includes Swedish translations and BRF terminology
3. Templates auto-populate with relevant sample data

### Variable Customization
- Dynamic form generation based on template variables
- Support for text inputs, textareas (for arrays), and special formatting
- Real-time preview updates as you type

### Test Email Sending
1. Enter test email address
2. Click "Skicka testmail"
3. View delivery status and message ID
4. Mock system simulates realistic email delivery

## Swedish BRF Adaptations

### Language & Terminology
- All text in Swedish language
- Proper BRF terminology (bostadsrättsförening, styrelse, etc.)
- Swedish date/time formatting
- Culturally appropriate greetings and closings

### Legal Compliance
- GDPR-compliant unsubscribe links
- Swedish contact information requirements
- Privacy policy references
- Proper sender identification

### Content Examples
- **Board meetings**: Swedish agenda items and procedures
- **Maintenance**: Common Swedish BRF maintenance scenarios
- **Financial**: Swedish accounting and fee terminology
- **Member communications**: Proper Swedish formal communication style

## Technical Implementation

### Architecture
- **Next.js 14** with App Router
- **TypeScript** strict mode
- **Tailwind CSS** for styling
- **Radix UI** components
- **React Server Components** where possible

### Styling Approach
- Mobile-first responsive design
- Swedish color palette (blue primary)
- Consistent spacing and typography
- Accessible contrast ratios
- Swedish UI/UX patterns

### Performance
- Lazy loading for email previews
- Optimized iframe rendering
- Efficient variable substitution
- Minimal re-renders with React optimization

## File Structure
```
components/email/
├── EmailTemplateViewer.tsx  # Template preview component
├── EmailPreviewPanel.tsx    # Main control panel
├── index.ts                 # Component exports
└── README.md               # This documentation

app/admin/email-preview/
└── page.tsx                # Admin page implementation
```

## Integration

### Email Templates
Templates are imported from `@/lib/email/templates` and include:
- HTML and text versions
- Variable placeholders with {{variable}} syntax
- Swedish styling and branding
- Mock sending functionality

### Navigation
Integrated into admin navigation under "E-post" → "Mallförhandsvisning"

### Responsive Breakpoints
- Mobile: Single column layout
- Tablet: Stacked layout with improved spacing
- Desktop: Two-column layout (controls + preview)
- Large screens: Optimized wide layout

## Development Notes

### Mock Email System
- Simulates real email delivery with delays
- 95% success rate for realistic testing
- Includes message IDs and timestamps
- Logs emails to console in development

### Variable System
- Automatic form generation from template data
- Type-safe variable handling
- Support for arrays, strings, numbers, and booleans
- Real-time substitution preview

### Accessibility
- Proper semantic HTML
- Keyboard navigation support
- Screen reader compatible
- High contrast design
- Swedish language attributes

## Future Enhancements

### Potential Features
- Email template editor
- Variable validation
- Batch testing capabilities
- Integration with real email services
- Template versioning
- A/B testing support

### Localization
- Support for additional languages
- Regional BRF variations
- Customizable terminology
- Culture-specific formatting

This email preview system provides a comprehensive solution for managing and testing email communications in Swedish BRF systems, with focus on usability, compliance, and Swedish cultural adaptations.