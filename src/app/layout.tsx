import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { CommandPalette } from '@/components/common/CommandPalette'

export const metadata: Metadata = {
  title: 'Notebook — A Digital Desk for Thinking and Studying',
  description: 'Clean, intelligent digital workspace for notes, knowledge structuring, and real-time collaboration.',
  keywords: 'notebook, collaboration, notes, workspace, tiptap, yjs, study, thoughts',
  openGraph: {
    title: 'Notebook',
    description: 'Clean digital desk for thinking and studying',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;650;700;800&family=JetBrains+Mono:wght@400;500&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          {children}
          <CommandPalette />
          <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 2600,
              style: {
                background: 'var(--background)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13px',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-menu)',
                padding: '8px 14px',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
