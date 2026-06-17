"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { QuestCreator } from "@/components/dashboard/teacher/quest-creator";
import { QuestManager } from "@/components/dashboard/teacher/quest-manager";
import { StudentProgressAnalytics } from "@/components/dashboard/teacher/student-progress-analytics";
import { ClassLeaderboard } from "@/components/dashboard/teacher/class-leaderboard";
import { BadgeCreator } from "@/components/teacher/badge-creator";
import { Badge as BadgeType } from "@/types/badges";
import { Plus, Award, BarChart3, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useTeacherDashboard } from "@/hooks/use-teacher-dashboard";
import { TeacherDashboardService, RecentActivity } from "@/lib/teacher-dashboard-service";
import { apiClient } from "@/lib/api-client";

export function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showQuestCreator, setShowQuestCreator] = useState(false);
  const [showBadgeCreator, setShowBadgeCreator] = useState(false);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);

  // Use teacher dashboard hook for real data
  const {
    data: dashboardData,
    loading: dashboardLoading,
    error: dashboardError,
    refetch,
  } = useTeacherDashboard({
    timeRange: "week",
    autoFetch: true,
  });

  // Fetch recent activity using the service
  useEffect(() => {
    const fetchRecentActivity = async () => {
      setActivityLoading(true);
      try {
        const data = (await apiClient.request(
          "/activity-log?limit=5",
          "GET"
        )) as Array<any>;
        const activities: RecentActivity[] = data.map((item: any) => ({
          userId: item.user_id ?? 0, // fallback to 0 if not present
          studentName: item.student_name || item.studentName,
          action: item.action,
          timestamp: item.timestamp || new Date().toISOString(), // fallback to now if not present
          timeAgo: item.time_ago || item.timeAgo,
        }));
        setRecentActivity(activities);
      } catch (error) {
        console.error("Error fetching recent activity:", error);
      } finally {
        setActivityLoading(false);
      }
    };
    fetchRecentActivity();
  }, []);

  const handleBadgeCreated = (badge: BadgeType) => {
    console.log("Badge created:", badge);
    setShowBadgeCreator(false);
    // TODO: Refresh badge list or show success message
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent">
          Teacher Dashboard
        </h2>
        <p className="text-muted-foreground">
          Create quests, manage achievements, and view student reports
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-blue-700">
              Active Quests
            </CardTitle>
            <CardDescription className="text-blue-600/80">
              Quests you created that are currently active
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-blue-700" />
              </div>
            ) : dashboardError ? (
              <div className="text-red-600 text-sm">Error loading data</div>
            ) : (
              <>
                <div className="text-3xl font-bold text-blue-700">
                  {dashboardData?.activeQuests.active || 0} / {dashboardData?.activeQuests.total || 0}
                </div>
                <p className="text-sm text-blue-600/80">
                  {dashboardData?.activeQuests.nearDue || 0} quests due within 7 days
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-emerald-700">
              Quest Completion
            </CardTitle>
            <CardDescription className="text-emerald-600/80">
              Average completion rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
              </div>
            ) : dashboardError ? (
              <div className="text-red-600 text-sm">Error loading data</div>
            ) : (
              <>
                <div className="text-3xl font-bold text-emerald-700">
                  {dashboardData?.questCompletion.rate.toFixed(1) || 0}%
                </div>
                <p className="text-sm text-emerald-600/80">
                  {(dashboardData?.questCompletion.change || 0) >= 0 ? "Up" : "Down"} {Math.abs(dashboardData?.questCompletion.change || 0).toFixed(1)}% from last week
                </p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-purple-700">
              Engagement Score
            </CardTitle>
            <CardDescription className="text-purple-600/80">
              Class participation level
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-purple-700" />
              </div>
            ) : dashboardError ? (
              <div className="text-red-600 text-sm">Error loading data</div>
            ) : (
              <>
                <div className="text-3xl font-bold text-purple-700">
                  {dashboardData?.engagementScore.score.toFixed(1) || 0} / {dashboardData?.engagementScore.maxScore || 10}
                </div>
                <p className="text-sm text-purple-600/80">
                  Based on activity and quest completion
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      {showQuestCreator ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold">
              Assign Gamification to Moodle Activities
            </h3>
            <Button
              variant="outline"
              onClick={() => setShowQuestCreator(false)}
            >
              Cancel
            </Button>
          </div>
          <QuestCreator />
        </div>
      ) : showBadgeCreator ? (
        <div className="space-y-4">
          <BadgeCreator
            onBadgeCreated={handleBadgeCreated}
            onCancel={() => setShowBadgeCreator(false)}
          />
        </div>
      ) : (
        <Tabs
          defaultValue="overview"
          value={activeTab}
          onValueChange={setActiveTab}
        >
          <div className="flex justify-between items-center">
            <TabsList className="bg-muted/50">
              <TabsTrigger
                value="overview"
                className="data-[state=active]:bg-background"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="quests"
                className="data-[state=active]:bg-background"
              >
                Quests
              </TabsTrigger>
              <TabsTrigger
                value="students"
                className="data-[state=active]:bg-background"
              >
                Leaderboards
              </TabsTrigger>
              <TabsTrigger
                value="analytics"
                className="data-[state=active]:bg-background"
              >
                Analytics
              </TabsTrigger>
            </TabsList>
            <Button
              onClick={() => setShowQuestCreator(true)}
              className="bg-primary hover:bg-primary/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Assign Quest Values
            </Button>
          </div>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {" "}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Achievements Button */}
              <Button
                variant="outline"
                onClick={() => setShowBadgeCreator(true)}
                className="h-auto flex flex-col items-center p-6 space-y-2 w-full bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100 hover:from-amber-100 hover:to-yellow-100 shadow-sm group transition-all duration-200"
              >
                <Award className="h-10 w-10 mb-2 text-amber-600 group-hover:scale-110 transition-transform" />
                <span className="text-lg font-medium text-amber-700">
                  Create Badges
                </span>
                <span className="text-sm text-amber-600/80 text-center">
                  Create and assign custom achievement badges
                </span>
              </Button>

              {/* Reports Button with Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-auto flex flex-col items-center p-6 space-y-2 w-full bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 hover:from-blue-100 hover:to-indigo-100 shadow-sm group transition-all duration-200"
                  >
                    <BarChart3 className="h-10 w-10 mb-2 text-blue-600 group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-medium text-blue-700">
                      Reports
                    </span>
                    <span className="text-sm text-blue-600/80 text-center">
                      Generate detailed progress reports
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px] dark:bg-slate-900 bg-white">
                  <DialogHeader>
                    <DialogTitle>Report Metrics</DialogTitle>
                    <DialogDescription>
                      Configure and generate custom reports for your class.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      <div className="col-span-2">
                        <Label htmlFor="report-type">Report Type</Label>
                        <Select defaultValue="progress">
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="progress">
                              Progress Report
                            </SelectItem>
                            <SelectItem value="achievement">
                              Achievement Summary
                            </SelectItem>
                            <SelectItem value="engagement">
                              Engagement Metrics
                            </SelectItem>
                            <SelectItem value="custom">
                              Custom Report
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label htmlFor="time-period">Time Period</Label>
                        <Select defaultValue="week">
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Select period" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="week">Last Week</SelectItem>
                            <SelectItem value="month">Last Month</SelectItem>
                            <SelectItem value="quarter">
                              Last Quarter
                            </SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4">
                        <Label>Metrics to Include</Label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="quest-metrics" defaultChecked />
                            <label htmlFor="quest-metrics" className="text-sm">
                              Quest Completion
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="xp-metrics" defaultChecked />
                            <label htmlFor="xp-metrics" className="text-sm">
                              XP Earned
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="badge-metrics" defaultChecked />
                            <label htmlFor="badge-metrics" className="text-sm">
                              Badges Earned
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="activity-metrics" defaultChecked />
                            <label
                              htmlFor="activity-metrics"
                              className="text-sm"
                            >
                              Activity Levels
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="time-metrics" />
                            <label htmlFor="time-metrics" className="text-sm">
                              Time Spent
                            </label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox id="comparison-metrics" />
                            <label
                              htmlFor="comparison-metrics"
                              className="text-sm"
                            >
                              Class Comparison
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="col-span-4">
                        <Label htmlFor="report-format">Report Format</Label>
                        <Select defaultValue="pdf">
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pdf">PDF Document</SelectItem>
                            <SelectItem value="excel">
                              Excel Spreadsheet
                            </SelectItem>
                            <SelectItem value="online">
                              Online Dashboard
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline">Cancel</Button>
                    <Button>Generate Report</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <Card className="bg-gradient-to-br from-background to-muted/20 border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest student interactions and completions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activityLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading recent activity...</span>
                  </div>
                ) : recentActivity.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No recent activity found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border-b last:border-b-0">
                        <div className="text-sm text-muted-foreground">
                          {activity.action}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {activity.timeAgo}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quests" className="mt-6">
            <QuestManager />
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <ClassLeaderboard />
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <StudentProgressAnalytics />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
