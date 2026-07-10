import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Identidade visual institucional
        institutional: {
          blue: '#1a3a6b',
          'blue-medium': '#2563eb',
          'blue-light': '#dbeafe',
          gray: '#f1f5f9',
          'gray-border': '#e2e8f0',
        },
        economy: {
          green: '#16a34a',
          'green-light': '#dcfce7',
        },
        alert: {
          red: '#dc2626',
          'red-light': '#fee2e2',
          yellow: '#d97706',
          'yellow-light': '#fef3c7',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}

export default config
