# BRF Portal - UX Rules & Guidelines

## UX Philosophy

BRF Portal serves housing cooperative board members who are often volunteers with varying technical expertise. Our UX prioritizes **clarity over cleverness**, **efficiency over flashiness**, and **confidence over complexity**.

**Core UX Principles:**

1. **Clarity First**: Every interaction should be immediately understandable
2. **Progressive Disclosure**: Show what's needed, when it's needed
3. **Forgiving Design**: Make errors hard to make and easy to fix
4. **Inclusive Experience**: Accessible to all ages and technical comfort levels
5. **Efficient Workflows**: Minimize steps for common tasks

## User Experience Fundamentals

### Information Architecture

#### Navigation Hierarchy

```
Primary Navigation (Always Visible)
├── Dashboard (Home)
├── Documents
├── Finances
├── Members
├── Maintenance
└── Settings

Secondary Navigation (Contextual)
├── Filters & Search
├── Action Buttons
└── Status Indicators
```

#### Content Priority

1. **Critical Actions**: Large, prominent placement
2. **Frequent Tasks**: Easy access within 1-2 clicks
3. **Important Information**: Above the fold, clear hierarchy
4. **Supporting Details**: Available but not distracting
5. **Administrative Functions**: Accessible but tucked away

### User Mental Models

#### "Control Center" Model

Users should feel like they're in a control center where:

- Everything important is visible at a glance
- Actions have clear, immediate feedback
- Status is always clear and up-to-date
- Problems are highlighted and actionable

#### "Guided Journey" Model

For complex tasks, users follow clear paths:

- Step-by-step processes with progress indicators
- Clear "next steps" at each stage
- Easy ability to save and return later
- Helpful context and tips along the way

## Interaction Design Patterns

### Primary Actions

#### The "Big Green Button" Rule

- Most important action in any context gets the primary button treatment
- Only ONE primary button visible at a time per section
- Button text uses active verbs ("Upload Documents", "Send Invoice", "Create Report")
- Always provide clear outcome expectation

#### Secondary Actions

- Support the primary action without competing
- Use secondary button styling (outlined or ghost)
- Group related actions logically
- Provide tooltips for actions that aren't immediately clear

### Form Design

#### Input Principles

```css
/* Form structure */
Label Above Input (Always)
Input Field
Helper Text (When needed)
Error Message (When applicable)
```

**Rules:**

- Labels are clear, specific nouns ("Property Address" not "Address")
- Required fields marked with visual indicator, not just asterisk
- Error messages explain what's wrong AND how to fix it
- Success states provide clear confirmation
- Auto-save for long forms with clear saving indicators

#### Smart Defaults

- Pre-fill known information when possible
- Remember user preferences across sessions
- Suggest common entries based on BRF context
- Provide format examples for complex inputs (Swedish organization numbers, etc.)

### Data Display

#### Dashboard Widgets

- **Card-based layout** for scannable information
- **Status indicators** using color AND icons AND text
- **Trend information** with simple up/down arrows and context
- **Action buttons** embedded in relevant cards

#### Tables & Lists

- **Maximum 7 columns** visible without horizontal scroll
- **Sortable columns** with clear sort indicators
- **Row actions** accessible via hover or consistent right-aligned buttons
- **Pagination** with clear total counts and navigation
- **Empty states** with helpful guidance and primary actions

### Feedback & Status Communication

#### Loading States

```
Instant Response (< 100ms): No loading indicator
Short Wait (100ms - 1s): Subtle spinner or skeleton
Medium Wait (1-5s): Progress bar with descriptive text
Long Wait (5s+): Progress bar + cancel option + time estimate
```

#### Success Feedback

- **Toast notifications** for completed actions
- **Inline confirmation** for form submissions
- **Status badges** for ongoing processes
- **Visual updates** to reflect new state immediately

#### Error Handling

1. **Prevent errors** with validation and smart defaults
2. **Explain errors** in plain Swedish with context
3. **Provide solutions** with specific next steps
4. **Offer alternatives** when primary action fails

## Content & Communication

### Writing Guidelines

#### Tone of Voice

- **Friendly but Professional**: "Vi hjälper dig..." not "Systemet kräver..."
- **Clear and Direct**: Avoid jargon, use everyday Swedish
- **Supportive**: Frame messages as assistance, not commands
- **Confident**: Use active voice and definitive language

#### Button & Action Text

```
Good Examples:
- "Ladda upp dokument" (Upload documents)
- "Skicka till styrelsen" (Send to board)
- "Spara ändringar" (Save changes)
- "Lägg till medlem" (Add member)

Avoid:
- "Klicka här" (Click here)
- "Skicka" (Submit - too generic)
- "OK" (Not descriptive)
- "Fortsätt" (Continue - without context)
```

#### Help Text & Instructions

- **Context-sensitive**: Appears when and where needed
- **Concise**: One sentence when possible
- **Actionable**: Tells users what to do, not what not to do
- **Swedish-specific**: References Swedish regulations and practices

### Information Hierarchy

#### Page Structure Template

```
Page Header
├── Page Title (H1)
├── Key Status Information
└── Primary Action Button

Main Content Area
├── Important Alerts/Notifications
├── Primary Content Sections
├── Supporting Information
└── Secondary Actions

Sidebar (when applicable)
├── Quick Stats
├── Recent Activity
└── Related Actions
```

