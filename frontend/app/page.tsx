"use client"

import { motion, useAnimation, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState, useRef } from "react"
import { 
  Trophy, 
  Play, 
  ChevronRight, 
  BookOpen, 
  Star, 
  Medal,
  Flag,
  Sparkles,
  LogIn
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

// Pet animation states and variants
const pets = [
  {
    name: "Quizzy",
    type: "dragon",
    color: "bg-orange-500",
    emoji: "🐉",
    phrases: ["Ready to learn?", "Let's ace some quests!", "Knowledge is treasure!"]
  },
  {
    name: "Byte",
    type: "robot",
    color: "bg-blue-500",
    emoji: "🤖",
    phrases: ["Calculating best lesson...", "Knowledge database growing!", "Learning circuits activated!"]
  },
  {
    name: "Wizzy",
    type: "wizard",
    color: "bg-purple-500",
    emoji: "🧙",
    phrases: ["Magic of learning!", "Spellbinding knowledge!", "Wisdom awaits!"]
  }
]

function BottomSignIn() {
  const { user, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-6 z-50 pointer-events-none">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="pointer-events-auto relative"
      >
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: -10 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-16 bg-background/95 backdrop-blur-sm p-4 rounded-lg border shadow-lg"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <span>Moodle Sign In</span>
              </h2>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </Button>
            </div>
            <div className="w-72 space-y-2">
              <Button asChild className="w-full">
                <Link href="/signin">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/register">Create an account</Link>
              </Button>
            </div>
          </motion.div>
        )}

        <div className={cn(
          "flex items-center gap-2 bg-background/95 backdrop-blur-lg rounded-full p-2 shadow-xl border",
          "transition-all duration-300 ease-in-out",
          isExpanded ? "pr-6" : "hover:pr-6"
        )}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-accent rounded-full transition"
            aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
          >
            <LogIn className="h-5 w-5" />
          </button>

          <Button
            onClick={() => setIsOpen(!isOpen)}
            variant="ghost"
            className={cn(
              "relative px-3 py-2 rounded-full transition-all duration-300",
              "hover:bg-accent group flex items-center gap-2",
              isOpen && "bg-accent"
            )}
          >
            <BookOpen className="h-5 w-5 text-primary" />
            
            {isExpanded && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="text-sm font-medium text-foreground"
              >
                Sign In
              </motion.span>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}

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
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
}

const slideInRight = {
  hidden: { opacity: 0, x: 100 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.7, ease: "easeOut" }
  }
}

const pulseAnimation = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.03, 1],
    transition: { 
      duration: 3, 
      repeat: Infinity, 
      repeatType: "reverse" 
    }
  }
}

