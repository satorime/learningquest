"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, BookOpen, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

export default function LearnMorePage() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/10 via-primary/5 to-purple-500/10 z-0" />
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      
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

      <div className="container max-w-4xl mx-auto px-4 py-16 z-10">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">LearningQuest</h1>
          </div>
          <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Learn more about how LearningQuest enhances your Moodle learning experience through gamification and personalized learning paths.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full bg-background/80 backdrop-blur-sm rounded-lg border p-6 shadow-sm">
          <AccordionItem value="item-1">
            <AccordionTrigger className="text-lg font-medium">What is LearningQuest?</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground mb-3">
                LearningQuest is a gamified learning platform that enhances your Moodle experience. It transforms traditional learning into an engaging adventure with:
              </p>
              <ul className="space-y-2 ml-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Virtual pets that grow as you progress through your courses</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Quest-based learning paths that make course content more engaging</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Achievement badges and rewards for completing learning milestones</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2">
            <AccordionTrigger className="text-lg font-medium">How does LearningQuest work with my institution's Moodle?</AccordionTrigger>
            <AccordionContent>
              LearningQuest integrates directly with your institution's Moodle system using secure authentication. It accesses your course content, assignments, and progress while adding gamification elements. Your Moodle credentials are securely used for authentication, and all your progress in LearningQuest is synchronized back to your Moodle account.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3">
            <AccordionTrigger className="text-lg font-medium">What are the benefits of using LearningQuest?</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground mb-3">LearningQuest provides numerous benefits for learners:</p>
              <ul className="space-y-2 ml-1">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Increased motivation through gamification elements</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Clearer progress tracking and visualization</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Personalized learning paths based on your progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Fun rewards that make learning more enjoyable</span>
                </li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-4">
            <AccordionTrigger className="text-lg font-medium">How do I get started with LearningQuest?</AccordionTrigger>
            <AccordionContent>
              Getting started is easy! Simply sign in with your existing Moodle credentials. After signing in for the first time, you'll create your profile, choose your virtual pet, and begin your learning journey. All your existing Moodle courses will be available in a new, gamified format.
              <div className="mt-4">
                <Button asChild className="sign-in-button">
                  <Link href="/signin">Sign In Now</Link>
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold mb-4">Ready to transform your learning experience?</h3>
          <Button asChild size="lg" className="sign-in-button">
            <Link href="/signin">Get Started Now</Link>
          </Button>
        </div>
      </div>
    </div>
  )
} 