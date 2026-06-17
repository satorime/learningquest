import { Award, BarChart3, Compass, Lightbulb, Trophy, Users } from "lucide-react"

export function FeaturesSection() {
  return (
    <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-gray-50 dark:bg-gray-900">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-purple-100 px-3 py-1 text-sm dark:bg-purple-800">Features</div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">Gamified Learning Experience</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              LearningQuest transforms traditional learning with interactive elements that boost engagement and
              motivation.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-800">
              <Trophy className="h-6 w-6 text-purple-600 dark:text-purple-200" />
            </div>
            <h3 className="text-xl font-bold">Quest System</h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Complete learning missions and earn rewards for your academic achievements.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-800">
              <Award className="h-6 w-6 text-purple-600 dark:text-purple-200" />
            </div>
            <h3 className="text-xl font-bold">Achievement Badges</h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Unlock badges that showcase your progress and mastery of different subjects.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-800">
              <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-200" />
            </div>
            <h3 className="text-xl font-bold">Progress Tracking</h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Visualize your learning journey with detailed analytics and progress indicators.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-800">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-200" />
            </div>
            <h3 className="text-xl font-bold">Collaborative Challenges</h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Work together with peers on group quests to solve complex problems.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-800">
              <Lightbulb className="h-6 w-6 text-purple-600 dark:text-purple-200" />
            </div>
            <h3 className="text-xl font-bold">Adaptive Learning</h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Personalized learning paths that adapt to your strengths and areas for improvement.
            </p>
          </div>
          <div className="flex flex-col items-center space-y-2 rounded-lg border p-6 shadow-sm">
            <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-800">
              <Compass className="h-6 w-6 text-purple-600 dark:text-purple-200" />
            </div>
            <h3 className="text-xl font-bold">Real-time Feedback</h3>
            <p className="text-center text-gray-500 dark:text-gray-400">
              Immediate insights on your performance to help you improve continuously.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
