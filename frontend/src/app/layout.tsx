import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RankBattle UPSC',
  description: 'Compete. Rank. Succeed.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
