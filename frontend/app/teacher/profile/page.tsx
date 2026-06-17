"use client";

import { useAuth } from "@/lib/auth-context";
import { DriveConnectionCard } from "@/components/teacher/drive-connection-card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Users,
  Edit,
  Mail,
  User,
  School,
  Calendar,
  Trophy,
  Target,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { apiClient, type TeacherProfile } from "@/lib/api-client";

export default function TeacherProfilePage() {
  const { user, isLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<TeacherProfile | null>(null);
  const router = useRouter();

  // Redirect if not a teacher
  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/signin");
    }
    if (!isLoading && user && user.role !== "teacher") {
      router.push("/dashboard");
    }
  }, [isLoading, user, router]);

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user || user.role !== "teacher") return;

      try {
        setLoading(true);

        // Fetch real teacher profile data using API client
        const profileData = await apiClient.getTeacherProfile();
        setProfileData(profileData);
      } catch (error) {
        console.error("Error loading profile:", error);
        // Fallback to basic user data if API call fails
        const fallbackProfile: TeacherProfile = {
          id: parseInt(user.id),
          username: user.username,
          first_name: user.name?.split(" ")[0] || "",
          last_name: user.name?.split(" ").slice(1).join(" ") || "",
          email: user.email || "",
          joined_date: new Date().toISOString(),
          total_courses: 0,
          active_courses: 0,
          total_students: 0,
          quests_created: 0,
          badges_designed: 0,
          account_status: "Active",
        };
        setProfileData(fallbackProfile);
      } finally {
        setLoading(false);
      }
    };

    if (user && user.role === "teacher") {
      loadProfile();
    }
  }, [user]);

  if (isLoading || loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-60" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user || !profileData) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Profile Not Found</h2>
              <p className="text-muted-foreground">
                Unable to load profile information.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayName =
    profileData.first_name && profileData.last_name
      ? `${profileData.first_name} ${profileData.last_name}`
      : user.name || user.username;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="grid gap-6">
        {/* Profile Header */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <Avatar className="h-20 w-20">
                {profileData.profile_image_url ? (
                  <AvatarImage
                    src={profileData.profile_image_url}
                    alt={displayName}
                  />
                ) : null}
                <AvatarFallback className="text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center sm:text-left">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{displayName}</CardTitle>
                    <CardDescription className="text-base flex items-center gap-2 mt-1">
                      <Mail className="h-4 w-4" />
                      {profileData.email}
                    </CardDescription>
                    <Badge
                      variant="default"
                      className="bg-blue-100 text-blue-800 mt-2"
                    >
                      <School className="h-3 w-3 mr-1" />
                      Teacher
                    </Badge>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/teacher/profile/edit">
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Profile
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Google Drive connection for submission storage */}
        <DriveConnectionCard />

        <div className="grid gap-6 md:grid-cols-2">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">
                    Username
                  </span>
                  <span>{profileData.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">
                    Email
                  </span>
                  <span className="text-sm">{profileData.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">
                    Moodle ID
                  </span>
                  <span>{user.moodleId || "Not available"}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">
                    Member Since
                  </span>
                  <span>
                    {new Date(profileData.joined_date).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                      }
                    )}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Content Creation Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Content Creation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">
                    Quests Created
                  </span>
                  <Badge variant="secondary">
                    {profileData.quests_created}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">
                    Badges Designed
                  </span>
                  <Badge variant="default">{profileData.badges_designed}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">
                    Account Status
                  </span>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {profileData.account_status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>
              Common teaching tasks and management options
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Button asChild variant="outline" className="h-auto p-4">
                <Link href="/teacher/courses">
                  <div className="text-center">
                    <BookOpen className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-sm font-medium">Manage Courses</div>
                  </div>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto p-4">
                <Link href="/teacher/students">
                  <div className="text-center">
                    <Users className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-sm font-medium">View Students</div>
                  </div>
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-auto p-4">
                <Link href="/teacher/dashboard">
                  <div className="text-center">
                    <School className="h-6 w-6 mx-auto mb-2" />
                    <div className="text-sm font-medium">Dashboard</div>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
}
