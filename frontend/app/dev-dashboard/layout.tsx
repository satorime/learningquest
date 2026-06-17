export default function DevDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-primary py-4">
        <div className="container mx-auto flex justify-center">
          <div className="text-primary-foreground text-xl font-bold">
            LearningQuest Development Mode
          </div>
        </div>
      </header>
      <main className="flex-grow">
        {children}
      </main>
    </div>
  )
} 