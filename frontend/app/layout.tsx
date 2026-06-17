import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { RootLayoutClient } from "./root-layout-client"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "LearningQuest - Gamified Learning Platform",
  description: "Enhance your Moodle experience with gamification elements",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>LearningQuest</title>
        <meta name="description" content="Gamified learning platform for Moodle" />
      </head>
      <body className={`${inter.className} transition-colors duration-300`} suppressHydrationWarning>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  )
}
