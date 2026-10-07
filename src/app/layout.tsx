import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { CommandPalette } from '@/components/common/CommandPalette'

export const metadata: Metadata = {
  title: 'CoNote — Collaborative Digital Notebooks',
  description: 'Your notebook. Everyone\'s workspace. Write, organize, and collaborate in real time.',
  keywords: 'notebook, collaboration, notes, workspace, tiptap, yjs',
  openGraph: {
    title: 'CoNote',
    description: 'Collaborative digital notebooks for teams and thinkers',
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
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
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
                fontFamily: 'Inter, sans-serif',
                fontSize: '13.5px',
                borderRadius: '10px',
                boxShadow: 'var(--shadow-lg)',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
