import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // iOS System Colors
        // iPhone 17 Orange Theme
        'ios-blue': '#FF6B35',
        'ios-green': '#34C759',
        'ios-red': '#FF3B30',
        'ios-orange': '#FF9500',
        'ios-purple': '#AF52DE',
        'ios-indigo': '#5856D6',
        'ios-yellow': '#FFCC00',
        'ios-teal': '#5AC8FA',
        'ios-pink': '#FF2D55',
        'ios-gray': '#8E8E93',
        'ios-gray2': '#AEAEB2',
        'ios-gray3': '#C7C7CC',
        'ios-gray4': '#D1D1D6',
        'ios-gray5': '#E5E5EA',
        'ios-gray6': '#F2F2F7',

        // iOS Label Colors
        'ios-label': '#1C1C1E',
        'ios-label-secondary': '#3A3A3C',
        'ios-label-tertiary': '#8E8E93',

        // iOS backgrounds
        'ios-bg': '#F2F2F7',
        'ios-card': '#FFFFFF',
        'ios-sidebar': '#1C1C1E',
        'ios-sidebar-hover': '#2C2C2E',
        'ios-sidebar-active': '#5C2E1A',

        // iPhone 17 Orange accent palette
        'accent': {
          50: '#FFF0E6',
          100: '#FFD1B3',
          200: '#FFB380',
          300: '#FF944D',
          400: '#FF7A1A',
          500: '#FF6B35',
          600: '#E55A2A',
          700: '#CC4A1F',
          800: '#B33A14',
          900: '#992A0A',
        },
        'sidebar': {
          DEFAULT: '#1C1C1E',
          hover: '#2C2C2E',
          active: '#3A3A3C',
          border: '#38383A',
        },
        'panel': {
          DEFAULT: '#FFFFFF',
          bg: '#F2F2F7',
          border: '#E5E5EA',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '0.9rem' }],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'table': '0 1px 2px rgba(0, 0, 0, 0.03)',
        'ios-sm': '0 1px 3px rgba(0, 0, 0, 0.04)',
        'ios-md': '0 4px 12px rgba(0, 0, 0, 0.06)',
        'ios-lg': '0 8px 30px rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        'ios': '10px',
        'ios-lg': '12px',
        'ios-xl': '16px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ios-fade-in': 'iosFadeSlideIn 0.3s ease-out',
        'spin-ios': 'ios-spin 0.6s linear infinite',
      },
      keyframes: {
        iosFadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ios-spin': {
          to: { transform: 'rotate(360deg)' },
        },
      },
      backdropBlur: {
        'ios': '20px',
      },
    },
  },
  plugins: [],
};

export default config;
