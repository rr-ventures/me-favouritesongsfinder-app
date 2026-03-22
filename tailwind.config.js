/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   '#090909',
          secondary: '#121212',
          elevated:  '#181818',
          surface:   '#212121',
          hover:     '#282828',
          card:      '#1a1a1a',
        },
        accent: {
          DEFAULT: '#7c6af7',
          light:   '#9b8bf9',
          dim:     '#3d3580',
        },
        text: {
          primary:   '#ffffff',
          secondary: '#b3b3b3',
          muted:     '#6a6a6a',
        },
        border: {
          DEFAULT: '#282828',
          light:   '#3a3a3a',
        },
        status: {
          success: '#1ed760',
          warning: '#f59b23',
          error:   '#e5534b',
          info:    '#3d9be9',
        },
        mock: {
          bg:     '#3d2c00',
          border: '#f59b23',
          text:   '#f59b23',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      spacing: {
        sidebar:   '260px',
        playerbar: '80px',
      },
      fontSize: {
        '2xs': ['10px', '14px'],
      },
      animation: {
        'fade-in':  'fadeIn 180ms ease forwards',
        'slide-up': 'slideUp 200ms cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in': 'scaleIn 180ms cubic-bezier(0.16,1,0.3,1) forwards',
        'spin-slow': 'spin 2s linear infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #7c6af7, #9b8bf9)',
        'dark-gradient':   'linear-gradient(180deg, #1a1a1a 0%, #090909 100%)',
      },
      boxShadow: {
        'accent':  '0 0 24px rgba(124,106,247,0.20)',
        'card':    '0 4px 24px rgba(0,0,0,0.40)',
        'modal':   '0 24px 64px rgba(0,0,0,0.60)',
        'player':  '0 -1px 0 #282828',
      },
    },
  },
  plugins: [],
}
