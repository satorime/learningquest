import Link from "next/link"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
      <div className="container px-4 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
          <div className="flex flex-col justify-center space-y-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                Transform Learning into an Adventure
              </h1>
              <p className="max-w-[600px] text-gray-500 md:text-xl dark:text-gray-400">
                LearningQuest turns traditional text-based learning into an immersive, gamified experience that keeps
                students engaged and motivated.
              </p>
            </div>
            <div className="flex flex-col gap-2 min-[400px]:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">Get Started</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/#features">Learn More</Link>
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative w-full h-[300px] md:h-[400px] lg:h-[500px] rounded-lg overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 opacity-90"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white text-center space-y-4 p-6">
                  <div className="text-5xl font-bold">Level Up</div>
                  <div className="text-2xl">Your Learning Experience</div>
                  <div className="flex justify-center gap-4 mt-6">
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center">
                      <div className="text-3xl font-bold">Quests</div>
                      <div className="text-sm">Complete challenges</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center">
                      <div className="text-3xl font-bold">XP</div>
                      <div className="text-sm">Earn experience</div>
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 flex flex-col items-center">
                      <div className="text-3xl font-bold">Badges</div>
                      <div className="text-sm">Unlock achievements</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