export default function LandingPage() {
  const { user, isLoading } = useAuth()
  const [activePet, setActivePet] = useState(0)
  const [showPetMessage, setShowPetMessage] = useState(false)
  const [petMessage, setPetMessage] = useState("")
  const controls = useAnimation()
  const [mounted, setMounted] = useState(false)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [isDev, setIsDev] = useState(false)
  
  // Generate fixed trophy confetti data once on client
  const [confettiItems, setConfettiItems] = useState<Array<{
    left: string;
    top: string;
    color: string;
    emoji: string;
    duration: number;
    delay: number;
    yMovement: number;
    rotation: number;
  }>>([])

  useEffect(() => {
    setMounted(true)
    // Set development mode
    setIsDev(process.env.NODE_ENV === 'development')
    // Set initial dimensions
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight
    })
    
    // Add window resize handler
    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Pet message animation logic - Only run after mounting
  useEffect(() => {
    if (!mounted) return
    
    const messageInterval = setInterval(() => {
      if (pets[activePet]?.phrases) {
        const randomPhraseIndex = Math.floor(Math.random() * pets[activePet].phrases.length)
        setPetMessage(pets[activePet].phrases[randomPhraseIndex])
        setShowPetMessage(true)
        
        // Hide message after 3 seconds
        setTimeout(() => {
          setShowPetMessage(false)
        }, 3000)
      }
    }, 5000)
    
    return () => clearInterval(messageInterval)
  }, [activePet, mounted])
  
  // Pet hopping animation
  useEffect(() => {
    if (!mounted) return
    
    let isActive = true
    
    const sequence = async () => {
      while (isActive) {
        await controls.start({
          y: [0, -15, 0],
          transition: { duration: 0.6, ease: "easeInOut" }
        })
        await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
      }
    }
    
    sequence()
    
    return () => {
      isActive = false
    }
  }, [controls, mounted])

  // Change active pet periodically
  useEffect(() => {
    if (!mounted) return
    
    const petInterval = setInterval(() => {
      setActivePet((prev) => (prev + 1) % pets.length)
    }, 15000)
    
    return () => clearInterval(petInterval)
  }, [mounted])

  // Animation variants
  const slideInRight = {
    hidden: { x: 100, opacity: 0 },
    visible: { 
      x: 0, 
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 50,
        damping: 15
      }
    }
  }

  const pulseAnimation = {
    initial: { scale: 1 },
    animate: { 
      scale: [1, 1.05, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  }
  
  const floatAnimation = {
    initial: { y: 0 },
    animate: {
      y: [0, -10, 0],
      transition: {
        duration: 3,
        repeat: Infinity,
        repeatType: "reverse" as const
      }
    }
  }

  useEffect(() => {
    setMounted(true)
    
    // Generate the random confetti data once on the client side
    const items = [...Array(10)].map(() => ({
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      color: ['text-yellow-500', 'text-primary', 'text-blue-500'][Math.floor(Math.random() * 3)],
      emoji: ['✨', '🏆', '🌟'][Math.floor(Math.random() * 3)],
      duration: Math.random() * 3 + 2,
      delay: Math.random() * 5,
      yMovement: Math.random() * 20,
      rotation: Math.random() * 360
    }))
    
    setConfettiItems(items)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/95 overflow-hidden relative">
      {/* Development Mode Notice */}
      {/* {isDev && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground px-4 py-2 flex items-center justify-center gap-4 shadow-lg">
          <div className="text-sm font-medium">
            🔧 Development Mode: Authentication is bypassed with an auto-login teacher account
          </div>
          <Link href="/dev-dashboard" passHref>
            <Button size="sm" variant="secondary" className="text-sm">
              Dev Dashboard
              <ChevronRight className="h-4 w-4 ml-1"/>
            </Button>
          </Link>
          <Link href="/dashboard/teacher" passHref>
            <Button size="sm" variant="secondary" className="text-sm">
              Teacher Dashboard
              <ChevronRight className="h-4 w-4 ml-1"/>
            </Button>
          </Link>
          <Link href="/dashboard/quests" passHref>
            <Button size="sm" variant="secondary" className="text-sm">
              Quests
              <ChevronRight className="h-4 w-4 ml-1"/>
            </Button>
          </Link>
        </div>
      )} */}
      
      {/* Bottom Sign-in button */}
      <BottomSignIn />
      
      {/* Animated particles - Only render client-side */}
      {mounted && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * dimensions.width, 
                y: Math.random() * dimensions.height,
                scale: Math.random() * 0.5 + 0.5,
                opacity: Math.random() * 0.3 + 0.1
              }}
              animate={{
                y: [null, Math.random() * -100 - 50],
                opacity: [null, 0]
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 10
              }}
              className={`absolute w-2 h-2 rounded-full ${
                ["bg-primary/20", "bg-blue-500/20", "bg-orange-500/20", "bg-purple-500/20"][Math.floor(Math.random() * 4)]
              }`}
            />
          ))}
        </div>
      )}

      <div className="container max-w-7xl mx-auto px-4 py-4 md:py-8">
        {/* Virtual Pet - Only render client-side */}
        {mounted && (
          <div className="fixed bottom-16 md:bottom-20 right-3 md:right-5 z-50">
            <AnimatePresence mode="wait">
              <motion.div
                key={activePet}
                initial={{ scale: 0, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0, y: 50, opacity: 0 }}
                transition={{ type: "spring", damping: 12 }}
                className="relative"
              >
                <motion.div 
                  animate={controls}
                  className={`${pets[activePet].color} w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center shadow-lg cursor-pointer`}
                  whileHover={{ scale: 1.1 }}
                  onClick={() => {
                    setPetMessage(pets[activePet].phrases[Math.floor(Math.random() * pets[activePet].phrases.length)])
                    setShowPetMessage(true)
                    setTimeout(() => setShowPetMessage(false), 3000)
                  }}
                >
                  <span className="text-2xl md:text-3xl">{pets[activePet].emoji}</span>
                </motion.div>
                
                <AnimatePresence>
                  {showPetMessage && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0, x: -50 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0, x: -50 }}
                      className="absolute right-full bottom-0 mb-2 mr-3 bg-white dark:bg-gray-800 rounded-xl px-3 py-2 shadow-lg max-w-[10rem] md:max-w-[12rem] hidden md:block"
                    >
                      <div className="text-sm font-medium">{petMessage}</div>
                      <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 rotate-45 w-2 h-2 bg-white dark:bg-gray-800"></div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                <div className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1, 0] }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      repeatDelay: 1,
                      ease: "easeInOut"
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                  </motion.div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {/* Hero Section */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center py-6 md:py-12"
        >
          <motion.div variants={itemVariants} className="space-y-4 md:space-y-6 text-center md:text-left">
            <motion.div 
              initial={{ opacity: 0, x: -20 }} 
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium"
            >
              <Star className="h-4 w-4" /> Daily Quests Available
            </motion.div>
            
            <motion.h1 variants={itemVariants} className="text-3xl md:text-4xl lg:text-6xl font-bold tracking-tight">
              Daily Quest, <br />
              Daily Bonus<motion.span 
                initial={{ opacity: 1 }}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-primary"
              >-</motion.span> Play Today!
            </motion.h1>
            
            <motion.p variants={itemVariants} className="text-base md:text-lg text-muted-foreground">
              LearningQuest is the gamified learning platform that brings excitement to education. 
              Complete quests, earn experience, and level up your knowledge every day.
            </motion.p>
            
            <motion.div variants={itemVariants} className="flex flex-wrap gap-3 md:gap-4 justify-center md:justify-start">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" asChild className="rounded-full bg-primary hover:bg-primary/90 gap-2 text-sm md:text-base px-4 md:px-6">
                  <Link href="/signin">
                    <Play className="h-4 w-4 md:h-5 md:w-5" /> Start Learning Now
                  </Link>
                </Button>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button size="lg" variant="outline" asChild className="rounded-full gap-2 text-sm md:text-base px-4 md:px-6">
                  <Link href="/learn-more">
                    <BookOpen className="h-4 w-4 md:h-5 md:w-5" /> Learn More
                  </Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>
          
          <motion.div 
            variants={slideInRight}
            className="relative mt-8 md:mt-0"
          >
            <motion.div 
              animate={pulseAnimation.animate}
              initial={pulseAnimation.initial}
              className="relative z-10"
            >
              {/* Animated trophy flag */}
              <div className="w-[280px] h-[280px] md:w-[400px] md:h-[400px] mx-auto relative">
                {/* Flag Pole */}
                <div className="absolute left-[50%] top-[100px] w-[10px] h-[220px] md:h-[300px] bg-gray-500 transform -translate-x-1/2"></div>
                
                {/* Flag Base */}
                <div className="absolute left-[50%] top-[290px] md:top-[370px] w-[40px] h-[40px] rounded-full bg-gray-500 opacity-70 transform -translate-x-1/2"></div>
                
                {/* Flag - Animated */}
                <motion.div 
                  className="absolute left-[50%] top-[100px] w-[120px] md:w-[150px] h-[80px] md:h-[100px] origin-left transform -translate-x-[8px]"
                  animate={{
                    skew: [0, 2, 0, -2, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-yellow-400 to-orange-500 rounded-r-md"></div>
                  
                  {/* Flag Highlights */}
                  <div className="absolute left-[15%] top-[10%] w-[60%] h-[70%] bg-gradient-to-r from-yellow-200 to-transparent opacity-70 rounded-lg"></div>
                  
                  {/* Flag Small Details */}
                  <div className="absolute right-[15%] top-[20%] w-[12px] h-[12px] md:w-[16px] md:h-[16px] bg-white rounded-full opacity-60"></div>
                  <div className="absolute left-[25%] top-[50%] w-[8px] h-[8px] md:w-[10px] md:h-[10px] bg-white rounded-full opacity-60"></div>
                  <div className="absolute left-[60%] top-[70%] w-[10px] h-[10px] md:w-[12px] md:h-[12px] bg-white rounded-full opacity-60"></div>
                </motion.div>
                
                {/* Star on flag */}
                <motion.div 
                  className="absolute left-[75%] top-[75px] z-20"
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 5, 0, -5, 0]
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <div className="w-[20px] h-[20px] md:w-[30px] md:h-[30px] bg-yellow-300 rotate-45"></div>
                  <div className="absolute top-0 left-0 w-[20px] h-[20px] md:w-[30px] md:h-[30px] bg-yellow-300 rotate-[22.5deg]"></div>
                  <div className="absolute top-0 left-0 w-[20px] h-[20px] md:w-[30px] md:h-[30px] bg-yellow-300 rotate-[67.5deg]"></div>
                </motion.div>
                
                {/* Flag Glow */}
                <div className="absolute left-[50%] top-[100px] w-[120px] md:w-[150px] h-[80px] md:h-[100px] bg-yellow-400 opacity-20 blur-md transform -translate-x-[8px]"></div>
              </div>
            </motion.div>
            
            {/* Game level indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute top-1/3 right-0 flex flex-col gap-3"
            >
              {[1, 2, 3].map((level, i) => (
                <motion.div
                  key={i}
                  className={`w-10 h-10 rounded-full ${level <= 2 ? 'bg-primary' : 'bg-gray-200'} flex items-center justify-center text-white font-bold shadow-md border-2 ${level <= 2 ? 'border-white' : 'border-gray-300'}`}
                  initial={{ x: 50 }}
                  animate={{ x: 0 }}
                  transition={{ delay: 1.2 + i * 0.2 }}
                >
                  {level}
                </motion.div>
              ))}
              <motion.div 
                className="h-20 w-1 bg-gradient-to-b from-primary to-transparent mx-auto -mt-1"
                initial={{ height: 0 }}
                animate={{ height: 20 }}
                transition={{ delay: 1.8 }}
              />
            </motion.div>
            
            <div className="absolute top-0 left-0 right-0 bottom-0 bg-primary/5 rounded-full blur-3xl -z-10"></div>
            
            {/* Floating achievements */}
            <motion.div
              animate={floatAnimation.animate}
              initial={floatAnimation.initial}
              className="absolute -bottom-10 -right-10 bg-purple-500/10 backdrop-blur-sm rounded-full p-3 shadow-lg border border-purple-500/20"
            >
              <Star className="h-8 w-8 text-purple-500" />
            </motion.div>
            
            <motion.div
              animate={{
                y: [0, -15, 0],
                transition: {
                  duration: 4,
                  repeat: Infinity,
                  repeatType: "reverse"
                }
              }}
              className="absolute -top-5 -left-5 bg-amber-500/10 backdrop-blur-sm rounded-full p-3 shadow-lg border border-amber-500/20"
            >
              <Medal className="h-6 w-6 text-amber-500" />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Daily Play Options */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-8 md:mt-12 bg-background/80 backdrop-blur-md rounded-2xl md:rounded-3xl border shadow-lg p-4 md:p-8"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-2 md:gap-0">
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-center gap-3"
            >
              <div className="bg-primary rounded-full p-2">
                <Flag className="h-5 w-5 md:h-6 md:w-6 text-primary-foreground" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold">Daily Trivia</h2>
            </motion.div>
            <motion.div
              whileHover={{ x: 5 }}
              className="text-primary flex items-center gap-1 text-sm font-medium"
            >
              Start Now <ChevronRight className="h-4 w-4" />
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            <motion.div 
              whileHover={{ scale: 1.02, y: -5 }}
              className="bg-primary/10 rounded-xl md:rounded-2xl p-4 md:p-6 md:col-span-1 flex flex-col justify-between h-32 md:h-40 relative overflow-hidden"
            >
              <div className="absolute -right-4 -bottom-4 opacity-20 text-4xl md:text-6xl">🎮</div>
              <h3 className="text-lg md:text-xl font-bold">Choose the option</h3>
              <p className="text-xs md:text-sm text-muted-foreground">Go to study in the area of your choice</p>
            </motion.div>

            <Link href="/student/quests" className="md:col-span-2">
              <motion.div 
                whileHover={{ scale: 1.02, y: -5 }}
                className="bg-gradient-to-r from-primary to-primary/80 rounded-xl md:rounded-2xl p-4 md:p-6 text-primary-foreground flex items-center justify-between h-32 md:h-40 relative overflow-hidden"
              >
                {/* Animated particles inside card */}
                {mounted && (
                  <div className="absolute inset-0">
                    {[...Array(5)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-white/20 rounded-full"
                        initial={{
                          x: Math.random() * 100 + 50,
                          y: Math.random() * 100 + 50,
                        }}
                        animate={{
                          y: [null, Math.random() * -50 - 20],
                          opacity: [0.7, 0]
                        }}
                        transition={{
                          duration: Math.random() * 2 + 1,
                          repeat: Infinity,
                          repeatType: "loop"
                        }}
                      />
                    ))}
                  </div>
                )}
                
                <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  <div className="bg-primary-foreground/20 rounded-full p-2 md:p-3 relative w-fit">
                    <Trophy className="h-6 w-6 md:h-8 md:w-8 text-primary-foreground" />
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary-foreground/30"
                      animate={{
                        scale: [1, 1.2, 1],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-bold">Daily Play & Win</h3>
                    <p className="text-sm text-primary-foreground/80">Complete daily quests to earn bonus XP</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 md:h-6 md:w-6 ml-2" />
              </motion.div>
            </Link>
          </div>
          
          <Link href="/dashboard">
            <motion.div 
              whileHover={{ scale: 1.02, y: -5 }}
              className="mt-4 md:mt-6 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl md:rounded-2xl p-4 md:p-6 text-white flex items-center justify-between relative overflow-hidden"
            >
              {/* Virtual pet peeking from corner */}
              <motion.div 
                className="absolute -bottom-10 right-10 md:right-20"
                initial={{ y: 30 }}
                animate={{ y: [30, 10, 30] }}
                transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
              >
                <div className="text-3xl md:text-4xl transform -scale-x-100">🧙</div>
              </motion.div>
              
              <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                <div className="bg-white/20 rounded-full p-2 md:p-3 w-fit">
                  <Star className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold">Play Like a Master</h3>
                  <p className="text-sm text-white/80">Access advanced quests and special rewards</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 md:h-6 md:w-6 ml-2" />
            </motion.div>
          </Link>
        </motion.div>

        {/* Leaderboard Preview */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="mt-10 md:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8"
        >
          <div>
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <Trophy className="h-5 w-5 md:h-6 md:w-6 text-orange-500" />
              <h2 className="text-2xl md:text-3xl font-bold">LearningQuest Winners</h2>
            </div>

            <div className="bg-background/80 backdrop-blur-md rounded-xl md:rounded-3xl border shadow-lg p-4 md:p-6 space-y-4 relative overflow-hidden">
              {/* Trophy confetti animation */}
              <div className="absolute inset-0">
                {mounted && confettiItems.map((item, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    style={{
                      left: item.left,
                      top: item.top,
                    }}
                    animate={{
                      opacity: [0, 1, 0],
                      y: [0, item.yMovement],
                      rotate: [0, item.rotation]
                    }}
                    transition={{
                      duration: item.duration,
                      repeat: Infinity,
                      delay: item.delay
                    }}
                  >
                    <div className={`text-xs ${item.color}`}>
                      {item.emoji}
                    </div>
                  </motion.div>
                ))}
              </div>
              
              <div className="flex justify-around">
                {/* Second Place */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.0 }}
                  className="flex flex-col items-center"
                >
                  <motion.div 
                    whileHover={{ y: -5 }}
                    className="bg-blue-100 rounded-full w-12 h-12 md:w-16 md:h-16 mb-2 flex items-center justify-center relative cursor-pointer"
                  >
                    <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-blue-500 rounded-full w-4 h-4 md:w-6 md:h-6 flex items-center justify-center text-white font-bold text-[10px] md:text-xs">2</div>
                    <div className="bg-blue-500/20 rounded-full w-8 h-8 md:w-12 md:h-12 flex items-center justify-center">
                      <span className="text-blue-500 font-bold text-lg md:text-xl">M</span>
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-blue-500/30"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                  <div className="text-center">
                    <div className="font-medium text-xs md:text-sm">Mahmud S.</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">Second place</div>
                  </div>
                </motion.div>

                {/* First Place */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  className="flex flex-col items-center -mt-4"
                >
                  <div className="relative">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    >
                      <svg className="w-8 h-8 md:w-10 md:h-10 text-amber-500 absolute -top-4 md:-top-5 left-1/2 transform -translate-x-1/2" viewBox="0 0 36 36" fill="currentColor">
                        {[...Array(12)].map((_, i) => (
                          <path
                            key={i}
                            d="M18 0l3 10 9 1-7 6 2 9-7-4-7 4 2-9-7-6 9-1z"
                            transform={`rotate(${i * 30} 18 18) scale(0.4)`}
                            opacity={0.5}
                          />
                        ))}
                        <circle cx="18" cy="18" r="3" fill="white" />
                      </svg>
                    </motion.div>
                  </div>
                  <motion.div 
                    whileHover={{ y: -5 }}
                    className="bg-teal-100 rounded-full w-16 h-16 md:w-20 md:h-20 mb-2 flex items-center justify-center relative cursor-pointer"
                  >
                    <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-teal-500 rounded-full w-4 h-4 md:w-6 md:h-6 flex items-center justify-center text-white font-bold text-[10px] md:text-xs">1</div>
                    <div className="bg-teal-500/20 rounded-full w-12 h-12 md:w-16 md:h-16 flex items-center justify-center">
                      <span className="text-teal-500 font-bold text-xl md:text-2xl">J</span>
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-teal-500/30"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                  <div className="text-center">
                    <div className="font-medium text-xs md:text-sm">Jonathan D.</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">First place</div>
                  </div>
                </motion.div>

                {/* Third Place */}
                <motion.div 
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.1 }}
                  className="flex flex-col items-center"
                >
                  <motion.div 
                    whileHover={{ y: -5 }}
                    className="bg-rose-100 rounded-full w-12 h-12 md:w-16 md:h-16 mb-2 flex items-center justify-center relative cursor-pointer"
                  >
                    <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-rose-500 rounded-full w-4 h-4 md:w-6 md:h-6 flex items-center justify-center text-white font-bold text-[10px] md:text-xs">3</div>
                    <div className="bg-rose-500/20 rounded-full w-8 h-8 md:w-12 md:h-12 flex items-center justify-center">
                      <span className="text-rose-500 font-bold text-lg md:text-xl">P</span>
                    </div>
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-rose-500/30"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                  <div className="text-center">
                    <div className="font-medium text-xs md:text-sm">Priya K.</div>
                    <div className="text-[10px] md:text-xs text-muted-foreground">Third place</div>
                  </div>
                </motion.div>
              </div>

              <div className="mt-6 md:mt-8 flex justify-center">
                <Button variant="outline" className="rounded-full text-xs md:text-sm">View Full Leaderboard</Button>
              </div>
            </div>
          </div>

          <div className="mt-6 lg:mt-0">
            <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
              <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold">How It Works</h2>
            </div>

            <div className="bg-background/80 backdrop-blur-md rounded-xl md:rounded-3xl border shadow-lg p-4 md:p-6">
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  className="bg-background rounded-lg md:rounded-xl p-3 md:p-4 border flex flex-col items-center relative overflow-hidden"
                >
                  <motion.div
                    className="absolute -bottom-10 -right-10 text-4xl md:text-5xl opacity-5"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                  >
                    🎮
                  </motion.div>
                  <div className="rounded-full bg-violet-100 p-1 md:p-2 mb-2 md:mb-4">
                    <Play className="h-4 w-4 md:h-5 md:w-5 text-violet-500" />
                  </div>
                  <h3 className="font-medium text-center text-sm md:text-base mb-0.5 md:mb-1">Play the quests</h3>
                  <p className="text-[10px] md:text-xs text-center text-muted-foreground">Complete daily challenges and learn as you play</p>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  className="bg-background rounded-xl p-4 border flex flex-col items-center relative overflow-hidden"
                >
                  <motion.div
                    className="absolute -bottom-10 -right-10 text-5xl opacity-5"
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                  >
                    🏆
                  </motion.div>
                  <div className="rounded-full bg-amber-100 p-2 mb-4">
                    <Trophy className="h-5 w-5 text-amber-500" />
                  </div>
                  <h3 className="font-medium text-center mb-1">Earn points</h3>
                  <p className="text-xs text-center text-muted-foreground">Collect XP and level up your character</p>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  className="bg-background rounded-xl p-4 border flex flex-col items-center relative overflow-hidden"
                >
                  <motion.div
                    className="absolute -bottom-10 -right-10 text-5xl opacity-5"
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                  >
                    🏅
                  </motion.div>
                  <div className="rounded-full bg-emerald-100 p-2 mb-4">
                    <Medal className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h3 className="font-medium text-center mb-1">Unlock badges</h3>
                  <p className="text-xs text-center text-muted-foreground">Show off your achievements and skills</p>
                </motion.div>

                <motion.div 
                  whileHover={{ scale: 1.03 }}
                  className="bg-background rounded-xl p-4 border flex flex-col items-center relative overflow-hidden"
                >
                  <motion.div
                    className="absolute -bottom-10 -right-10 text-5xl opacity-5"
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 5, repeat: Infinity }}
                  >
                    ⭐
                  </motion.div>
                  <div className="rounded-full bg-blue-100 p-2 mb-4">
                    <Star className="h-5 w-5 text-blue-500" />
                  </div>
                  <h3 className="font-medium text-center mb-1">Compete</h3>
                  <p className="text-xs text-center text-muted-foreground">Challenge friends and climb the rankings</p>
                </motion.div>
              </div>

              <motion.div
                className="mt-6 bg-gradient-to-r from-primary/20 to-primary/5 rounded-lg md:rounded-xl p-3 md:p-4 text-center relative overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0 flex items-center justify-around"
                  animate={{ x: [-20, 0, -20] }}
                  transition={{ duration: 10, repeat: Infinity }}
                >
                  {['🐉', '🧙‍♂️', '🤖', '🦊'].map((emoji, i) => (
                    <motion.div
                      key={i}
                      className="text-xl opacity-10"
                      animate={{ y: [0, -10, 0] }}
                      transition={{ 
                        duration: 3, 
                        repeat: Infinity, 
                        delay: i * 0.5 
                      }}
                    >
                      {emoji}
                    </motion.div>
                  ))}
                </motion.div>
                <p className="text-sm font-medium relative z-10">Join over 10,000 students learning through play!</p>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="mt-10 md:mt-16 mb-6 md:mb-8 text-center py-8 md:py-12"
        >
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-3 md:mb-4">Play, Learn and Earn bonus</h2>
          <p className="text-base md:text-lg text-muted-foreground mb-6 md:mb-8 max-w-2xl mx-auto px-4">Challenge yourself, earn rewards, and become the master of knowledge while having fun!</p>
          
          <motion.div 
            whileHover={{ scale: 1.05 }} 
            whileTap={{ scale: 0.95 }}
            className="w-full md:w-auto"
          >
            <Button 
              size="lg" 
              className="w-full md:w-auto rounded-full bg-gradient-to-r from-primary to-blue-500 hover:from-primary/90 hover:to-blue-500/90 gap-2 text-sm md:text-base" 
              asChild
            >
              <Link href="/signin">
                <Trophy className="h-4 w-4 md:h-5 md:w-5" />
                Get Started Now
              </Link>
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="mt-8 flex justify-center gap-4"
          >
            {['🐉', '🤖', '🧙'].map((emoji, i) => (
              <motion.div
                key={i}
                className="flex flex-col items-center"
                whileHover={{ y: -3 }}
              >
                <div className={`w-10 h-10 rounded-full ${['bg-orange-500', 'bg-blue-500', 'bg-purple-500'][i]} flex items-center justify-center shadow-md cursor-pointer`}>
                  <span>{emoji}</span>
                </div>
                <span className="text-xs mt-1 text-muted-foreground">{pets[i].name}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
