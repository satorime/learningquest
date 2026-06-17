"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Line,
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { motion } from "framer-motion";
import AccomplishmentGraph from "./streak-graph";
import { useProgress } from "@/hooks/use-progress";

export function ProgressTracker() {
  const { progressData, loading, error, refetch } = useProgress();

  // Loading and error states
  if (loading) {
    return <div className="p-6">Loading progress data...</div>;
  }
  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }
  if (!progressData) {
    return <div className="p-6">No progress data available.</div>;
  }

  // Use real data from backend
  // Only show last 7 days for weeklyData
  const weeklyDataRaw = progressData.weekly_data || [];
  const weeklyData = weeklyDataRaw.slice(-7);
  const monthlyData = progressData.monthly_data;
  // Map streak_data to the format expected by AccomplishmentGraph
  const accomplishmentData = progressData.streak_data.map((d) => ({
    date: d.date,
    accomplishments: d.intensity,
    dayOfWeek: d.dayOfWeek,
  }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 p-3 sm:p-6 rounded-xl bg-card dark:bg-transparent"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-primary">
          Progress Tracker
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Monitor your learning journey and track your achievements over time.
        </p>
      </div>

      <Tabs defaultValue="weekly">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg sm:text-xl font-bold text-primary">Activity Overview</h3>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="weekly" className="flex-1 sm:flex-none">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1 sm:flex-none">Monthly</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="weekly" className="mt-4">
          <motion.div
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Card className="border-none shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-3 pt-4 sm:p-6 sm:pt-6">
                <div className="h-[240px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        opacity={0.2}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <XAxis
                        dataKey="day"
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        fontWeight={500}
                        tickLine={false}
                        axisLine={{
                          stroke: "hsl(var(--border))",
                          strokeWidth: 1,
                        }}
                      />
                      <YAxis
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        fontWeight={500}
                        tickLine={false}
                        axisLine={{
                          stroke: "hsl(var(--border))",
                          strokeWidth: 1,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          color: "hsl(var(--foreground))",
                          boxShadow:
                            "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                        labelStyle={{
                          color: "hsl(var(--foreground))",
                          fontWeight: "600",
                          fontSize: "14px",
                        }}
                        itemStyle={{
                          color: "hsl(var(--foreground))",
                          fontSize: "13px",
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          color: "hsl(var(--foreground))",
                          fontSize: "13px",
                          fontWeight: "500",
                        }}
                        iconType="circle"
                        iconSize={8}
                      />
                      <Line
                        type="monotone"
                        dataKey="exp_reward"
                        name="XP Earned"
                        stroke="hsl(142, 76%, 36%)"
                        strokeWidth={3}
                        dot={{
                          fill: "hsl(142, 76%, 36%)",
                          strokeWidth: 2,
                          r: 4,
                          stroke: "hsl(var(--background))",
                        }}
                        activeDot={{
                          r: 6,
                          fill: "hsl(142, 76%, 36%)",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="quests_completed"
                        name="Quests Completed"
                        stroke="hsl(221, 83%, 53%)"
                        strokeWidth={3}
                        dot={{
                          fill: "hsl(221, 83%, 53%)",
                          strokeWidth: 2,
                          r: 4,
                          stroke: "hsl(var(--background))",
                        }}
                        activeDot={{
                          r: 6,
                          fill: "hsl(221, 83%, 53%)",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
        <TabsContent value="monthly" className="mt-4">
          <motion.div
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Card className="border-none shadow-md hover:shadow-lg transition-shadow duration-300">
              <CardContent className="p-3 pt-4 sm:p-6 sm:pt-6">
                <div className="h-[240px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        opacity={0.2}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <XAxis
                        dataKey="week"
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        fontWeight={500}
                        tickLine={false}
                        axisLine={{
                          stroke: "hsl(var(--border))",
                          strokeWidth: 1,
                        }}
                      />
                      <YAxis
                        stroke="hsl(var(--foreground))"
                        fontSize={12}
                        fontWeight={500}
                        tickLine={false}
                        axisLine={{
                          stroke: "hsl(var(--border))",
                          strokeWidth: 1,
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "12px",
                          color: "hsl(var(--foreground))",
                          boxShadow:
                            "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                          fontSize: "14px",
                          fontWeight: "500",
                        }}
                        labelStyle={{
                          color: "hsl(var(--foreground))",
                          fontWeight: "600",
                          fontSize: "14px",
                        }}
                        itemStyle={{
                          color: "hsl(var(--foreground))",
                          fontSize: "13px",
                        }}
                      />
                      <Legend
                        wrapperStyle={{
                          color: "hsl(var(--foreground))",
                          fontSize: "13px",
                          fontWeight: "500",
                        }}
                        iconType="circle"
                        iconSize={8}
                      />
                      <Line
                        type="monotone"
                        dataKey="exp_reward"
                        name="XP Earned"
                        stroke="hsl(142, 76%, 36%)"
                        strokeWidth={3}
                        dot={{
                          fill: "hsl(142, 76%, 36%)",
                          strokeWidth: 2,
                          r: 4,
                          stroke: "hsl(var(--background))",
                        }}
                        activeDot={{
                          r: 6,
                          fill: "hsl(142, 76%, 36%)",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="quests_completed"
                        name="Quests Completed"
                        stroke="hsl(221, 83%, 53%)"
                        strokeWidth={3}
                        dot={{
                          fill: "hsl(221, 83%, 53%)",
                          strokeWidth: 2,
                          r: 4,
                          stroke: "hsl(var(--background))",
                        }}
                        activeDot={{
                          r: 6,
                          fill: "hsl(221, 83%, 53%)",
                          stroke: "hsl(var(--background))",
                          strokeWidth: 2,
                        }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      <div>
        <h3 className="text-xl font-bold mb-4 text-primary">
          Learning Streaks
        </h3>
        <div className="mb-2 text-muted-foreground">
          Track your daily learning activities and maintain your streak for
          consistent progress.
        </div>
        <AccomplishmentGraph data={accomplishmentData} />
      </div>
    </motion.div>
  );
}
