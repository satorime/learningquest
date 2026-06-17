import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Mail, MapPin, Trophy, Star, Calendar } from "lucide-react";

interface User {
  id: number;
  username: string;
  email: string;
  name?: string;
  role: string;
  avatarUrl?: string;
  level?: number;
  exp?: number;
  joinedAt?: string;
}

interface ProfileContentProps {
  user: User;
}

export function ProfileContent({ user }: ProfileContentProps) {
  // Get initials for avatar fallback
  const getInitials = () => {
    if (!user.name) return user.username.substring(0, 2).toUpperCase();
    return user.name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      teacher: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      student: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      default: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    };
    
    return colors[role] || colors.default;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="grid gap-6 md:grid-cols-7">
        <div className="md:col-span-2">
          <Card>
            <CardHeader className="text-center">
              <Avatar className="h-24 w-24 mx-auto">
                <AvatarImage src={user.avatarUrl} alt={user.name || user.username} />
                <AvatarFallback>{getInitials()}</AvatarFallback>
              </Avatar>
              <CardTitle className="mt-4">{user.name || user.username}</CardTitle>
              <CardDescription>@{user.username}</CardDescription>
              <Badge variant="secondary" className={`mt-2 ${getRoleBadgeColor(user.role)}`}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 opacity-70" />
                  <span className="text-sm">{user.email}</span>
                </div>
                
                {user.joinedAt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 opacity-70" />
                    <span className="text-sm">Joined {new Date(user.joinedAt).toLocaleDateString()}</span>
                  </div>
                )}
                
                {user.level && (
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 opacity-70" />
                    <span className="text-sm">Level {user.level}</span>
                  </div>
                )}
                
                {user.exp && (
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 opacity-70" />
                    <span className="text-sm">{user.exp.toLocaleString()} XP</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-5">
          <Tabs defaultValue="courses">
            <TabsList className="mb-4">
              <TabsTrigger value="courses">
                <BookOpen className="h-4 w-4 mr-2" />
                Classes
              </TabsTrigger>
              <TabsTrigger value="achievements">
                <Trophy className="h-4 w-4 mr-2" />
                Achievements
              </TabsTrigger>
              <TabsTrigger value="stats">
                <Star className="h-4 w-4 mr-2" />
                Stats
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="courses" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Classes</CardTitle>
                  <CardDescription>Your enrolled classes live on your dashboard.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button asChild variant="outline">
                    <Link href="/dashboard/classes">Go to my classes</Link>
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="achievements">
              <Card>
                <CardHeader>
                  <CardTitle>Achievements</CardTitle>
                  <CardDescription>Track your progress and accomplishments</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No achievements earned yet.</p>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="stats">
              <Card>
                <CardHeader>
                  <CardTitle>Stats</CardTitle>
                  <CardDescription>Your activity statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">No stats available yet.</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
} 