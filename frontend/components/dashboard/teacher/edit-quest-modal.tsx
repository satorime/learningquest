"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2 } from "lucide-react";
import { apiClient, cleanError } from "@/lib/api-client";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";

interface Quest {
  quest_id: number;
  title: string;
  description?: string;
  exp_reward?: number;
  difficulty_level?: number;
  quest_type?: string;
  validation_method?: string;
  is_active?: boolean;
  end_date?: string | null;
}

interface EditQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  quest: Quest | null;
  onSuccess: () => void;
}

const DIFFICULTY_OPTIONS = [
  { value: 1, label: "Easy (20 XP)" },
  { value: 2, label: "Medium (50 XP)" },
  { value: 3, label: "Hard (100 XP)" },
  { value: 4, label: "Epic (150 XP)" },
];

const QUEST_TYPES = [
  { value: "assignment", label: "Assignment" },
  { value: "quiz", label: "Quiz" },
  { value: "project", label: "Project" },
  { value: "challenge", label: "Challenge" },
];

const VALIDATION_METHODS = [
  { value: "manual", label: "Manual" },
  { value: "automatic", label: "Automatic" },
  { value: "peer_review", label: "Peer Review" },
];

export function EditQuestModal({ isOpen, onClose, quest, onSuccess }: EditQuestModalProps) {
  const confirm = useConfirm();
  const notify = useNotify();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    difficulty_level: 2,
    quest_type: "assignment",
    validation_method: "manual",
    is_active: true,
    end_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update form data when quest changes
  useEffect(() => {
    if (quest) {
      setFormData({
        title: quest.title || "",
        description: quest.description || "",
        difficulty_level: quest.difficulty_level || 2,
        quest_type: quest.quest_type || "assignment",
        validation_method: quest.validation_method || "manual",
        is_active: quest.is_active !== false,
        end_date: quest.end_date ? quest.end_date.split('T')[0] : "",
      });
    }
  }, [quest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quest) return;

    const ok = await confirm({
      title: "Save changes?",
      description: `Update "${formData.title || quest.title}"?`,
      confirmText: "Save",
    });
    if (!ok) return;

    setLoading(true);
    setError(null);

    try {
      // Prepare update data
      const updateData: any = {
        title: formData.title,
        description: formData.description,
        difficulty_level: formData.difficulty_level,
        quest_type: formData.quest_type,
        validation_method: formData.validation_method,
        is_active: formData.is_active,
      };

      // Add end_date if provided
      if (formData.end_date) {
        updateData.end_date = new Date(formData.end_date).toISOString();
      }

      // Call the update API
      await apiClient.updateQuest(quest.quest_id, updateData);

      await notify({ variant: "success", description: "Quest updated." });
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Error updating quest:", err);
      setError("Failed to update quest. Please try again.");
      await notify({ variant: "error", description: cleanError(err, "Failed to update the quest.") });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  if (!quest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/50 text-white shadow-2xl backdrop-blur-sm">
        <DialogHeader className="space-y-4 pb-6 border-b border-slate-700/50">
          <DialogTitle className="text-2xl font-bold ">
             Edit Quest
          </DialogTitle>
          <DialogDescription className="text-slate-300 text-base">
            Update the quest details below. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-gradient-to-r from-red-900/30 to-red-800/20 border border-red-500/50 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-sm text-red-200 font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="title" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
              Quest Title
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Enter quest title"
              required
              className=" border-slate-600/50 text-white placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 rounded-lg h-12 transition-all duration-200 hover:border-slate-500"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter quest description"
              rows={3}
              className=" border-slate-600/50 text-white placeholder-slate-400 focus:border-purple-400 focus:ring-2 focus:ring-purple-400/20 resize-none rounded-lg transition-all duration-200 hover:border-slate-500"
            />  
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="difficulty" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                Difficulty Level
              </Label>
              <Select
                value={formData.difficulty_level.toString()}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  difficulty_level: parseInt(value) 
                }))}
              >
                <SelectTrigger className="bg-slate-800/70 border-slate-600/50 text-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 rounded-lg h-12 transition-all duration-200 hover:border-slate-500">
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800/95 border-slate-700/50 backdrop-blur-sm">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value.toString()} className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="quest_type" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 bg-orange-400 rounded-full"></span>
                Quest Type
              </Label>
              <Select
                value={formData.quest_type}
                disabled
                onValueChange={(value) => setFormData(prev => ({ ...prev, quest_type: value }))}
              >
                <SelectTrigger className="bg-slate-800/70 border-slate-600/50 text-white focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 rounded-lg h-12 transition-all duration-200 hover:border-slate-500">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800/95 border-slate-700/50 backdrop-blur-sm">
                  {QUEST_TYPES.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="validation_method" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
              Validation Method
            </Label>
            <Select
              value={formData.validation_method}
              onValueChange={(value) => setFormData(prev => ({ ...prev, validation_method: value }))}
            >
              <SelectTrigger className="bg-slate-800/70 border-slate-600/50 text-white focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 rounded-lg h-12 transition-all duration-200 hover:border-slate-500">
                <SelectValue placeholder="Select validation method" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800/95 border-slate-700/50 backdrop-blur-sm">
                {VALIDATION_METHODS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label htmlFor="end_date" className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <span className="w-2 h-2 bg-pink-400 rounded-full"></span>
              End Date
            </Label>
            <Input
              id="end_date"
              type="date"
              disabled
              value={formData.end_date}
              onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
              className="bg-slate-800/70 border-slate-600/50 text-white focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20 rounded-lg h-12 transition-all duration-200 hover:border-slate-500"
            />
          </div>

          {/* <div className="flex items-center space-x-4 p-5 bg-gradient-to-r from-slate-800/50 to-slate-700/30 rounded-xl border border-slate-600/30 backdrop-blur-sm hover:from-slate-800/70 hover:to-slate-700/50 transition-all duration-200">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
              className="w-5 h-5 text-blue-500 bg-slate-800 border-slate-600 rounded-md focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-0 focus:ring-offset-slate-800"
            />
            <Label htmlFor="is_active" className="text-sm font-medium text-slate-200 cursor-pointer flex items-center gap-2">
              <span className="text-green-400">●</span>
              Quest is active
            </Label>
          </div> */}

          <DialogFooter className="gap-4 pt-4 border-t border-slate-700/50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              className="bg-slate-800/50 border-slate-600/50 text-slate-200 hover:bg-slate-700/50 hover:border-slate-500/50 hover:text-white rounded-lg h-12 px-6 transition-all duration-200"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0 rounded-lg h-12 px-8 font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
