"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAppToast } from "@/hooks/use-react-hot-toast";
import { apiClient } from "@/lib/api-client";
import { BadgeCreate, Badge as BadgeType } from "@/types/badges";
import {
  Award,
  Trophy,
  Star,
  Flame,
  Users,
  Target,
  Gift,
  Crown,
  Zap,
  BookOpen,
  Heart,
  Clock,
  Upload,
  Plus,
  X,
  AlertCircle,
  Eye,
} from "lucide-react";

interface BadgeCreatorProps {
  onBadgeCreated?: (badge: BadgeType) => void;
  onCancel?: () => void;
}

const BADGE_TYPES = [
  {
    value: "achievement",
    label: "Achievement",
    icon: Award,
    color: "bg-blue-500",
  },
  {
    value: "progression",
    label: "Progression",
    icon: Trophy,
    color: "bg-purple-500",
  },
  { value: "streak", label: "Streak", icon: Flame, color: "bg-red-500" },
  { value: "special", label: "Special", icon: Gift, color: "bg-pink-500" },
  { value: "milestone", label: "Milestone", icon: Star, color: "bg-amber-500" },
  { value: "social", label: "Social", icon: Users, color: "bg-green-500" },
];

const CRITERIA_TYPES = [
  {
    value: "quest_completion",
    label: "Quest Completion",
    description: "Complete a specific number of quests",
    fields: ["target"],
  },
  {
    value: "streak_days",
    label: "Login Streak",
    description: "Login for consecutive days",
    fields: ["target"],
  },
  {
    value: "xp_earned",
    label: "XP Earned",
    description: "Earn a specific amount of XP",
    fields: ["target"],
  },
  {
    value: "grade_average",
    label: "Grade Average",
    description: "Maintain a minimum grade average",
    fields: ["target", "subject"],
  },
  {
    value: "assignment_submission",
    label: "Assignment Submission",
    description: "Submit assignments on time",
    fields: ["target", "course_id"],
  },
  {
    value: "participation",
    label: "Participation",
    description: "Participate in discussions or activities",
    fields: ["target", "activity_type"],
  },
  {
    value: "custom",
    label: "Custom Criteria",
    description: "Define your own custom criteria",
    fields: ["custom_rule"],
  },
];

