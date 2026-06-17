"use client";

import type React from "react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { createQuest, QuestCreationResponse } from "@/lib/quest-service";
import toast from "react-hot-toast";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Quests, Reward } from "@/types/gamification";
import { Plus, Trash2, Save, Sparkles, Filter, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface MoodleDate {
  label: string;
  timestamp: number;
  dataid: string;
}

interface MoodleActivity {
  id: number;
  name: string;
  type: string;
  modname: string; // Moodle module name (assign, quiz, etc.)
  course: number; // course ID from Moodle
  description?: string;
  instance: number;
  is_assigned?: boolean;
  dates?: MoodleDate[]; // Activity dates (due dates, open/close dates, etc.)
  due_timestamp?: number; // Due date timestamp from backend
  is_overdue?: boolean; // Overdue status from backend
  raw?: any; // Raw Moodle data
}

interface Course {
  id: number;
  fullname: string;
  shortname: string;
  categoryid: number;
  raw?: any;
}

const stripHtmlTags = (html: string) => {
  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.innerHTML = html;
    return temp.textContent || temp.innerText || "";
  }
  return html.replace(/<[^>]*>?/gm, "");
};

export function QuestCreator() {
  const confirm = useConfirm();
  const notify = useNotify();
  const [activities, setActivities] = useState<MoodleActivity[]>([]);
  const [activeActivities, setActiveActivities] = useState<MoodleActivity[]>(
    []
  );
  const [dueActivities, setDueActivities] = useState<MoodleActivity[]>([]);
  const [filteredActiveActivities, setFilteredActiveActivities] = useState<
    MoodleActivity[]
  >([]);
  const [filteredDueActivities, setFilteredDueActivities] = useState<
    MoodleActivity[]
  >([]);
  const [filteredActivities, setFilteredActivities] = useState<
    MoodleActivity[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] =
    useState<MoodleActivity | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterAssigned, setFilterAssigned] = useState<string>("unassigned");
  const [priorityView, setPriorityView] = useState<string>("all"); // New filter for priority view
  const [filterCourse, setFilterCourse] = useState<string>("all"); // Course filter
  const [searchQuery, setSearchQuery] = useState("");
  const [courseMap, setCourseMap] = useState<{ [id: number]: string }>({});
  const [courses, setCourses] = useState<Course[]>([]); // Store courses array for dropdown
  const { user } = useCurrentUser();
  const [quest, setQuest] = useState<Partial<Quest>>({
    difficulty: "Medium",
    learningObjectives: [],
    rewards: [],
  });
  const [editing, setEditing] = useState(false);

  // Function to calculate XP based on difficulty
  const calculateXP = (difficulty: string): number => {
    const difficultyXPMap: Record<string, number> = {
      "Easy": 20,
      "Medium": 50,
      "Hard": 100,
      "Epic": 150
    };
    return difficultyXPMap[difficulty] || 50;
  };

  const [newObjective, setNewObjective] = useState("");
  const [newReward, setNewReward] = useState<Partial<Reward>>({
    type: "xp",
    value: 0,
    name: "",
  });


  // Fetch Moodle activities and courses
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Get moodleToken from cookies for Authorization header fallback
        const getCookieValue = (name: string) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop()?.split(';').shift();
          return null;
        };
        
        const moodleToken = getCookieValue('moodleToken');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // Add Authorization header as fallback if moodleToken exists
        if (moodleToken) {
          headers['Authorization'] = `Bearer ${moodleToken}`;
        }

        console.log('DEBUG: moodleToken:', moodleToken ? `${moodleToken.substring(0, 10)}...` : 'null');
        console.log('DEBUG: headers:', headers);

        // Fetch activities
        const activitiesRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/get-activities`,
          {
            credentials: "include",
            headers,
          }
        );
        if (!activitiesRes.ok) {
          const errorText = await activitiesRes.text();
          console.error('Activities API error:', activitiesRes.status, errorText);
          throw new Error(`Failed to fetch activities: ${activitiesRes.status} ${errorText}`);
        }
        const activitiesData = await activitiesRes.json();
        
        // Fetch courses
        const coursesRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/get-course`,
          {
            credentials: "include",
            headers,
          }
        );
        
        if (!coursesRes.ok) {
          const errorText = await coursesRes.text();
          console.error('Courses API error:', coursesRes.status, errorText);
          throw new Error(`Failed to fetch courses: ${coursesRes.status} ${errorText}`);
        }
        const coursesData = await coursesRes.json();

        // Create course mapping and store courses array
        const courseMapping: { [id: number]: string } = {};
        const coursesArray: Course[] = [];
        coursesData.courses?.forEach((course: Course) => {
          courseMapping[course.id] = course.fullname;
          coursesArray.push(course);
        });
        setCourseMap(courseMapping);
        setCourses(coursesArray); // Log the received data for debugging
        console.log("Activities data received:", activitiesData);

        // Function to normalize activity types from Moodle's internal names
        const normalizeActivityType = (type: string) => {
          switch (type) {
            case "assign":
              return "assignment";
            case "quiz":
              return "quiz";
            case "lesson":
              return "lesson";
            case "forum":
              return "forum";
            default:
              return "other";
          }
        };

        // Function to extract description from various sources
        const extractDescription = (activity: any) => {
          return stripHtmlTags(
            activity.description ||
              activity.raw?.description ||
              activity.raw?.intro ||
              ""
          );
        };

        // Process activities using the new categorized response
        const processActivities = (activities: any[]) =>
          activities.map((activity: any) => ({
            ...activity,
            type: normalizeActivityType(activity.modname || activity.type),
            description: extractDescription(activity),
            is_assigned: activity.is_assigned ?? false,
            dates: activity.raw?.dates || [],
          }));

        // Get categorized activities from the new API response
        const processedActiveActivities = processActivities(
          activitiesData.active_activities || []
        );
        const processedDueActivities = processActivities(
          activitiesData.due_activities || []
        );

        // Combine all activities for backward compatibility
        const allActivities = [
          ...processedActiveActivities,
          ...processedDueActivities,
          ...(activitiesData.activities || [])
            .filter(
              (activity: any) => !activity.is_assigned // Include unassigned activities
            )
            .map((activity: any) => ({
              ...activity,
              type: normalizeActivityType(activity.modname || activity.type),
              description: extractDescription(activity),
              is_assigned: activity.is_assigned ?? false,
              dates: activity.raw?.dates || [],
            })),
        ];

        console.log("Processed categorized activities:", {
          active: processedActiveActivities.length,
          due: processedDueActivities.length,
          total: allActivities.length,
        });

        setActiveActivities(processedActiveActivities);
        setDueActivities(processedDueActivities);
        setActivities(allActivities);
        setFilteredActivities(allActivities);
      } catch (error) {
        console.error("Error fetching data:", error);
        // You might want to show an error message to the user here
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);
  // Apply filters when they change
  useEffect(() => {
    // Apply filters to each category separately
    const applyFilters = (activityList: MoodleActivity[]) => {
      let result = [...activityList];

      // Filter by course
      if (filterCourse !== "all") {
        const courseId = parseInt(filterCourse);
        result = result.filter((activity) => activity.course === courseId);
      }

      // Filter by activity type
      if (filterType !== "all") {
        result = result.filter((activity) => activity.type === filterType);
      }

      // Filter by assignment status
      if (filterAssigned === "assigned") {
        result = result.filter((activity) => activity.is_assigned);
      } else if (filterAssigned === "unassigned") {
        result = result.filter((activity) => !activity.is_assigned);
      }

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        result = result.filter(
          (activity) =>
            activity.name.toLowerCase().includes(query) ||
            activity.description?.toLowerCase().includes(query) ||
            activity.course.toString().toLowerCase().includes(query)
        );
      }

      return result;
    };

    // Apply filters to categorized activities
    let filteredActive = applyFilters(activeActivities);
    let filteredDue = applyFilters(dueActivities);

    // Apply priority view filter
    if (priorityView === "active") {
      filteredDue = [];
    } else if (priorityView === "due") {
      filteredActive = [];
    }

    // Update state with filtered activities
    setFilteredActiveActivities(filteredActive);
    setFilteredDueActivities(filteredDue);

    // For backward compatibility, also update the legacy filteredActivities
    let legacyResult = [...activities];
    if (filterCourse !== "all") {
      const courseId = parseInt(filterCourse);
      legacyResult = legacyResult.filter((activity) => activity.course === courseId);
    }
    if (filterType !== "all") {
      legacyResult = legacyResult.filter(
        (activity) => activity.type === filterType
      );
    }
    if (filterAssigned === "assigned") {
      legacyResult = legacyResult.filter((activity) => activity.is_assigned);
    } else if (filterAssigned === "unassigned") {
      legacyResult = legacyResult.filter((activity) => !activity.is_assigned);
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      legacyResult = legacyResult.filter(
        (activity) =>
          activity.name.toLowerCase().includes(query) ||
          activity.description?.toLowerCase().includes(query) ||
          activity.course.toString().toLowerCase().includes(query)
      );
    }
    setFilteredActivities(legacyResult);

    console.log("Filtered activities:", {
      active: filteredActive.length,
      due: filteredDue.length,
      priorityView,
      filterCourse,
    });
  }, [
    filterType,
    filterAssigned,
    filterCourse,
    searchQuery,
    priorityView,
    activeActivities,
    dueActivities,
    activities,
  ]);

  // Handle activity selection
  const handleSelectActivity = (activity: MoodleActivity) => {
    setSelectedActivity(activity);
    // console.log("Selected activity:", activity.id);
    // Pre-populate the quest form with activity data
    setQuest({
      title: activity.name,
      description: activity.description,
      difficulty: "Medium",
      category: activity.course.toString(),
      learningObjectives: [],
      rewards: [],
    });
  };

  const addLearningObjective = () => {
    if (newObjective.trim()) {
      setQuest({
        ...quest,
        learningObjectives: [...(quest.learningObjectives || []), newObjective],
      });
      setNewObjective("");
    }
  };

  const removeLearningObjective = (index: number) => {
    const updatedObjectives = [...(quest.learningObjectives || [])];
    updatedObjectives.splice(index, 1);
    setQuest({
      ...quest,
      learningObjectives: updatedObjectives,
    });
  };

  const addReward = () => {
    if (newReward.name?.trim() && newReward.value) {
      setQuest({
        ...quest,
        rewards: [
          ...(quest.rewards || []),
          {
            type: newReward.type,
            value: newReward.value,
            name: newReward.name,
            description: newReward.description,
          } as Reward,
        ],
      });
      setNewReward({ type: "xp", value: 0, name: "" });
    }
  };

  const removeReward = (index: number) => {
    const updatedRewards = [...(quest.rewards || [])];
    updatedRewards.splice(index, 1);
    setQuest({
      ...quest,
      rewards: updatedRewards,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedActivity) {
      toast.error("Please select a Moodle activity first.");
      return;
    }

    // Calculate total XP: base XP (from difficulty) + XP rewards
    const baseXP = calculateXP(quest.difficulty as string);
    const rewardXP = (quest.rewards || [])
      .filter((reward) => reward.type === "xp")
      .reduce((sum, reward) => sum + (reward.value || 0), 0);
    const totalXP = baseXP + rewardXP;

    // Map difficulty string to integer for backend
    const difficultyMap: Record<string, number> = {
      Easy: 1,
      Medium: 2,
      Hard: 3,
      Epic: 4,
    };
    const difficultyInt = difficultyMap[quest.difficulty as string] || 2;

    const completeQuest: Quest = {
      id: `quest-${Date.now()}`,
      title: quest.title || selectedActivity.name,
      description: quest.description || selectedActivity.description || "",
      progress: 0,
      moodleActivityId: selectedActivity.id,
      moodleCourse: selectedActivity.course,
      difficulty: quest.difficulty as "Easy" | "Medium" | "Hard" | "Epic",
      category: selectedActivity.type.toString(),
      deadline: selectedActivity.dates?.find((d) =>
        d.label.toLowerCase().includes("due")
      )?.timestamp
        ? new Date(
            selectedActivity.dates.find((d) =>
              d.label.toLowerCase().includes("due")
            )!.timestamp * 1000
          ).toISOString()
        : null,
      status: "not-started",
      creatorId: user?.id ?? 0,
      learningObjectives: quest.learningObjectives || [],
      rewards: (quest.rewards as Reward[]) || [],
    };
    console.log("Submitting quest:", completeQuest);
    try {
      // Send to backend with correct field mapping
      const response: QuestCreationResponse = await createQuest({
        title: quest.title || selectedActivity.name,
        description: quest.description || selectedActivity.description || "",
        course_id: selectedActivity.course, // Map moodleCourse to course_id for backend
        creator_id: user?.id ?? 0, // Map creatorId to creator_id for backend
        difficulty_level: difficultyInt, // Use difficulty_level for backend
        exp_reward: baseXP, // Send calculated XP reward
        quest_type: "assignment", // Default quest type
        validation_method: "manual", // Default validation method
        validation_criteria: {}, // No tasks, empty validation criteria
        is_active: true,
        moodle_activity_id: selectedActivity.id, // Map moodleActivityId to moodle_activity_id
        moodle_course_id: selectedActivity.course,
        moodle_user_id: user?.id ?? 0,
      });

      if (!response || response.success === false) {
        toast.error(
          response?.error ||
            response?.message ||
            "Failed to create quest. See console for details."
        );
        console.error("Quest creation error:", response);
        return;
      }

      // Success!
      toast.success(
        "Quest assigned! Gamification elements successfully assigned to Moodle activity."
      );

      // Mark activity as assigned in the mock data
      const updatedActivities = activities.map((activity) =>
        activity.id === selectedActivity.id
          ? { ...activity, is_assigned: true }
          : activity
      );
      setActivities(updatedActivities);
      setFilteredActivities(
        updatedActivities.filter(
          (a) =>
            !a.is_assigned && (filterType === "all" || a.type === filterType)
        )
      );
      setSelectedActivity(null);
      setQuest({
        difficulty: "Medium",
        learningObjectives: [],
        rewards: [],
      });
    } catch (error: any) {
      toast.error(
        error?.error ||
          error?.message ||
          "Failed to assign quest. See console for details."
      );
      console.error("Quest creation error:", error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading Moodle Activities</CardTitle>
          <CardDescription>
            Please wait while we fetch available activities from Moodle...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          </div>

              {/* Edit/Delete buttons for assigned quest */}
              {selectedActivity?.is_assigned && (
                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditing(true);
                      toast.success("Editing mode enabled");
                    }}
                  >
                    Edit Quest
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Delete this quest?",
                        description: "This can't be undone.",
                        confirmText: "Delete",
                        destructive: true,
                      });
                      if (!ok) return;
                      // Call deleteQuest API here (mock)
                      setSelectedActivity(null);
                      setEditing(false);
                      await notify({ variant: "success", description: "Quest deleted." });
                    }}
                  >
                    Delete Quest
                  </Button>
                </div>
              )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Assign Gamification to Moodle Activities</CardTitle>
          <CardDescription>
            Select an existing Moodle activity and turn it into a quest by
            adding XP, badges, and learning objectives. Activities are now
            categorized by due date status.
          </CardDescription>

          {/* Activity Summary */}
          {(activeActivities.length > 0 || dueActivities.length > 0) && (
            <div className="flex gap-4 mt-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  {activeActivities.length} Active (not yet due)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  {dueActivities.length} Due/Overdue
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="text-sm font-medium">
                  {activities.length} Total Activities
                </span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="search">Search Activities</Label>
                <Input
                  id="search"
                  placeholder="Search by name, description or course"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="space-y-1">
                <Label>Course</Label>
                <Select value={filterCourse} onValueChange={setFilterCourse}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id.toString()}>
                        {course.fullname}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Activity Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="assignment">Assignments</SelectItem>
                    <SelectItem value="quiz">Quizzes</SelectItem>
                    <SelectItem value="lesson">Lessons</SelectItem>
                    <SelectItem value="forum">Forums</SelectItem>
                    <SelectItem value="other">Other Activities</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Priority View</Label>
                <Select value={priorityView} onValueChange={setPriorityView}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activities</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="due">Due/Overdue Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Label>Show:</Label>
              <RadioGroup
                defaultValue="unassigned"
                value={filterAssigned}
                onValueChange={setFilterAssigned}
                className="flex space-x-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="unassigned" id="unassigned" />
                  <Label htmlFor="unassigned">Unassigned Activities</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="assigned" id="assigned" />
                  <Label htmlFor="assigned">Already Assigned</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">All Activities</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Activity list with categorization */}
            <div className="space-y-4">
              {/* Active Activities Section */}
              {filteredActiveActivities.length > 0 && (
                <div className="border rounded-md">
                  <div className="bg-green-50 border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <h3 className="font-semibold text-green-800">
                        Active Activities ({filteredActiveActivities.length})
                      </h3>
                      <Badge
                        variant="outline"
                        className="text-green-600 border-green-600"
                      >
                        Not yet due
                      </Badge>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      These activities are assigned and have upcoming due dates
                    </p>
                  </div>
                  <div className="divide-y">
                    {filteredActiveActivities.map((activity) => (
                      <div
                        key={`active-${activity.id}`}
                        className={`p-4 hover:bg-green-50/50 cursor-pointer transition-colors ${
                          selectedActivity?.id === activity.id
                            ? "bg-primary/10"
                            : ""
                        }`}
                        onClick={() => handleSelectActivity(activity)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{activity.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                            <div className="flex items-center mt-2 gap-2">
                              <Badge variant="outline">{activity.type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {courseMap[activity.course] ||
                                  `Course ${activity.course}`}
                              </span>
                              {activity.dates?.map((date, index) => (
                                <span
                                  key={index}
                                  className="text-xs text-green-600 font-medium"
                                >
                                  {date.label}{" "}
                                  {new Date(
                                    date.timestamp * 1000
                                  ).toLocaleDateString()}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge className="bg-green-500 hover:bg-green-600">
                              Active
                            </Badge>
                            {activity.is_assigned && (
                              <Badge variant="secondary">Assigned</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Due/Overdue Activities Section */}
              {filteredDueActivities.length > 0 && (
                <div className="border rounded-md">
                  <div className="bg-red-50 border-b px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <h3 className="font-semibold text-red-800">
                        Due/Overdue Activities ({filteredDueActivities.length})
                      </h3>
                      <Badge variant="destructive" className="bg-red-600">
                        Past due date
                      </Badge>
                    </div>
                    <p className="text-sm text-red-700 mt-1">
                      These activities are assigned and have passed their due
                      dates
                    </p>
                  </div>
                  <div className="divide-y">
                    {filteredDueActivities.map((activity) => (
                      <div
                        key={`due-${activity.id}`}
                        className={`p-4 hover:bg-red-50/50 cursor-pointer transition-colors ${
                          selectedActivity?.id === activity.id
                            ? "bg-primary/10"
                            : ""
                        }`}
                        onClick={() => handleSelectActivity(activity)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{activity.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {activity.description}
                            </p>
                            <div className="flex items-center mt-2 gap-2">
                              <Badge variant="outline">{activity.type}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {courseMap[activity.course] ||
                                  `Course ${activity.course}`}
                              </span>
                              {activity.dates?.map((date, index) => (
                                <span
                                  key={index}
                                  className="text-xs text-red-600 font-medium"
                                >
                                  {date.label}{" "}
                                  {new Date(
                                    date.timestamp * 1000
                                  ).toLocaleDateString()}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge
                              variant="destructive"
                              className="bg-red-500 hover:bg-red-600"
                            >
                              Overdue
                            </Badge>
                            {activity.is_assigned && (
                              <Badge variant="secondary">Assigned</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback for filtered activities (backward compatibility) */}
              {filteredActivities.length > 0 &&
                filteredActiveActivities.length === 0 &&
                filteredDueActivities.length === 0 && (
                  <div className="border rounded-md">
                    <div className="bg-gray-50 border-b px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                        <h3 className="font-semibold text-gray-800">
                          All Activities ({filteredActivities.length})
                        </h3>
                        <Badge
                          variant="outline"
                          className="text-gray-600 border-gray-600"
                        >
                          Mixed status
                        </Badge>
                      </div>
                    </div>
                    <div className="divide-y">
                      {filteredActivities.map((activity) => (
                        <div
                          key={`filtered-${activity.id}`}
                          className={`p-4 hover:bg-muted/50 cursor-pointer ${
                            selectedActivity?.id === activity.id
                              ? "bg-primary/10"
                              : ""
                          }`}
                          onClick={() => handleSelectActivity(activity)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium">{activity.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {activity.description}
                              </p>
                              <div className="flex items-center mt-2 gap-2">
                                <Badge variant="outline">{activity.type}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {courseMap[activity.course] ||
                                    `Course ${activity.course}`}
                                </span>
                                {activity.dates?.map((date, index) => (
                                  <span
                                    key={index}
                                    className="text-xs text-muted-foreground"
                                  >
                                    {date.label}{" "}
                                    {new Date(
                                      date.timestamp * 1000
                                    ).toLocaleDateString()}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {activity.is_assigned && (
                              <Badge className="ml-2 bg-green-500">
                                Assigned
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* No activities found */}
              {filteredActivities.length === 0 &&
                filteredActiveActivities.length === 0 &&
                filteredDueActivities.length === 0 && (
                  <div className="border rounded-md p-6 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <BookOpen className="h-12 w-12 text-muted-foreground" />
                      <p className="text-muted-foreground">
                        No matching Moodle activities found
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Try changing your search or filters
                      </p>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedActivity && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{selectedActivity.name}</CardTitle>
                
                </div>
                <div className="flex gap-2">
                  <Badge>{selectedActivity.type}</Badge>
                  {selectedActivity.is_assigned && (
                    <Badge variant="destructive">Already Assigned</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="basic">
                <TabsList>
                  <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                  <TabsTrigger value="objectives">
                    Learning Objectives
                  </TabsTrigger>
                  <TabsTrigger value="rewards">Rewards</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="difficulty">Difficulty Level</Label>
                      <Select
                        value={quest.difficulty}
                        onValueChange={(value) =>
                          setQuest({ ...quest, difficulty: value as any })
                        }
                      >
                        <SelectTrigger id="difficulty">
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Medium">Medium</SelectItem>
                          <SelectItem value="Hard">Hard</SelectItem>
                          <SelectItem value="Epic">Epic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="base-xp">Base XP Award</Label>
                      <div className="flex items-center space-x-2">
                        <Input
                          id="base-xp"
                          type="number"
                          value={calculateXP(quest.difficulty as string)}
                          disabled
                          className="bg-muted"
                        />
                        <span className="text-sm text-muted-foreground">
                          (Auto-calculated)
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">
                      Description Override (Optional)
                    </Label>
                    <Textarea
                      id="description"
                      value={quest.description}
                      onChange={(e) =>
                        setQuest({ ...quest, description: e.target.value })
                      }
                      placeholder="Leave empty to use the original Moodle description"
                      rows={3}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="objectives" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Learning Objectives</Label>
                    <div className="flex space-x-2">
                      <Input
                        value={newObjective}
                        onChange={(e) => setNewObjective(e.target.value)}
                        placeholder="Add a learning objective"
                      />
                      <Button
                        type="button"
                        onClick={addLearningObjective}
                        size="sm"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      {quest.learningObjectives?.map((objective, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {objective}
                          <button
                            type="button"
                            onClick={() => removeLearningObjective(index)}
                            className="ml-1 rounded-full hover:bg-muted p-1"
                            aria-label={`Remove objective: ${objective}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </TabsContent>


                <TabsContent value="rewards" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Rewards (What students earn upon completion)</Label>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div>
                        <Select
                          value={newReward.type}
                          onValueChange={(value) =>
                            setNewReward({ ...newReward, type: value as any })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Badge Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="achievement">
                              Achievement Badge
                            </SelectItem>
                            <SelectItem value="progress">
                              Progress Badge
                            </SelectItem>
                            <SelectItem value="participation">
                              Participation Badge
                            </SelectItem>
                            <SelectItem value="special">
                              Special Badge
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          value={newReward.name}
                          onChange={(e) =>
                            setNewReward({ ...newReward, name: e.target.value })
                          }
                          placeholder="Select or enter badge name"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={addReward}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Assign Badge
                    </Button>

                    <div className="space-y-2 mt-2">
                      {quest.rewards?.map((reward, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 border rounded-md"
                        >
                          <div className="flex-1">
                            <div className="font-medium">{reward.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {reward.type.charAt(0).toUpperCase() +
                                reward.type.slice(1)}{" "}
                              Badge
                            </div>
                          </div>
                          <Button
                            type="button"
                            onClick={() => removeReward(index)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={selectedActivity.is_assigned && !editing}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {selectedActivity.is_assigned && !editing
                  ? "Already Assigned to Students"
                  : selectedActivity.is_assigned && editing
                  ? "Save Changes"
                  : "Assign Quest to Students"}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}

interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  difficulty: "Easy" | "Medium" | "Hard" | "Epic";
  category: string;
  moodleCourse: number;
  moodleActivityId: number;
  deadline: string | null;
  status: string;
  creatorId: number;
  learningObjectives?: string[];
  rewards: Reward[];
}
