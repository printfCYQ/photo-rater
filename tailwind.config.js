/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base surfaces — tinted warm charcoal (never pure black)
        base: {
          DEFAULT: "#0d0d10",
          50: "#f5f5f6",
          100: "#e6e6e8",
          200: "#cfcfd3",
          300: "#a8a8af",
          400: "#7a7a84",
          500: "#5f5f6a",
          600: "#4a4a54",
          700: "#3a3a43",
          800: "#27272d",
          900: "#17171b",
          950: "#0d0d10",
        },
        // Elevated surfaces — progressively lighter for depth
        surface: {
          DEFAULT: "#141418",
          alt: "#1a1a1f",
          raised: "#212128",
          overlay: "#2a2a32",
        },
        // Accent — dynamic via CSS variables, used sparingly for focus
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          light: "hsl(var(--accent-light) / <alpha-value>)",
          muted: "hsl(var(--accent-muted))",
          glow: "hsl(var(--accent-glow))",
          50: "hsl(var(--accent-50) / <alpha-value>)",
          100: "hsl(var(--accent-100) / <alpha-value>)",
          200: "hsl(var(--accent-200) / <alpha-value>)",
          300: "hsl(var(--accent-300) / <alpha-value>)",
          400: "hsl(var(--accent-400) / <alpha-value>)",
          500: "hsl(var(--accent-500) / <alpha-value>)",
          600: "hsl(var(--accent-600) / <alpha-value>)",
          700: "hsl(var(--accent-700) / <alpha-value>)",
          800: "hsl(var(--accent-800) / <alpha-value>)",
          900: "hsl(var(--accent-900) / <alpha-value>)",
          950: "hsl(var(--accent-950) / <alpha-value>)",
        },
        // Semantic
        keep: {
          DEFAULT: "#10b981",
          light: "#34d399",
          muted: "rgba(16,185,129,0.12)",
          glow: "rgba(16,185,129,0.22)",
        },
        reject: {
          DEFAULT: "#f43f5e",
          light: "#fb7185",
          muted: "rgba(244,63,94,0.12)",
          glow: "rgba(244,63,94,0.22)",
        },
        warning: {
          DEFAULT: "#f59e0b",
          light: "#fbbf24",
          muted: "rgba(245,158,11,0.12)",
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          '"JetBrains Mono"',
          '"Fira Code"',
          'monospace',
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],
        base: ['0.875rem', { lineHeight: '1.5rem' }],
        lg: ['1rem', { lineHeight: '1.5rem' }],
        xl: ['1.125rem', { lineHeight: '1.5rem' }],
        '2xl': ['1.375rem', { lineHeight: '1.75rem' }],
        '3xl': ['1.75rem', { lineHeight: '2rem' }],
      },
      borderRadius: {
        xs: '3px',
        sm: '5px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
      },
      boxShadow: {
        'surface': '0 1px 3px rgba(0,0,0,0.3)',
        'card': '0 2px 8px rgba(0,0,0,0.2)',
        'card-hover': '0 8px 24px rgba(0,0,0,0.35)',
        'overlay': '0 12px 40px rgba(0,0,0,0.5)',
        'glow-sm': '0 0 12px var(--tw-shadow-color)',
        'glow': '0 0 24px var(--tw-shadow-color)',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-in-slow': 'fadeIn 400ms ease-out',
        'slide-up': 'slideUp 300ms cubic-bezier(0.16,1,0.3,1)',
        'slide-down': 'slideDown 200ms cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.16,1,0.3,1)',
        'shimmer': 'shimmer 2s infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
};
