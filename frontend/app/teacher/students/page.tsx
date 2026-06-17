"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Loader2,
  MoreHorizontal,
  Star,
  Trophy,
  TrendingUp,
  BookOpen,
  Award,
  Filter,
  Download,
  Mail,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { LeaderboardUser } from "@/types/gamification";
import { classService, type ClassItem } from "@/lib/class-service";

interface StudentStats {
  totalStudents: number;
  activeStudents: number;
  averageProgress: number;
  topPerformer: string;
}

// Helper function to generate stable mock activity days based on student ID
// This ensures the same student always gets the same activity days value
function getStableMockActivityDays(studentId: number): number {
  // Use a simple hash based on student ID to get a consistent value between 0-13
  return (studentId % 14);
}

export default function TeacherStudentsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("rank");
  const [filterBy, setFilterBy] = useState<string>("all");

  // Class filter — the teacher's classes + the set of student ids in each, so
  // the overview can be narrowed to one class when they teach several.
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [membersByClass, setMembersByClass] = useState<Record<number, Set<number>>>({});
  const [classFilter, setClassFilter] = useState<number | "all">("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cls = await classService.listMyClasses().catch(() => []);
      if (cancelled) return;
      setClasses(cls);
      const entries = await Promise.all(
        cls.map(async (c) => {
          const members = await classService.listMembers(c.id).catch(() => []);
          const ids = new Set(
            members.filter((m) => m.role === "student").map((m) => m.user_id)
          );
          return [c.id, ids] as const;
        })
      );
      if (cancelled) return;
      setMembersByClass(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  
  // Handler for sort change with validation
  const handleSortChange = (value: string) => {
    const validSortOptions = ["rank", "name", "xp", "quests", "level"];
    if (validSortOptions.includes(value)) {
      setSortBy(value);
    }
  };
  const [selectedStudent, setSelectedStudent] =
    useState<LeaderboardUser | null>(null);

  // Use the leaderboard hook to get real student data
  const {
    data,
    loading,
    error,
    searchQuery: hookSearchQuery,
    searchResults,
    searchLoading,
    setSearchQuery: setHookSearchQuery,
    refresh,
  } = useLeaderboard({
    autoFetch: true,
    initialTimeframe: "all_time",
    initialMetricType: "exp",
  });

  // Update hook search query when local search changes
  useEffect(() => {
    setHookSearchQuery(searchQuery);
  }, [searchQuery, setHookSearchQuery]);

  // Combine all students data
  const allStudents = useMemo(
    () => [...data.topUsers, ...data.otherUsers],
    [data.topUsers, data.otherUsers]
  );

  const displayedStudents = useMemo(
    () => (searchQuery.trim() ? searchResults : allStudents),
    [searchQuery, searchResults, allStudents]
  );

  // Filter students based on criteria
  const filteredStudents = useMemo(() => {
    const classIds = classFilter !== "all" ? membersByClass[classFilter] : null;
    return displayedStudents.filter((student) => {
      // Narrow to the selected class's enrolled students.
      if (classIds && !classIds.has(student.id)) return false;
      // Use stable mock activity days based on student ID
      const mockLastActivityDays = getStableMockActivityDays(student.id);
      if (filterBy === "active") return mockLastActivityDays <= 7;
      if (filterBy === "inactive") return mockLastActivityDays > 7;
      if (filterBy === "high_performers") return (student.position || 999) <= 10;
      // For needs attention we do not filter; sorting will handle ordering
      return true;
    });
  }, [displayedStudents, filterBy, classFilter, membersByClass]);

  // Sort students
  const sortedStudents = useMemo(() => {
    // Create a copy to avoid mutating the original array
    const studentsToSort = [...filteredStudents];

    // Needs attention: sort by lowest XP, then lowest badges, keep all students
    if (filterBy === "needs_attention") {
      return studentsToSort.sort((a, b) => {
        const xpA = a.stats?.exp_points ?? 0;
        const xpB = b.stats?.exp_points ?? 0;
        if (xpA !== xpB) return xpA - xpB;

        const badgesA = a.stats?.badges_earned ?? 0;
        const badgesB = b.stats?.badges_earned ?? 0;
        if (badgesA !== badgesB) return badgesA - badgesB;

        // Stable tertiary key to avoid jitter
        return (a.username || "").localeCompare(b.username || "", undefined, {
          sensitivity: "base",
        });
      });
    }

    // Ensure sortBy has a valid value
    const currentSort = sortBy || "rank";

    return studentsToSort.sort((a, b) => {
      switch (currentSort) {
        case "rank":
          const rankA = a.position ?? 999;
          const rankB = b.position ?? 999;
          return rankA - rankB;

        case "name":
          const nameA = `${a.first_name || ""} ${a.last_name || ""}`.trim() || a.username || "";
          const nameB = `${b.first_name || ""} ${b.last_name || ""}`.trim() || b.username || "";
          return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });

        case "xp":
          const xpA = a.stats?.exp_points ?? 0;
          const xpB = b.stats?.exp_points ?? 0;
          return xpB - xpA;

        case "quests":
          const questsA = a.stats?.quests_completed ?? 0;
          const questsB = b.stats?.quests_completed ?? 0;
          return questsB - questsA;

        case "level":
          const levelA = a.level ?? 0;
          const levelB = b.level ?? 0;
          return levelB - levelA;

        default:
          return 0;
      }
    });
  }, [filteredStudents, filterBy, sortBy]);
  // Students in scope for the summary cards: all of the teacher's, or just the
  // selected class.
  const scopedStudents = useMemo(() => {
    if (classFilter === "all") return allStudents;
    const ids = membersByClass[classFilter];
    return ids ? allStudents.filter((s) => ids.has(s.id)) : [];
  }, [allStudents, classFilter, membersByClass]);

  // Calculate stats
  const stats: StudentStats = {
    totalStudents: scopedStudents.length,
    activeStudents: Math.floor(scopedStudents.length * 0.7), // Mock 70% active rate
    averageProgress:
      scopedStudents.length > 0
        ? Math.round(
            scopedStudents.reduce((sum, s) => sum + s.stats.exp_points, 0) /
              scopedStudents.length
          )
        : 0,
    topPerformer:
      scopedStudents.length > 0
        ? `${scopedStudents[0]?.first_name} ${scopedStudents[0]?.last_name}`.trim() ||
          scopedStudents[0]?.username ||
          "Unknown"
        : "No students",
  };

  if (loading && allStudents.length === 0) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading students...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center gap-4">
            <p className="text-destructive">Error loading students: {error}</p>
            <Button variant="outline" onClick={refresh}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary/80 to-primary bg-clip-text text-transparent">
          Student Management
        </h1>
        <p className="text-muted-foreground">
          Monitor student progress, engagement, and performance across all
          courses
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-blue-700 flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Total Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">
              {stats.totalStudents}
            </div>
            <p className="text-sm text-blue-600/80">Enrolled in your courses</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-emerald-700 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Active Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700">
              {stats.activeStudents} / {stats.totalStudents}
            </div>
            <p className="text-sm text-emerald-600/80">Active in last 7 days</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-purple-700 flex items-center gap-2">
              <Star className="h-5 w-5" />
              Average XP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">
              {stats.averageProgress}
            </div>
            <p className="text-sm text-purple-600/80">
              Experience points per student
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-amber-700 flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Top Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-amber-700 truncate">
              {stats.topPerformer}
            </div>
            <p className="text-sm text-amber-600/80">Current leaderboard #1</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search students..."
              className="pl-8 w-full sm:w-[300px] bg-muted/50 border-muted-foreground/20 focus:border-primary"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={searchLoading}
            />
            {searchLoading && (
              <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">

        {classes.length > 1 && (
          <Select
            value={classFilter === "all" ? "all" : String(classFilter)}
            onValueChange={(v) => setClassFilter(v === "all" ? "all" : Number(v))}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
            value={sortBy}
            onValueChange={handleSortChange}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rank">Rank</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="xp">Experience</SelectItem>
              <SelectItem value="quests">Quests</SelectItem>
              <SelectItem value="level">Level</SelectItem>
            </SelectContent>
          </Select>
        <Select value={filterBy} onValueChange={setFilterBy}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Students</SelectItem>
            <SelectItem value="active">Active (7 days)</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="high_performers">Top Performers</SelectItem>
            <SelectItem value="needs_attention">Needs Attention</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>

      {/* Students Table */}
      <Card className="bg-gradient-to-br from-background to-muted/20 border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle>Student Overview</CardTitle>
          <CardDescription>
            Detailed view of all students with their progress and engagement
            metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sortedStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery.trim() || filterBy !== "all"
                ? "No students found matching your criteria."
                : "No students enrolled yet."}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Experience</TableHead>
                    <TableHead>Quests</TableHead>
                    <TableHead>Badges</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStudents.map((student) => {
                    const name =
                      `${student.first_name} ${student.last_name}`.trim() ||
                      student.username;

                    return (
                      <TableRow key={student.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center justify-center w-8">
                            <span
                              className={`font-bold ${
                                (student.position || 999) === 1
                                  ? "text-amber-500"
                                  : (student.position || 999) === 2
                                  ? "text-zinc-400"
                                  : (student.position || 999) === 3
                                  ? "text-amber-600"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {student.position || "—"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage
                                src={
                                  student.profile_image_url ||
                                  "/placeholder.svg"
                                }
                                alt={name}
                              />
                              <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{name}</div>
                              <div className="text-sm text-muted-foreground">
                                {student.username}
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="secondary" className="font-medium">
                            Level {student.level}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-amber-500" />
                            <span className="font-medium">
                              {student.stats.exp_points} XP
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Award className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">
                              {student.stats.quests_completed}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Award className="h-4 w-4 text-purple-500" />
                            <span className="font-medium">
                              {student.stats.badges_earned}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setSelectedStudent(student)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                             
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <Card className="fixed inset-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="fixed left-[50%] top-[50%] z-50 grid w-[calc(100%-1.5rem)] max-w-2xl max-h-[90vh] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-background p-4 sm:p-6 shadow-lg duration-200 rounded-lg">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Student Details</h3>
              <Button
                variant="ghost"
                onClick={() => setSelectedStudent(null)}
                className="h-8 w-8 p-0"
              >
                ×
              </Button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={
                      selectedStudent.profile_image_url || "/placeholder.svg"
                    }
                    alt={`${selectedStudent.first_name} ${selectedStudent.last_name}`}
                  />
                  <AvatarFallback>
                    {`${selectedStudent.first_name} ${selectedStudent.last_name}`.charAt(
                      0
                    )}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-xl font-bold">
                    {`${selectedStudent.first_name} ${selectedStudent.last_name}`.trim() ||
                      selectedStudent.username}
                  </h4>
                  <p className="text-muted-foreground">
                    @{selectedStudent.username}
                  </p>
                  <Badge variant="secondary">
                    Level {selectedStudent.level}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Experience Points
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedStudent.stats.exp_points} XP
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Rank
                  </div>
                  <div className="text-2xl font-bold">
                    #{selectedStudent.position || "—"}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Quests Completed
                  </div>
                  <div className="text-2xl font-bold">
                    {selectedStudent.stats.quests_completed}
                  </div>
                </div>{" "}
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Last Active
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.floor(Math.random() * 14) <= 1
                      ? "Today"
                      : `${Math.floor(Math.random() * 14)}d ago`}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Message
                </Button>
                <Button variant="outline" className="flex-1">
                  <Download className="h-4 w-4 mr-2" />
                  Export Progress
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
