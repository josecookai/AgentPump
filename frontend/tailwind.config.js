/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary Colors
        primary: {
          DEFAULT: '#5B4FFF',
          dark: '#3D34B5',
          light: '#8B7FFF',
        },
        // Secondary Colors
        secondary: {
          DEFAULT: '#00D9C0',
          dark: '#00B8A3',
          light: '#33E5D0',
        },
        // Neutral Colors
        dark: {
          bg: '#0A0B0D',
          card: '#1A1B1F',
          border: '#2A2B30',
          text: {
            primary: '#FFFFFF',
            secondary: '#A0A0AB',
          }
        },
        // Functional Colors
        success: '#00D9C0',
        warning: '#FFB800',
        error: '#FF4D6A',
        info: '#5B4FFF',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'display-lg': ['48px', { lineHeight: '1.2', fontWeight: '700' }],
        'display-md': ['36px', { lineHeight: '1.2', fontWeight: '700' }],
        'display-sm': ['28px', { lineHeight: '1.3', fontWeight: '600' }],
        'h4': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '1.6', fontWeight: '400' }],
        'body': ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
      },
      boxShadow: {
        'card': '0 4px 24px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 8px 32px rgba(91, 79, 255, 0.2)',
        'glow': '0 0 20px rgba(91, 79, 255, 0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
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
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #5B4FFF 0%, #8B7FFF 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #00D9C0 0%, #33E5D0 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0A0B0D 0%, #1A1B1F 100%)',
      },
    },
  },
  plugins: [],
}
