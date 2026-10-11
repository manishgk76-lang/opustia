import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';

export default function Layout() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // 1. Preconnect & load Google Fonts
      if (!document.getElementById('opustia-fonts-link')) {
        const preconn1 = document.createElement('link');
        preconn1.rel = 'preconnect';
        preconn1.href = 'https://fonts.googleapis.com';
        document.head.appendChild(preconn1);

        const preconn2 = document.createElement('link');
        preconn2.rel = 'preconnect';
        preconn2.href = 'https://fonts.gstatic.com';
        preconn2.crossOrigin = 'anonymous';
        document.head.appendChild(preconn2);

        const fontLink = document.createElement('link');
        fontLink.id = 'opustia-fonts-link';
        fontLink.rel = 'stylesheet';
        fontLink.href =
          'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap';
        document.head.appendChild(fontLink);
      }

      // 2. Inject clean global CSS styling
      if (!document.getElementById('opustia-global-styles')) {
        const style = document.createElement('style');
        style.id = 'opustia-global-styles';
        style.innerHTML = `
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            text-rendering: optimizeLegibility;
          }

          /* Force smooth, beautiful font on ALL elements including React Native Web rendered elements */
          *, *::before, *::after,
          html, body,
          [dir="auto"],
          [class*="css-text"],
          [class*="r-"],
          div, span, p, h1, h2, h3, h4, h5, h6, input, button, textarea, select {
            font-family: 'Plus Jakarta Sans', 'Outfit', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif !important;
            -webkit-font-smoothing: antialiased !important;
            -moz-osx-font-smoothing: grayscale !important;
            text-rendering: optimizeLegibility !important;
          }

          html, body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            background-color: #ffffff !important;
            color: #000000;
          }

          /* Smooth corner hardware acceleration & antialiasing */
          [style*="border-radius"],
          [class*="r-borderRadius"],
          [class*="r-border"],
          button, input, select {
            -webkit-backface-visibility: hidden;
            -moz-backface-visibility: hidden;
            -webkit-transform: translateZ(0);
            transform: translateZ(0);
          }

          #root {
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            width: 100%;
            background-color: #ffffff !important;
          }
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: #f1f1f1;
          }
          ::-webkit-scrollbar-thumb {
            background: #000000;
            border-radius: 9999px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #333333;
          }
          ::selection {
            background: #000000;
            color: #ffffff;
          }
          input, button, select, textarea {
            font-family: inherit !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);

  return <Stack screenOptions={{ headerShown: false }} />;
}
