import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // BRF Portal Color Palette - Professional & Trustworthy
      colors: {
        // BRF-specific brand colors
        'brf-primary': {
          50: '#f0f8ff', // Light blue tint for backgrounds
          100: '#e0f2fe', // Very light blue
          200: '#bae6fd', // Light blue for hover states
          300: '#7dd3fc', // Medium light blue
          400: '#38bdf8', // Medium blue
          500: '#0ea5e9', // Primary blue - professional and trustworthy
          600: '#0284c7', // Darker blue for active states
          700: '#0369a1', // Dark blue for text
          800: '#075985', // Very dark blue
          900: '#0c4a6e', // Darkest blue
        },

        // BRF-specific secondary colors - warm gray for balance
        'brf-secondary': {
          50: '#f8fafc', // Lightest gray
          100: '#f1f5f9', // Very light gray
          200: '#e2e8f0', // Light gray for borders
          300: '#cbd5e1', // Medium light gray
          400: '#94a3b8', // Medium gray for placeholders
          500: '#64748b', // Primary gray for secondary text
          600: '#475569', // Darker gray
          700: '#334155', // Dark gray for headings
          800: '#1e293b', // Very dark gray
          900: '#0f172a', // Darkest gray
        },

        // BRF-specific accent colors for specific use cases
        'brf-accent': {
          // Green for positive actions (approve, success)
          success: {
            50: '#f0fdf4',
            100: '#dcfce7',
            200: '#bbf7d0',
            500: '#22c55e',
            600: '#16a34a',
            700: '#15803d',
          },
          // Amber for warnings and pending items
          warning: {
            50: '#fffbeb',
            100: '#fef3c7',
            200: '#fde68a',
            500: '#f59e0b',
            600: '#d97706',
            700: '#b45309',
          },
          // Red for errors and critical actions
          error: {
            50: '#fef2f2',
            100: '#fee2e2',
            200: '#fecaca',
            500: '#ef4444',
            600: '#dc2626',
            700: '#b91c1c',
          },
          // Blue for informational messages
          info: {
            50: '#eff6ff',
            100: '#dbeafe',
            200: '#bfdbfe',
            500: '#3b82f6',
            600: '#2563eb',
            700: '#1d4ed8',
          },
        },

        // Financial data colors
        financial: {
          positive: '#16a34a', // Green for positive amounts
          negative: '#dc2626', // Red for negative amounts/debt
          neutral: '#64748b', // Gray for neutral amounts
          budget: '#0ea5e9', // Blue for budget items
        },

        // Semantic colors for different sections
        section: {
          economy: '#0ea5e9', // Blue for economy section
          members: '#8b5cf6', // Purple for member management
          property: '#059669', // Green for property management
          documents: '#dc2626', // Red for document management
          maintenance: '#f59e0b', // Orange for maintenance
        },

        // CSS variables for dynamic theming (Radix UI compatible)
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        // Radix UI compatible colors (CSS variables)
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        radius: 'var(--radius)',
      },

      // Typography configuration for Swedish text
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        mono: [
          '"Geist Mono"',
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Consolas',
          '"Liberation Mono"',
          'Menlo',
          'monospace',
        ],
        display: [
          '"Geist"',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
      },

      // Custom font sizes for professional documents
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        'display-sm': [
          '2rem',
          { lineHeight: '2.5rem', letterSpacing: '-0.025em' },
        ],
        'display-md': [
          '2.5rem',
          { lineHeight: '3rem', letterSpacing: '-0.025em' },
        ],
        'display-lg': [
          '3rem',
          { lineHeight: '3.5rem', letterSpacing: '-0.025em' },
        ],
      },

      // Spacing for consistent layouts
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },

      // Border radius for modern UI
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        none: '0',
        DEFAULT: '0.375rem',
        xl: '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        card: '0.75rem',
        button: '0.5rem',
      },

      // Box shadows for depth
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover':
          '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        modal:
          '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        header: '0 1px 0 0 rgba(0, 0, 0, 0.05)',
      },

      // Animation and transitions
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'pulse-subtle': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },

      // Grid template columns for layouts
      gridTemplateColumns: {
        sidebar: '250px 1fr',
        'main-content': '1fr 300px',
        dashboard: 'repeat(auto-fit, minmax(300px, 1fr))',
      },
    },
  },
  plugins: [],
};
export default config;