export function BadgeCreator({ onBadgeCreated, onCancel }: BadgeCreatorProps) {
  const { success, error: showError } = useAppToast();
  const [formData, setFormData] = useState<BadgeCreate>({
    name: "",
    description: "",
    badge_type: "",
    image_url: "",
    criteria: {
      type: "quest_completion",
      target: 1,
      description: "",
    },
    exp_value: 50,
    is_active: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const selectedBadgeType = BADGE_TYPES.find(
    (type) => type.value === formData.badge_type
  );
  const selectedCriteriaType = CRITERIA_TYPES.find(
    (type) => type.value === formData.criteria.type
  );
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Badge name is required";
    } else if (formData.name.length > 100) {
      newErrors.name = "Badge name must be 100 characters or less";
    }

    if (!formData.description?.trim()) {
      newErrors.description = "Badge description is required";
    }
    if (!formData.badge_type) {
      newErrors.badge_type = "Badge type is required";
    }

    // Image URL is optional for now
    // if (!formData.image_url.trim()) {
    //   newErrors.image_url = "Badge image is required";
    // }

    if (!formData.criteria.type) {
      newErrors.criteria_type = "Criteria type is required";
    }

    if (formData.criteria.target < 1) {
      newErrors.criteria_target = "Target must be at least 1";
    }

    if (!formData.criteria.description?.trim()) {
      newErrors.criteria_description = "Criteria description is required";
    }

    if ((formData.exp_value || 0) < 0) {
      newErrors.exp_value = "XP value cannot be negative";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showError("Please fix the errors before submitting");
      return;
    }
    setIsSubmitting(true);
    try {
      // Provide default image_url if empty
      const badgeData = {
        ...formData,
        image_url:
          (formData.image_url || "").trim() || "/badges/default-badge.png",
      };

      const createdBadge = await apiClient.createBadge(badgeData);

      success(`${formData.name} has been created successfully!`);

      onBadgeCreated?.(createdBadge);
    } catch (error) {
      console.error("Failed to create badge:", error);
      showError("Failed to create badge. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBadgeIcon = () => {
    if (!selectedBadgeType) return Award;
    return selectedBadgeType.icon;
  };

  const getBadgePreview = () => {
    const IconComponent = getBadgeIcon();
    return (
      <motion.div
        whileHover={{ scale: 1.05, y: -2 }}
        className={`
          bg-gradient-to-br from-amber-500/20 to-orange-500/20 
          rounded-lg p-3 border border-amber-500/30 relative overflow-hidden w-48
        `}
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity }}
          className={`w-10 h-10 mx-auto mb-2 rounded-full flex items-center justify-center ${
            selectedBadgeType?.color || "bg-gray-500"
          }`}
        >
          <IconComponent className="h-5 w-5 text-white" />
        </motion.div>
        <h4 className="font-medium text-sm text-center">
          {formData.name || "Badge Name"}
        </h4>
        <p className="text-xs text-muted-foreground text-center">
          {formData.description || "Badge description"}
        </p>
        <div className="mt-2 text-center">
          <span className="text-xs font-medium text-amber-600">
            +{formData.exp_value} XP
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Create Custom Badge</h2>
          <p className="text-muted-foreground">
            Design and create custom badges for your students
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? "Edit" : "Preview"}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Badge Details
              </CardTitle>
              <CardDescription>
                Configure the basic information for your custom badge
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!previewMode ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Badge Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="Enter badge name"
                        className={errors.name ? "border-red-500" : ""}
                      />
                      {errors.name && (
                        <p className="text-sm text-red-500">{errors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            description: e.target.value,
                          })
                        }
                        placeholder="Describe what this badge represents"
                        className={errors.description ? "border-red-500" : ""}
                      />
                      {errors.description && (
                        <p className="text-sm text-red-500">
                          {errors.description}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Badge Type */}
                  <div className="space-y-2">
                    <Label>Badge Type *</Label>
                    <Select
                      value={formData.badge_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, badge_type: value })
                      }
                    >
                      <SelectTrigger
                        className={errors.badge_type ? "border-red-500" : ""}
                      >
                        <SelectValue placeholder="Select badge type" />
                      </SelectTrigger>
                      <SelectContent>
                        {BADGE_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-4 h-4 rounded-full ${type.color}`}
                              ></div>
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.badge_type && (
                      <p className="text-sm text-red-500">
                        {errors.badge_type}
                      </p>
                    )}
                  </div>{" "}
                  {/* Image URL */}
                  <div className="space-y-2">
                    <Label htmlFor="image_url">
                      Badge Image URL (Optional)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="image_url"
                        value={formData.image_url}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            image_url: e.target.value,
                          })
                        }
                        placeholder="/badges/custom-badge.png (leave empty for default)"
                        className={errors.image_url ? "border-red-500" : ""}
                      />
                      <Button type="button" variant="outline" size="sm">
                        <Upload className="h-4 w-4" />
                      </Button>
                    </div>
                    {errors.image_url && (
                      <p className="text-sm text-red-500">{errors.image_url}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      You can add an image later. A default icon will be used if
                      left empty.
                    </p>
                  </div>
                  {/* Criteria */}
                  <div className="space-y-4">
                    <Label>Badge Criteria *</Label>

                    <div className="space-y-2">
                      <Label>Criteria Type</Label>{" "}
                      <Select
                        value={formData.criteria.type}
                        onValueChange={(value) =>
                          setFormData({
                            ...formData,
                            criteria: {
                              ...formData.criteria,
                              type: value as any,
                            },
                          })
                        }
                      >
                        <SelectTrigger
                          className={
                            errors.criteria_type ? "border-red-500" : ""
                          }
                        >
                          <SelectValue placeholder="Select criteria type" />
                        </SelectTrigger>
                        <SelectContent>
                          {CRITERIA_TYPES.map((criteria) => (
                            <SelectItem
                              key={criteria.value}
                              value={criteria.value}
                            >
                              <div>
                                <div className="font-medium">
                                  {criteria.label}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {criteria.description}
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.criteria_type && (
                        <p className="text-sm text-red-500">
                          {errors.criteria_type}
                        </p>
                      )}
                    </div>

                    {selectedCriteriaType && (
                      <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                          <div className="text-sm text-blue-700">
                            {selectedCriteriaType.description}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="criteria_target">Target Value</Label>
                          <Input
                            id="criteria_target"
                            type="number"
                            min="1"
                            value={formData.criteria.target}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                criteria: {
                                  ...formData.criteria,
                                  target: parseInt(e.target.value) || 1,
                                },
                              })
                            }
                            className={
                              errors.criteria_target ? "border-red-500" : ""
                            }
                          />
                          {errors.criteria_target && (
                            <p className="text-sm text-red-500">
                              {errors.criteria_target}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="criteria_description">
                            Criteria Description
                          </Label>
                          <Input
                            id="criteria_description"
                            value={formData.criteria.description}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                criteria: {
                                  ...formData.criteria,
                                  description: e.target.value,
                                },
                              })
                            }
                            placeholder="e.g., Complete 5 assignments"
                            className={
                              errors.criteria_description
                                ? "border-red-500"
                                : ""
                            }
                          />
                          {errors.criteria_description && (
                            <p className="text-sm text-red-500">
                              {errors.criteria_description}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* XP Value */}
                  <div className="space-y-2">
                    <Label htmlFor="exp_value">XP Reward</Label>
                    <Input
                      id="exp_value"
                      type="number"
                      min="0"
                      value={formData.exp_value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          exp_value: parseInt(e.target.value) || 0,
                        })
                      }
                      className={errors.exp_value ? "border-red-500" : ""}
                    />
                    {errors.exp_value && (
                      <p className="text-sm text-red-500">{errors.exp_value}</p>
                    )}
                  </div>
                  {/* Submit Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1"
                    >
                      {isSubmitting ? "Creating..." : "Create Badge"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setPreviewMode(true)}
                    >
                      Preview
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Preview mode - switch back to edit the badge
                  </p>
                  <Button onClick={() => setPreviewMode(false)}>
                    Continue Editing
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Badge Preview
              </CardTitle>
              <CardDescription>
                See how your badge will look to students
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">{getBadgePreview()}</div>

              {/* Badge Info Summary */}
              <div className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge variant="secondary">
                    {selectedBadgeType?.label || "Not selected"}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">XP Reward:</span>
                  <span className="font-medium">{formData.exp_value} XP</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criteria:</span>
                  <span className="font-medium text-right">
                    {formData.criteria.description || "Not set"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
