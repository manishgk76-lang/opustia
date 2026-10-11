import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

const webCss = `
  /* High-contrast modern typography & smooth corner CSS reset */
  *, *::before, *::after {
    box-sizing: border-box;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  /* Force smooth, beautiful modern font on ALL elements including React Native Web components */
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
    min-height: 100%;
    margin: 0;
    padding: 0;
    background-color: #ffffff;
    color: #000000;
    overflow-x: hidden;
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
    background-color: #ffffff;
  }

  /* Sleek modern scrollbars */
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

  /* High contrast text selection */
  ::selection {
    background: #000000;
    color: #ffffff;
  }

  input, button, select, textarea {
    font-family: inherit;
  }
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        <title>Opustia — Verified Local Services & Certified Experts</title>
        <meta name="description" content="Book police-verified plumbers, electricians, carpenters and home technicians with instant upfront quotes, arrival OTP security, and 30-day warranty." />
        <meta name="theme-color" content="#000000" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: webCss }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
