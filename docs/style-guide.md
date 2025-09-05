# BRF Portal - Style Guide

## Design Philosophy

BRF Portal embodies a design philosophy that balances **professionalism with approachability**. Our visual identity conveys trust and reliability while maintaining a modern, friendly aesthetic that makes property management accessible to all users.

**Core Principles:**

- **Trustworthy**: Clean, professional aesthetics that instill confidence
- **Approachable**: Warm, friendly elements that reduce intimidation
- **Clear**: High contrast and readable typography for all ages
- **Playful**: Subtle animations and delightful interactions
- **Scandinavian**: Clean lines, plenty of white space, natural inspiration

## Color Palette

### Primary Colors

**Forest Green** - Primary Brand Color

- `#2D5A27` (Dark)
- `#4A8B3A` (Base)
- `#6BA05B` (Light)
- `#E8F4E6` (Background tint)

**Ocean Blue** - Secondary Brand Color

- `#1B4D5C` (Dark)
- `#2B7A8C` (Base)
- `#4A9BAE` (Light)
- `#E6F3F6` (Background tint)

**Cyan Accent**

- `#0891B2` (Vibrant)
- `#22D3EE` (Bright)
- `#A5F3FC` (Soft)
- `#ECFEFF` (Background)

### Supporting Colors

**Warm Grays** - For text and subtle elements

- `#374151` (Charcoal - primary text)
- `#6B7280` (Slate - secondary text)
- `#9CA3AF` (Light gray - subtle text)
- `#F3F4F6` (Background gray)
- `#FFFFFF` (Pure white)

**Accent Colors** - For variety and emphasis

- `#F59E0B` (Warm amber - warnings, highlights)
- `#EF4444` (Coral red - errors, urgent actions)
- `#8B5CF6` (Soft purple - premium features)
- `#06B6D4` (Turquoise - information, links)
- `#10B981` (Success green - confirmations)

**Seasonal/Contextual Colors**

- `#F97316` (Autumn orange - maintenance notifications)
- `#EC4899` (Rose pink - member communications)
- `#84CC16` (Fresh lime - new features)
- `#3B82F6` (Sky blue - system messages)

## Typography

### Font Families

**Primary: Inter** - Modern, highly legible sans-serif

- Headlines: Inter Bold (700)
- Subheadings: Inter SemiBold (600)
- Body text: Inter Regular (400)
- Captions: Inter Medium (500)

**Secondary: JetBrains Mono** - For code, references, and technical data

- Code snippets
- Property reference numbers
- Financial figures

### Typography Scale

```css
/* Headlines */
h1: 2.5rem (40px) / Line height 1.2 / Font weight 700
h2: 2rem (32px) / Line height 1.3 / Font weight 600
h3: 1.5rem (24px) / Line height 1.4 / Font weight 600
h4: 1.25rem (20px) / Line height 1.4 / Font weight 600

/* Body text */
Large body: 1.125rem (18px) / Line height 1.6 / Font weight 400
Body: 1rem (16px) / Line height 1.6 / Font weight 400
Small: 0.875rem (14px) / Line height 1.5 / Font weight 400
Caption: 0.75rem (12px) / Line height 1.4 / Font weight 500
```

## Gradients & Effects

### Brand Gradients

**Primary Gradient** - Forest to Ocean

```css
background: linear-gradient(135deg, #4a8b3a 0%, #2b7a8c 100%);
```

**Accent Gradient** - Cyan Flow

```css
background: linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%);
```

**Subtle Background** - Light Wash

```css
background: linear-gradient(135deg, #e8f4e6 0%, #e6f3f6 100%);
```

### Shadows & Depth

**Card Shadow** - Subtle depth

```css
box-shadow:
  0 1px 3px rgba(0, 0, 0, 0.1),
  0 1px 2px rgba(0, 0, 0, 0.06);
```

**Elevated Shadow** - Important elements

```css
box-shadow:
  0 4px 6px rgba(0, 0, 0, 0.1),
  0 2px 4px rgba(0, 0, 0, 0.06);
```

**Focus Shadow** - Interactive elements

```css
box-shadow: 0 0 0 3px rgba(74, 139, 58, 0.1);
```

