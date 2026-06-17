"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  fetchUserProfileFromBackend,
  updateUserProfileOnBackend,
  requestEmailChange,
  confirmEmailChange,
} from "@/lib/profile-service";
import { isApiError } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";
import { motion } from "framer-motion";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

export default function ProfileEditPage() {
  const { user, updateUser } = useAuth();
  const confirm = useConfirm();
  const notify = useNotify();
  const success = (msg: string) => notify({ variant: "success", description: msg });
  const showError = (msg: string) => notify({ variant: "error", description: msg });
  const info = (msg: string) => notify({ variant: "info", description: msg });
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    bio: "",
    email: "",
    profileImage: "",
    socialMedia: {
      twitter: "",
      github: "",
    },
    preferences: {
      emailNotifications: true,
      darkMode: true,
    },
  });

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        setLoading(true);
        const data = await fetchUserProfileFromBackend(user);

        if (data) {
          setProfileData(data);
          // Initialize form with existing data
          setFormData({
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            bio: data.bio ? data.bio.replace(/<[^>]*>/g, "") : "", // Filter out HTML tags
            email: data.email || user.email || "",
            profileImage: data.profile_image_url || "",
            socialMedia: {
              twitter: "", // Social media not available in ProfileData
              github: "",
            },
            preferences: {
              emailNotifications: true, // Preferences not available in ProfileData, use defaults
              darkMode: true,
            },
          });
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        showError("Failed to load profile data");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // Handle nested objects
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as object),
          [child]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    if (!user) return;

    const ok = await confirm({
      title: "Save changes?",
      description: "Update your profile with these details?",
      confirmText: "Save",
    });
    if (!ok) return;

    try {
      setSaving(true);

      const updated = await updateUserProfileOnBackend(user, {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        bio: formData.bio,
      });

      // Reflect the change across the app (header, profile page) + persist it.
      const fullName =
        `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim() ||
        user.username;
      updateUser({ name: fullName });
      if (updated) setProfileData(updated);

      success("Profile updated successfully");
      router.push("/dashboard/profile");
    } catch (error) {
      console.error("Failed to save profile:", error);
      if (isApiError(error, 403)) {
        showError("You can only edit your own profile");
      } else {
        showError("Failed to save changes");
      }
    } finally {
      setSaving(false);
    }
  };

  // --- Verified email change -------------------------------------------------
  // Email isn't editable inline; changing it requires confirming a code sent to
  // the new address.
  const [emailMode, setEmailMode] = useState<"view" | "editing" | "code-sent">(
    "view"
  );
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);

  const cancelEmailChange = () => {
    setEmailMode("view");
    setNewEmail("");
    setEmailCode("");
  };

  const handleSendEmailCode = async () => {
    if (!user) return;
    const target = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      showError("Please enter a valid email address");
      return;
    }
    try {
      setEmailBusy(true);
      const res = await requestEmailChange(user, target);
      info(res.message || `A verification code was sent to ${target}`);
      setEmailMode("code-sent");
    } catch (error) {
      if (isApiError(error, 409)) {
        showError("That email is already in use by another account");
      } else if (isApiError(error, 400)) {
        showError("That email can't be used. Try a different address.");
      } else {
        showError("Failed to send verification code");
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const handleConfirmEmailCode = async () => {
    if (!user) return;
    if (!emailCode.trim()) {
      showError("Enter the code from your email");
      return;
    }
    try {
      setEmailBusy(true);
      const updated = await confirmEmailChange(user, emailCode.trim());
      const confirmedEmail = updated?.email || newEmail.trim();
      setFormData((prev) => ({ ...prev, email: confirmedEmail }));
      if (updated) setProfileData(updated);
      updateUser({ email: confirmedEmail });
      success("Email updated successfully");
      cancelEmailChange();
    } catch (error) {
      if (isApiError(error, 409)) {
        showError("That email is already in use by another account");
      } else if (isApiError(error, 400)) {
        showError("Incorrect or expired code. Try again.");
      } else {
        showError("Failed to verify code");
      }
    } finally {
      setEmailBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
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

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container max-w-3xl mx-auto py-8 px-4"
    >
      <motion.div variants={itemVariants} className="mb-6">
        <Link href="/dashboard/profile">
          <Button variant="ghost" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        </Link>
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card>
          <CardHeader>
            <CardTitle>Edit Your Profile</CardTitle>
            <CardDescription>
              Update your personal information and preferences
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Profile Image */}
            <div className="flex flex-col items-center">
              <Avatar className="h-24 w-24">
                {formData.profileImage ? (
                  <AvatarImage
                    src={formData.profileImage}
                    alt={user?.name || ""}
                  />
                ) : null}
                <AvatarFallback>
                  {formData.firstName?.[0] || user?.name?.[0] || "U"}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-medium">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Enter your last name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>

                {emailMode === "view" && (
                  <div className="flex items-center gap-2">
                    <Input
                      id="email"
                      value={formData.email}
                      disabled
                      readOnly
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewEmail("");
                        setEmailMode("editing");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                )}

                {emailMode === "editing" && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label htmlFor="newEmail" className="text-sm">
                      New email address
                    </Label>
                    <Input
                      id="newEmail"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      We&apos;ll send a verification code to this address. Your
                      email won&apos;t change until you confirm it.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={handleSendEmailCode}
                        disabled={emailBusy}
                      >
                        {emailBusy ? "Sending…" : "Send code"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={cancelEmailChange}
                        disabled={emailBusy}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {emailMode === "code-sent" && (
                  <div className="space-y-2 rounded-md border p-3">
                    <Label htmlFor="emailCode" className="text-sm">
                      Enter the code sent to{" "}
                      <span className="font-medium">{newEmail}</span>
                    </Label>
                    <Input
                      id="emailCode"
                      inputMode="numeric"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      placeholder="6-digit code"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={handleConfirmEmailCode}
                        disabled={emailBusy}
                      >
                        {emailBusy ? "Verifying…" : "Verify & update"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handleSendEmailCode}
                        disabled={emailBusy}
                      >
                        Resend code
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={cancelEmailChange}
                        disabled={emailBusy}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Write a short bio about yourself"
                  rows={4}
                />
              </div>
            </div>

            {/* Social Media */}
            {/* <div className="space-y-4">
              <h3 className="font-medium">Social Media</h3>

              <div className="space-y-2">
                <Label htmlFor="socialMedia.twitter">Twitter</Label>
                <Input
                  id="socialMedia.twitter"
                  name="socialMedia.twitter"
                  value={formData.socialMedia.twitter}
                  onChange={handleChange}
                  placeholder="Your Twitter username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="socialMedia.github">GitHub</Label>
                <Input
                  id="socialMedia.github"
                  name="socialMedia.github"
                  value={formData.socialMedia.github}
                  onChange={handleChange}
                  placeholder="Your GitHub username"
                />
              </div>
            </div> */}

            {/* Non-editable information */}
            <div className="space-y-4">
              <h3 className="font-medium">Account Information</h3>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={user?.username || ""}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Username cannot be changed
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={user?.role || "Student"}
                  disabled
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Role is assigned by your teacher or administrator
                </p>
              </div>

            </div>
          </CardContent>

          <CardFooter className="flex justify-end">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push("/dashboard/profile")}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <div className="w-4 h-4 border-t-2 border-b-2 border-current rounded-full animate-spin"></div>
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  );
}
