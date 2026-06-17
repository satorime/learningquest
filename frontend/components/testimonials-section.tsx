export function TestimonialsSection() {
  return (
    <section id="testimonials" className="w-full py-12 md:py-24 lg:py-32">
      <div className="container px-4 md:px-6">
        <div className="flex flex-col items-center justify-center space-y-4 text-center">
          <div className="space-y-2">
            <div className="inline-block rounded-lg bg-purple-100 px-3 py-1 text-sm dark:bg-purple-800">
              Testimonials
            </div>
            <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">What Our Users Say</h2>
            <p className="max-w-[900px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed dark:text-gray-400">
              Hear from students and educators who have transformed their learning experience with LearningQuest.
            </p>
          </div>
        </div>
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-12">
          <div className="flex flex-col justify-between rounded-lg border p-6 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">Sarah Johnson</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Student</div>
              </div>
              <div className="mt-4 text-gray-500 dark:text-gray-400">
                "LearningQuest completely changed how I approach my online courses. The quest system makes me excited to
                complete assignments, and I love seeing my progress visually!"
              </div>
            </div>
            <div className="flex items-center gap-0.5 mt-4">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-yellow-500"
                >
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-lg border p-6 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">Michael Rodriguez</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">Teacher</div>
              </div>
              <div className="mt-4 text-gray-500 dark:text-gray-400">
                "As an educator, I've seen a dramatic increase in student engagement since implementing LearningQuest. The
                analytics help me identify struggling students early and provide targeted support."
              </div>
            </div>
            <div className="flex items-center gap-0.5 mt-4">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-yellow-500"
                >
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between rounded-lg border p-6 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-semibold">Emily Chen</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">School Administrator</div>
              </div>
              <div className="mt-4 text-gray-500 dark:text-gray-400">
                "LearningQuest has revolutionized our online learning program. Students are more motivated, completion
                rates have improved, and our teachers have better insights into student performance."
              </div>
            </div>
            <div className="flex items-center gap-0.5 mt-4">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-yellow-500"
                >
                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                </svg>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
