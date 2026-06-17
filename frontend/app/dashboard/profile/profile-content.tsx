"use client";

import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import {
  BookOpen,
  Trophy,
  Star,
  Award,
  Clock,
  Edit,
  User,
  Mail,
  Calendar,
  GraduationCap,
  MapPin,
  Briefcase,
} from "lucide-react";
import { fetchUserProfileFromBackend } from "@/lib/profile-service";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";

// Define types for our profile data
interface Badge {
  id: number | string;
  name: string;
  icon: string;
  color: string;
  locked?: boolean;
}

interface Certificate {
  id: number | string;
  title: string;
  score: number;
  date: string;
}

interface ProfileStats {
  finished_skills: number;
  watched_workflows: number;
  viewed_time: string;
  courses_completed: number;
  quests_completed: number;
  exp_points: number;
}

interface RankingInfo {
  position: number;
  total_students: number;
}

interface ProfileData {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  profile_image_url?: string;
  role?: string;
  level?: number;
  learning_score?: number;
  joined_date?: string;
  school?: string;
  department?: string;
  bio?: string;
  badges_collected: Badge[];
  stats?: ProfileStats;
  certificates: Certificate[];
  ranking?: RankingInfo;
}

export function ProfileContent() {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const data = await fetchUserProfileFromBackend(user);
      if (data) {
        // Adapt the backend payload to this component's ProfileData shape.
        setProfileData(data as unknown as ProfileData);
      } else {
        setError("Could not load profile data");
      }
    } catch (e) {
      console.error("Error fetching profile data:", e);
      setError(e instanceof Error ? e.message : "Failed to load profile data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  // If there was an error, show an error message with retry button
  if (error && !loading) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle className="ml-2">Error loading profile</AlertTitle>
          <AlertDescription className="ml-2">{error}</AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={fetchProfile}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </Alert>
      </div>
    );
  }

  // Show skeleton loading state
  if (loading || !profileData) {
    return (
      <div className="container max-w-3xl mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-16">
            <div className="flex justify-center items-center">
              <div className="w-8 h-8 border-t-2 border-b-2 border-primary rounded-full animate-spin"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate level progress
  const currentLevelExp = profileData.stats?.exp_points
    ? Math.floor(profileData.stats.exp_points / 1000) * 1000
    : 0;
  const nextLevelExp = currentLevelExp + 1000;
  const progressToNextLevel = profileData.stats?.exp_points
    ? ((profileData.stats.exp_points - currentLevelExp) /
        (nextLevelExp - currentLevelExp)) *
      100
    : 0;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container max-w-3xl mx-auto py-8 px-4"
    >
      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>
                  View your personal information and progress
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/profile/edit">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Link>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Profile Image and Basic Info */}
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-24 w-24 mb-4">
                <AvatarImage src={profileData.profile_image_url} />
                <AvatarFallback className="text-2xl">
                  {profileData.first_name?.[0] || ""}
                  {profileData.last_name?.[0] || ""}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold">
                {profileData.first_name} {profileData.last_name}
              </h2>
              <p className="text-muted-foreground">@{profileData.username}</p>
              <Badge variant="secondary" className="mt-2 capitalize">
                {profileData.role || "student"}
              </Badge>
            </div>

            {/* Bio Section */}
            <div className="space-y-2">
              <h3 className="font-medium text-lg">About</h3>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm leading-relaxed">
                  {(() => {
                    const bioText = profileData.bio
                      ?.replace(/<[^>]*>/g, "")
                      .trim();
                    return bioText && bioText.length > 0
                      ? bioText
                      : "No bio available. Add one in your profile settings.";
                  })()}
                </p>
              </div>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-medium text-lg">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Name</div>
                    <div className="font-medium">
                      {profileData.first_name} {profileData.last_name}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Email</div>
                    <div className="font-medium">
                      {profileData.email || "Not provided"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Trophy className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Badges Earned
                    </div>
                    <div className="font-medium">
                      {profileData.learning_score || 0} badges
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Award className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Quests Completed
                    </div>
                    <div className="font-medium">
                      {profileData.stats?.quests_completed || 0} quests
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Joined</div>
                    <div className="font-medium">
                      {profileData.joined_date || "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <GraduationCap className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-sm text-muted-foreground">Level</div>
                    <div className="font-medium">
                      Level {profileData.level || 1}
                    </div>
                  </div>
                </div>
              </div>
            </div>

           
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
