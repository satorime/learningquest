"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Edit, 
  Trash2, 
  Eye, 
  Loader2, 
  Calendar,
  Trophy,
  Target
} from "lucide-react";
import { apiClient, cleanError } from "@/lib/api-client";
import { formatDistanceToNow } from "date-fns";
import { EditQuestModal } from "./edit-quest-modal";
import { DeleteQuestDialog } from "./delete-quest-dialog";
import { useRouter } from "next/navigation";
import { useNotify } from "@/components/ui/notify-dialog";

interface Quest {
  quest_id: number;
  title: string;
  description?: string;
  exp_reward?: number;
  difficulty_level?: number;
  quest_type?: string;
  validation_method?: string;
  is_active: boolean;
  end_date: string | null;
  created_at: string | null;
  course_id?: number;
}

interface QuestListResponse {
  success: boolean;
  data: Quest[];
}

const DIFFICULTY_NAMES = {
  1: "Easy",
  2: "Medium", 
  3: "Hard",
  4: "Epic"
};

const DIFFICULTY_COLORS = {
  1: "bg-green-100 text-green-800",
  2: "bg-yellow-100 text-yellow-800", 
  3: "bg-orange-100 text-orange-800",
  4: "bg-purple-100 text-purple-800"
};

export function QuestManager() {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();
  const notify = useNotify();

  // Debug logging
  console.log("QuestManager render:", { editModalOpen, deleteDialogOpen, selectedQuest });

  const fetchQuests = async () => {
    setLoading(true);
    setError(null);
    try {
      // Determine creator (local user) id from stored session
      let creatorIdParam = "";
      try {
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem("learningquest_user");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.id) {
              creatorIdParam = `?creator_id=${encodeURIComponent(parsed.id)}`;
            }
          }
        }
      } catch {}

      const response = await apiClient.request<QuestListResponse>(
        `/quests/my-quests${creatorIdParam}`,
        "GET"
      );
      
      if (response.success) {
        const list = (response.data || []).filter(q => q.is_active);
        setQuests(list);
      } else {
        setError("Failed to fetch quests");
      }
    } catch (err) {
      console.error("Error fetching quests:", err);
      setError("Error loading quests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuests();
  }, []);

  const handleEditQuest = (quest: Quest) => {
    console.log("Edit quest clicked:", quest);
    setSelectedQuest(quest);
    setEditModalOpen(true);
  };

  const handleDeleteQuest = (quest: Quest) => {
    console.log("Delete quest clicked:", quest);
    setSelectedQuest(quest);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedQuest) return;
    
    setDeleteLoading(true);
    try {
      await apiClient.deleteQuest(selectedQuest.quest_id);
      await fetchQuests(); // Refresh the list
      setDeleteDialogOpen(false);
      setSelectedQuest(null);
      await notify({ variant: "success", description: "Quest deleted." });
    } catch (err) {
      console.error("Error deleting quest:", err);
      await notify({ variant: "error", description: cleanError(err, "Failed to delete the quest.") });
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleViewQuest = (questId: number) => {
    console.log("View quest:", questId);
    // TODO: Implement view details functionality
  };

  const handleEditSuccess = () => {
    fetchQuests(); // Refresh the list after successful edit
  };

  const handleViewAnalytics = (questId: number) => {
    router.push(`/teacher/quests/${questId}/analytics`);
  };

  const closeModals = () => {
    setEditModalOpen(false);
    setDeleteDialogOpen(false);
    setSelectedQuest(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading quests...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-red-600">
            <p>{error}</p>
            <Button 
              onClick={fetchQuests} 
              variant="outline" 
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (quests.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No Quests Found</h3>
            <p>You haven't created any quests yet. Start by assigning gamification values to your Moodle activities.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Modal removed; navigation used instead */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Your Quests</h3>
          <p className="text-sm text-muted-foreground">
            {quests.length} quest{quests.length !== 1 ? 's' : ''} created
          </p>
        </div>
        <Button onClick={fetchQuests} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quests.map((quest) => (
          <Card key={quest.quest_id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base truncate">
                    {quest.title}
                  </CardTitle>
                  <CardDescription className="text-sm mt-1">
                    Quest #{quest.quest_id}
                  </CardDescription>
                </div>
                <Badge 
                  variant={quest.is_active ? "default" : "secondary"}
                  className="ml-2 shrink-0"
                >
                  {quest.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              {quest.description && (
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {quest.description}
                </p>
              )}
              
              <div className="flex flex-wrap gap-2">
                {quest.difficulty_level && (
                  <Badge 
                    variant="outline" 
                    className={DIFFICULTY_COLORS[quest.difficulty_level as keyof typeof DIFFICULTY_COLORS]}
                  >
                    {DIFFICULTY_NAMES[quest.difficulty_level as keyof typeof DIFFICULTY_NAMES]}
                  </Badge>
                )}
                
                {quest.exp_reward && (
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    <Trophy className="h-3 w-3 mr-1" />
                    {quest.exp_reward} XP
                  </Badge>
                )}
                
                {quest.quest_type && (
                  <Badge variant="outline">
                    {quest.quest_type}
                  </Badge>
                )}
              </div>
              
              <div className="text-xs text-muted-foreground space-y-1">
                {quest.created_at && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created {formatDistanceToNow(new Date(quest.created_at), { addSuffix: true })}
                  </div>
                )}
                
                {quest.end_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Due {formatDistanceToNow(new Date(quest.end_date), { addSuffix: true })}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 pt-2">
                {/* <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewQuest(quest.quest_id)}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button> */}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEditQuest(quest)}
                  className="flex-1"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleViewAnalytics(quest.quest_id)}
                  className="flex-1"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  View
                </Button>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDeleteQuest(quest)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Debug info */}
      {(editModalOpen || deleteDialogOpen) && (
        <div className="fixed top-4 right-4 bg-yellow-100 border border-yellow-400 rounded p-2 z-50">
          <p>Modal Debug: Edit={editModalOpen.toString()}, Delete={deleteDialogOpen.toString()}</p>
          <p>Selected Quest: {selectedQuest?.title || 'None'}</p>
        </div>
      )}

      {/* Simple test modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Edit Quest Test</h2>
            <p>Quest: {selectedQuest?.title}</p>
            <p>ID: {selectedQuest?.quest_id}</p>
            <div className="mt-4 flex gap-2">
              <button 
                onClick={closeModals}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quest Modal */}
      <EditQuestModal
        isOpen={editModalOpen}
        onClose={closeModals}
        quest={selectedQuest}
        onSuccess={handleEditSuccess}
      />

      {/* Simple test delete dialog */}
      {deleteDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold mb-4">Delete Quest Test</h2>
            <p>Are you sure you want to delete: {selectedQuest?.title}?</p>
            <div className="mt-4 flex gap-2">
              <button 
                onClick={closeModals}
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button 
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Quest Dialog */}
      <DeleteQuestDialog
        isOpen={deleteDialogOpen}
        onClose={closeModals}
        quest={selectedQuest}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading}
      />
    </div>
  );
}