## Layout & Spacing

### Grid System

**Desktop**: 12-column grid with 24px gutters
**Tablet**: 8-column grid with 20px gutters  
**Mobile**: 4-column grid with 16px gutters

### Spacing Scale

Based on 8px units for consistent rhythm:

```css
xs: 4px    /* 0.5 units */
sm: 8px    /* 1 unit */
md: 16px   /* 2 units */
lg: 24px   /* 3 units */
xl: 32px   /* 4 units */
2xl: 48px  /* 6 units */
3xl: 64px  /* 8 units */
4xl: 96px  /* 12 units */
```

## Component Styling

### Buttons

**Primary Button**

```css
background: linear-gradient(135deg, #4a8b3a 0%, #2b7a8c 100%);
color: #ffffff;
border-radius: 8px;
padding: 12px 24px;
font-weight: 600;
transition: all 0.2s ease;
```

**Secondary Button**

```css
background: transparent;
color: #4a8b3a;
border: 2px solid #4a8b3a;
border-radius: 8px;
padding: 10px 22px;
```

**Accent Button**

```css
background: #22d3ee;
color: #1b4d5c;
border-radius: 8px;
padding: 12px 24px;
font-weight: 600;
```

### Cards & Containers

**Primary Card**

```css
background: #ffffff;
border-radius: 12px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
border: 1px solid #f3f4f6;
```

**Highlighted Card**

```css
background: linear-gradient(135deg, #e8f4e6 0%, #e6f3f6 100%);
border: 1px solid #4a8b3a;
border-radius: 12px;
```

### Form Elements

**Input Fields**

```css
border: 2px solid #e5e7eb;
border-radius: 8px;
padding: 12px 16px;
background: #ffffff;
transition: border-color 0.2s ease;

/* Focus state */
border-color: #4a8b3a;
box-shadow: 0 0 0 3px rgba(74, 139, 58, 0.1);
```

## Icons & Illustrations

### Icon Style

- **Style**: Outline icons with 2px stroke weight
- **Size**: 16px, 20px, 24px, 32px standard sizes
- **Color**: Inherit from parent or use brand colors
- **Library**: Heroicons, Feather Icons, or custom SVGs

### Illustration Approach

- **Style**: Friendly, geometric illustrations
- **Colors**: Use brand palette with soft gradients
- **Subjects**: Swedish-inspired elements (forests, water, buildings)
- **Mood**: Professional yet approachable

## Animation & Micro-interactions

### Transition Timing

```css
/* Standard transitions */
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

/* Slower for complex animations */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
```

### Hover Effects

- **Buttons**: Slight scale (1.02x) + shadow increase
- **Cards**: Lift with enhanced shadow
- **Links**: Color transition to accent cyan

### Loading States

- **Color**: Brand green with opacity animation
- **Style**: Clean, minimal spinners or skeleton screens

## Accessibility

### Contrast Ratios

- **Normal text**: Minimum 4.5:1 contrast ratio
- **Large text**: Minimum 3:1 contrast ratio
- **Interactive elements**: Clear focus indicators

### Color Usage

- Never rely on color alone to convey information
- Provide alternative indicators (icons, text, patterns)
- Ensure sufficient contrast for all color combinations

## Usage Guidelines

### Do's

✅ Use plenty of white space for breathing room
✅ Combine colors thoughtfully - avoid more than 3 colors per interface
✅ Apply gradients subtly for depth, not decoration
✅ Maintain consistent spacing using the 8px scale
✅ Use forest green for primary actions and ocean blue for secondary

### Don'ts

❌ Use neon or overly saturated colors
❌ Create busy interfaces with too many competing elements
❌ Mix warm and cool grays in the same design
❌ Ignore the spacing scale - avoid arbitrary measurements
❌ Use more than one gradient in a single component

## Brand Voice in Visual Design

The visual design should reflect our brand personality:

- **Professional but approachable**: Clean layouts with friendly touches
- **Trustworthy**: Consistent, predictable interface patterns
- **Efficient**: Clear hierarchy and logical information flow
- **Distinctly Nordic**: Inspired by Swedish nature and design principles
