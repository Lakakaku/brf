# BRF Portal Component Library

A comprehensive component library built with Radix UI and Tailwind CSS specifically for Swedish BRF (Bostadsrättsförening) portal applications.

## Overview

This component library provides accessible, professionally styled components optimized for BRF management systems including:

- Member management interfaces
- Financial data display
- Document management
- Administrative dashboards
- BRF-specific forms and data entry

## Components Included

### Core Components

- **Button** - Multiple variants (default, destructive, outline, secondary, ghost, link)
- **Card** - Container component with header, content, and footer sections
- **Dialog** - Modal dialogs for forms and confirmations
- **Input** - Text input fields with proper styling
- **Label** - Accessible form labels
- **Select** - Dropdown select components
- **Textarea** - Multi-line text input
- **Checkbox** - Checkbox inputs with proper accessibility

### Data Display

- **Table** - Responsive tables for displaying member data, financial records
- **Badge** - Status indicators for member status, payment status, etc.
- **Separator** - Visual dividers for content sections
- **Progress** - Progress indicators for various processes

### Navigation & Layout

- **Tabs** - Tabbed navigation for organizing content
- **Popover** - Floating content containers
- **Tooltip** - Contextual help and information

## Installation

The components are already installed in your project. Dependencies include:

```json
{
  "@radix-ui/react-*": "Latest versions of required Radix UI primitives",
  "class-variance-authority": "For component variants",
  "clsx": "For conditional classes",
  "tailwind-merge": "For merging Tailwind classes",
  "lucide-react": "For icons",
  "date-fns": "For date handling"
}
```

## Usage

### Basic Import

```tsx
import { Button, Card, CardHeader, CardTitle } from '@/components/ui';
```

### Example: Member Registration Form

```tsx
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui';

function MemberRegistrationForm() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>New Member Registration</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='name'>Full Name</Label>
          <Input id='name' placeholder='Anna Andersson' />
        </div>

        <div className='space-y-2'>
          <Label htmlFor='apartment'>Apartment</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder='Select apartment' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='a101'>A101</SelectItem>
              <SelectItem value='b202'>B202</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className='w-full'>Register Member</Button>
      </CardContent>
    </Card>
  );
}
```

### Example: Member Data Table

```tsx
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Badge,
} from '@/components/ui';

function MemberDirectory({ members }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Apartment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Monthly Dues</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map(member => (
          <TableRow key={member.id}>
            <TableCell>{member.name}</TableCell>
            <TableCell>{member.apartment}</TableCell>
            <TableCell>
              <Badge
                variant={member.status === 'active' ? 'default' : 'secondary'}
              >
                {member.status}
              </Badge>
            </TableCell>
            <TableCell className='font-mono'>{member.dues} kr</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

## Styling and Theming

The components use CSS custom properties for theming, defined in `app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96%;
  /* ... more theme variables */
}
```

### BRF-Specific Utilities

Special utility classes are available for BRF-specific use cases:

- `.financial-positive` - Green text for positive amounts
- `.financial-negative` - Red text for negative amounts
- `.section-economy` - Economy section color
- `.section-members` - Member management color
- `.swedish-currency` - Automatically adds "kr" suffix

## Component Variants

### Button Variants

- `default` - Primary action button
- `destructive` - Delete/remove actions
- `outline` - Secondary actions
- `secondary` - Tertiary actions
- `ghost` - Minimal styling
- `link` - Link-styled button

### Button Sizes

- `default` - Standard size
- `sm` - Small size
- `lg` - Large size
- `icon` - Square icon button

### Badge Variants

- `default` - Primary status
- `secondary` - Secondary status
- `destructive` - Error/warning status
- `outline` - Outlined style

## Accessibility

All components follow WCAG 2.1 guidelines and include:

- Proper ARIA labels and descriptions
- Keyboard navigation support
- Screen reader compatibility
- Focus management
- High contrast support

## File Structure

```
components/
├── ui/                     # Core UI components
│   ├── badge.tsx
│   ├── button.tsx
│   ├── card.tsx
│   ├── checkbox.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── popover.tsx
│   ├── progress.tsx
│   ├── select.tsx
│   ├── separator.tsx
│   ├── table.tsx
│   ├── tabs.tsx
│   ├── textarea.tsx
│   ├── tooltip.tsx
│   └── index.ts           # Export all components
├── examples/
│   └── brf-components-showcase.tsx  # Example implementations
├── index.ts               # Main export file
└── README.md             # This documentation
```

## BRF-Specific Features

### Financial Display Components

Components are optimized for Swedish financial data:

- Automatic "kr" currency formatting
- Tabular number support for aligned columns
- Positive/negative amount styling

### Member Management

Specialized components for BRF member management:

- Member status badges
- Apartment selection components
- Swedish personal number formatting

### Document Management

Components for BRF document handling:

- Document status indicators
- File upload components
- Meeting minutes displays

## Example Showcase

A comprehensive showcase of all components is available at:
`/components/examples/brf-components-showcase.tsx`

This showcases real BRF use cases including:

- Member directory tables
- Registration forms
- Financial dashboards
- Administrative interfaces

## Contributing

When adding new components:

1. Follow the existing naming conventions
2. Include proper TypeScript types
3. Add to the main export files
4. Include accessibility features
5. Test with Swedish text and data formats