#### Visual Hierarchy Rules

1. **Size**: Larger elements draw attention first
2. **Color**: Brand colors for important elements, gray for supporting
3. **Position**: Top-left gets priority in Western reading patterns
4. **Spacing**: More space around important elements
5. **Contrast**: Higher contrast for critical information

## Responsive Design Rules

### Breakpoint Strategy

```css
Mobile: < 640px (Primary mobile experience)
Tablet: 640px - 1024px (Simplified desktop layout)
Desktop: > 1024px (Full feature set)
```

### Mobile-First Principles

- **Touch-friendly**: Minimum 44px tap targets
- **Thumb-optimized**: Important actions within thumb reach
- **Simplified navigation**: Collapsible menus and clear hierarchy
- **Single-column layout**: Stack content vertically
- **Swipe gestures**: For common actions like marking complete

### Progressive Enhancement

- **Core functionality** works on all devices
- **Enhanced features** available on larger screens
- **Performance optimization** prioritizes mobile experience
- **Offline capability** for critical functions

## Accessibility Standards

### WCAG 2.1 AA Compliance

#### Visual Accessibility

- **4.5:1 contrast ratio** for normal text
- **3:1 contrast ratio** for large text and UI components
- **Color independence**: Never use color alone to convey information
- **Focus indicators**: Clear, consistent focus styling
- **Text scaling**: Readable at 200% zoom

#### Motor Accessibility

- **44x44px minimum** touch targets
- **Keyboard navigation** for all interactive elements
- **Skip links** for screen reader users
- **Sufficient time** for timed interactions
- **Easy error correction** and prevention

#### Cognitive Accessibility

- **Consistent navigation** and interaction patterns
- **Clear headings** and page structure
- **Simple language** appropriate for general audience
- **Error prevention** and clear recovery paths
- **Progress indicators** for multi-step processes

## Specific BRF Context Rules

### Swedish Compliance Features

- **BankID integration** must be smooth and reassuring
- **GDPR compliance** with clear data usage information
- **Swedish date/number formats** throughout
- **Local business hours** awareness for support features
- **Swedish legal references** in help documentation

### BRF Member Considerations

- **Mixed technical comfort levels**: Accommodate both digital natives and beginners
- **Age diversity**: Clear fonts, generous spacing, simple interactions
- **Time constraints**: Most users are volunteers with limited time
- **Mobile usage**: Many will primarily use phones/tablets
- **Trust building**: Extra care with financial and personal information

### Workflow Optimizations

#### Document Management

- **Drag-and-drop upload** with clear file type guidance
- **Automatic categorization** with manual override option
- **Version control** that's invisible but reliable
- **Search functionality** that works with Swedish terms
- **Export options** for accountants and authorities

#### Financial Tracking

- **Swedish currency formatting** (SEK, proper decimal separators)
- **Budget vs. actual** clear visual comparisons
- **Expense categorization** aligned with BRF accounting standards
- **Automated calculations** with manual verification option
- **Clear audit trails** for transparency

#### Member Communication

- **Bulk messaging** with personal touches
- **Meeting management** with digital voting capability
- **Notice boards** with priority levels
- **Contact management** with privacy controls
- **Integration options** with existing email systems

## Error Prevention Strategies

### Smart Validations

- **Real-time feedback** for form fields
- **Format helpers** for complex inputs (org numbers, etc.)
- **Duplicate detection** with merge suggestions
- **Date/time validation** with Swedish context
- **File type/size** checking before upload

### Confirmation Patterns

- **High-impact actions**: Always require confirmation
- **Bulk operations**: Show clear summary before execution
- **Financial transactions**: Extra verification steps
- **Member communications**: Preview before sending
- **Data deletion**: Clear consequences explanation

### Recovery Mechanisms

- **Undo functionality** for reversible actions
- **Auto-save** for long-form content
- **Draft saving** for complex documents
- **Backup notifications** for peace of mind
- **Version history** for important documents

## Performance & Efficiency

### Loading Experience

- **Skeleton screens** for predictable content layouts
- **Progressive loading** for large datasets
- **Cached data** for frequently accessed information
- **Background updates** for real-time information
- **Offline indicators** when connectivity is poor

### Task Completion

- **One-click actions** for frequent tasks
- **Bulk operations** where appropriate
- **Keyboard shortcuts** for power users
- **Quick filters** for finding information
- **Recent items** for easy re-access

## Quality Assurance

### Testing Requirements

- **Cross-browser testing**: Chrome, Safari, Firefox, Edge
- **Device testing**: iOS/Android phones and tablets
- **Accessibility testing**: Screen readers and keyboard navigation
- **Swedish language testing**: With native speakers
- **BRF workflow testing**: With actual board members

### Success Metrics

- **Task completion rate**: >90% for primary functions
- **Time to completion**: Benchmark and improve monthly
- **Error rates**: <5% for all user-initiated actions
- **User satisfaction**: Regular surveys and feedback
- **Support ticket volume**: Decreasing over time

Remember: **Every design decision should make the BRF board member's life easier, not showcase our design skills.**
