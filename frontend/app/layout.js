import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

export const metadata = {
  title: 'National Public Grievance & Resource Allocation Portal',
  description: 'Official citizen grievance redressal and government resource allocation system.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=Libre+Baskerville:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a className="skip-link" href="#main">Skip to main content</a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
