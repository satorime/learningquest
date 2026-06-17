"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { ArrowLeft, BookOpen } from "lucide-react"
import { SignInForm } from "@/components/auth/sign-in-form"
import { useState, useEffect } from "react"

export default function SignInPage() {
  const [isMounted, setIsMounted] = useState(false);

  // Only run on client-side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  }

  // Generate particles data consistently (same on server and client)
  const particles = Array.from({ length: 6 }).map((_, i) => ({
    id: i,
    width: 4 + (i % 3) * 2,
    height: 4 + (i % 3) * 2,
    left: `${(i + 1) * 15}%`,
    top: `${(i + 2) * 10}%`,
    duration: 2 + i % 2
  }));

  return (
    <div className="relative flex flex-col h-full">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/10 via-primary/5 to-purple-500/10 z-0" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      
      {/* Floating particles - only rendered client-side */}
      {isMounted && particles.map((particle) => (
        <motion.div 
          key={particle.id}
          className="absolute rounded-full bg-primary/20"
          style={{
            width: `${particle.width}px`,
            height: `${particle.height}px`,
            left: particle.left,
            top: particle.top,
          }}
          animate={{
            y: [0, -10, 0],
            opacity: [0.3, 0.8, 0.3]
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      ))}

      {/* Back button with improved visibility */}
      <Link href="/" className="absolute left-4 top-4 md:left-8 md:top-8 z-20">
        <Button 
          variant="outline" 
          size="sm" 
          className="flex items-center gap-1.5 group bg-background/80 backdrop-blur-sm hover:bg-background/90 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Home</span>
        </Button>
      </Link>

      <motion.div 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="flex flex-1 flex-col items-center justify-center px-4 z-10"
      >
        <div className="w-full max-w-md">
          <motion.div 
            variants={itemVariants} 
            className="flex flex-col mb-4 text-center"
          >
            <div className="flex items-center justify-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              <h1 className="text-3xl font-bold tracking-tight">LearningQuest</h1>
            </div>
            <h2 className="text-xl font-semibold mt-1">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to continue your learning journey
            </p>
          </motion.div>

          <motion.div variants={itemVariants}>
            <div className="bg-background/80 backdrop-blur-sm p-5 rounded-xl border shadow-sm">
              <SignInForm />
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-4 text-center text-sm text-muted-foreground"
          >
            <p>
              Don&apos;t have an account?{" "}
              <Link href="/register" className="underline underline-offset-4 hover:text-primary">
                Create one
              </Link>
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
