"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useNotify } from "@/components/ui/notify-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import type {
  VirtualPet as VirtualPetType,
  PetAccessory,
  AvailableAccessory,
} from "@/types/gamification";
import { Heart, Zap, Clock, Plus, Lock, Edit2, Check, X } from "lucide-react";
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getMyPet,
  syncPetLevel,
  getAvailableAccessories,
  equipAccessory,
  getEquippedAccessories,
  feedPet,
  playWithPet,
  VirtualPetData,
  updatePetName,
} from "@/lib/virtual-pet-api";

// Stat-decay rates. These MUST match the backend (HAPPINESS_DECAY_PER_HOUR /
// ENERGY_DECAY_PER_HOUR in routes/virtual_pet.py) so the live display stays in
// sync with what the server persists across logout/login.
const HAPPINESS_DECAY_PER_HOUR = 5;
const ENERGY_DECAY_PER_HOUR = 3;

// Mock pet data
const mockPet: VirtualPetType = {
  id: "pet1",
  name: "Derrick",
  species: "Owl",
  level: 20, // Now synchronized with user level
  experience: 0, // No longer used for pet leveling
  experienceToNextLevel: 0, // No longer used for pet leveling
  happiness: 10,
  energy: 10,
  lastFed: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
  lastPlayed: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
  accessories: [], // No accessories initially since level is too low
  iconUrl: "/animations/Chilling.gif",
};

export function VirtualPet() {
  const confirm = useConfirm();
  const notify = useNotify();
  const success = useCallback(
    (msg: string) => notify({ variant: "success", description: msg }),
    [notify]
  );
  const showError = useCallback(
    (msg: string) => notify({ variant: "error", description: msg }),
    [notify]
  );

  // State for loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pet, setPet] = useState<VirtualPetType | null>(null);
  const [availableAccessories, setAvailableAccessories] = useState<
    AvailableAccessory[]
  >([]);
  const [equippedAccessories, setEquippedAccessories] = useState<any[]>([]);
  const [userLevel, setUserLevel] = useState<number>(1);
  const [food, setFood] = useState<number>(0);

  const [activeTab, setActiveTab] = useState("interact");
  const [showAccessories, setShowAccessories] = useState(false);
  const [petState, setPetState] = useState<
    "idle" | "chilling" | "eating" | "playing" | "dancing" | "crying" | "dead"
  >("chilling");
  const [isFeeding, setIsFeeding] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isUpdatingName, setIsUpdatingName] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const userActivityTimeout = useRef<NodeJS.Timeout | null>(null);
  const feedingTimeout = useRef<NodeJS.Timeout | null>(null);
  const playingTimeout = useRef<NodeJS.Timeout | null>(null);

  // Helper function to convert backend pet data to frontend format
  const convertBackendPetToFrontend = (
    backendPet: VirtualPetData
  ): VirtualPetType => {
    return {
      id: backendPet.pet_id.toString(),
      name: backendPet.name,
      species: backendPet.species,
      level: backendPet.level || 1, // Use synchronized level from backend
      experience: backendPet.exp_into_level ?? 0, // XP earned within the current level
      experienceToNextLevel: backendPet.exp_for_next_level ?? 0, // XP needed to reach the next level
      happiness: backendPet.happiness,
      energy: backendPet.energy,
      lastFed: backendPet.last_fed,
      lastPlayed: backendPet.last_played,
      accessories: backendPet.accessories || [], // Use backend accessories or empty array
      iconUrl: "/animations/Chilling.gif", // Default animation
    };
  };

  // Fetch pet data and available accessories
  useEffect(() => {
    const fetchPetData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // console.log("VirtualPet: Fetching pet data from API...");
        const [petResponse, accessoriesResponse, equippedResponse] =
          await Promise.all([
            getMyPet(),
            getAvailableAccessories(),
            getEquippedAccessories(),
          ]);

        // console.log("VirtualPet: API responses:", {
        //   petResponse,
        //   accessoriesResponse,
        //   equippedResponse,
        // });

        if (petResponse.success && petResponse.has_pet && petResponse.pet) {
          // Convert backend pet data to frontend format
          const frontendPet = convertBackendPetToFrontend(petResponse.pet);
          setPet(frontendPet);
          setNewPetName(frontendPet.name);
          setFood(petResponse.pet.food ?? 0);
          // console.log("VirtualPet: Successfully loaded pet:", frontendPet);
        } else if (petResponse.success && !petResponse.has_pet) {
          // User doesn't have a pet - this component shouldn't be shown
          // console.log("VirtualPet: No pet found for user");
          setError("No pet found. Please create a pet first.");
        } else {
          console.error(
            "VirtualPet: Failed to fetch pet:",
            petResponse.message
          );
          setError(petResponse.message || "Failed to load pet data");
        }

        // Set available accessories and user level
        if (accessoriesResponse.success) {
          // Sort by level_required ascending to match backend order (kitten first)
          const sortedAccessories = [...accessoriesResponse.available_accessories].sort((a, b) => a.level_required - b.level_required);
          setAvailableAccessories(sortedAccessories);
          setUserLevel(accessoriesResponse.user_level);
        }

        // Set equipped accessories
        if (equippedResponse.success) {
          setEquippedAccessories(equippedResponse.equipped_accessories);
        }
      } catch (err) {
        console.error("VirtualPet: Error fetching pet:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load pet data"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchPetData();
  }, []);

  // Refresh food when another part of the app reports it changed (e.g. a daily
  // quest or quiz just granted food).
  useEffect(() => {
    const onFoodChanged = async () => {
      try {
        const res = await getMyPet();
        if (res.success && res.pet) setFood(res.pet.food ?? 0);
      } catch {
        /* best-effort */
      }
    };
    window.addEventListener("pet:food-changed", onFoodChanged);
    return () => window.removeEventListener("pet:food-changed", onFoodChanged);
  }, []);

  // Sync pet level periodically
  useEffect(() => {
    const syncLevel = async () => {
      if (!pet) return;

      try {
        const syncResponse = await syncPetLevel();
        if (syncResponse.success) {
          // console.log("Pet level synced:", syncResponse);

          // Update pet level if it changed
          if (syncResponse.new_level !== pet.level) {
            setPet((prevPet) => {
              if (!prevPet) return prevPet;
              return {
                ...prevPet,
                level: syncResponse.new_level,
              };
            });
          }

          // Celebrate level ups with a center-screen popup (see LevelUpListener).
          if (syncResponse.level_ups > 0) {
            try {
              window.dispatchEvent(
                new CustomEvent("level:up", {
                  detail: {
                    level: syncResponse.new_level,
                    levelsGained: syncResponse.level_ups,
                  },
                })
              );
            } catch {
              /* ignore */
            }
          }

          // Show notification for new accessories
          if (syncResponse.unlocked_accessories.length > 0) {
            success(
              `🎁 You unlocked ${syncResponse.unlocked_accessories.length} new accessories!`
            );
          }
        }
      } catch (error) {
        console.error("Error syncing pet level:", error);
      }
    };

    // Sync level every 5 minutes
    const interval = setInterval(syncLevel, 5 * 60 * 1000);

    // Also sync on component mount
    syncLevel();

    return () => clearInterval(interval);
  }, [pet, success]);

  // Calculate time since last interaction
  const getTimeSince = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHrs < 1) {
      return "Less than an hour ago";
    } else if (diffHrs === 1) {
      return "1 hour ago";
    } else {
      return `${diffHrs} hours ago`;
    }
  };

  // Handle Feed Pet button click
  const handleFeedClick = async () => {
    if (!pet || pet.energy >= 100 || isFeeding) return; // Don't feed if energy is full or no pet
    if (food <= 0) {
      showError("No food — earn some by completing quizzes and daily quests.");
      return;
    }

    setIsFeeding(true);
    const previousState = petState;

    // Persist to the backend and adopt the authoritative stats it returns.
    try {
      const res = await feedPet();
      if (res.success && res.pet_stats) {
        setPet((prevPet) =>
          prevPet
            ? {
                ...prevPet,
                energy: res.pet_stats!.energy,
                happiness: res.pet_stats!.happiness,
                lastFed: new Date().toISOString(),
              }
            : prevPet
        );
        if (typeof res.pet_stats.food === "number") setFood(res.pet_stats.food);
      } else if (!res.success) {
        showError(res.message || "Failed to feed pet");
      }
    } catch {
      showError("Failed to feed pet");
    }

    // Clear any existing timeout
    if (feedingTimeout.current) {
      clearTimeout(feedingTimeout.current);
    }

    // Reset after animation duration
    feedingTimeout.current = setTimeout(() => {
      setIsFeeding(false);
      setPetState(previousState);
      updatePetState();
    }, 3000);
  };

  // Handle Play button click
  const handlePlayClick = async () => {
    if (!pet || pet.energy <= 0 || isPlaying) return; // Don't play if no energy or no pet

    setIsPlaying(true);
    const previousState = petState;

    // Persist to the backend and adopt the authoritative stats it returns.
    try {
      const res = await playWithPet();
      if (res.success && res.pet_stats) {
        setPet((prevPet) =>
          prevPet
            ? {
                ...prevPet,
                happiness: res.pet_stats!.happiness,
                energy: res.pet_stats!.energy,
                lastPlayed: new Date().toISOString(),
              }
            : prevPet
        );
      } else if (!res.success) {
        showError(res.message || "Failed to play with pet");
      }
    } catch {
      showError("Failed to play with pet");
    }

    // Clear any existing timeout
    if (playingTimeout.current) {
      clearTimeout(playingTimeout.current);
    }

    // Reset after animation duration
    playingTimeout.current = setTimeout(() => {
      setIsPlaying(false);
      setPetState(previousState);
      updatePetState();
    }, 3000);
  };

  // Handle saving the pet name
  const handleSaveName = async () => {
    if (!pet) return;

    if (!newPetName.trim()) {
      // If empty, revert to current name
      setNewPetName(pet.name);
      setIsEditingName(false);
      return;
    }

    // Don't update if name hasn't changed
    if (newPetName.trim() === pet.name) {
      setIsEditingName(false);
      return;
    }

    const ok = await confirm({
      title: "Rename your pet?",
      description: `Change your pet's name to "${newPetName.trim()}"?`,
      confirmText: "Rename",
    });
    if (!ok) return;

    try {
      setIsUpdatingName(true);
      console.log("Updating pet name from", pet.name, "to", newPetName.trim());

      const response = await updatePetName(newPetName.trim());

      if (response.success && response.pet) {
        // Update the pet state with the new name from the API response
        setPet((prevPet) => {
          if (!prevPet) return prevPet;
          return {
            ...prevPet,
            name: response.pet!.name, // Use the name from the API response
          };
        });

        console.log("Pet name updated successfully to:", response.pet.name);
        success(`Pet name updated to "${response.pet.name}"`);
        setIsEditingName(false);
      } else {
        console.error("Failed to update pet name:", response.message);
        // Revert to original name on failure
        setNewPetName(pet.name);
        showError(`Failed to update pet name: ${response.message}`);
      }
    } catch (error) {
      console.error("Error updating pet name:", error);
      // Revert to original name on error
      setNewPetName(pet.name);
      showError("Failed to update pet name. Please try again.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleEquipAccessory = async (
    accessory: AvailableAccessory,
    equip: boolean
  ) => {
    if (!pet) return;

    try {
      console.log(`Equipping accessory: ${accessory.name}, equip: ${equip}`);

      const response = await equipAccessory(accessory.accessory_id, equip);

      if (response.success) {
        // Update pet stats if provided
        if (response.pet_stats) {
          setPet((prevPet) => {
            if (!prevPet) return prevPet;
            return {
              ...prevPet,
              happiness: response.pet_stats!.happiness,
              energy: response.pet_stats!.energy,
            };
          });
        }

        // Refresh equipped accessories
        const equippedResponse = await getEquippedAccessories();
        if (equippedResponse.success) {
          setEquippedAccessories(equippedResponse.equipped_accessories);
        }

        success(response.message);
        console.log("Accessory equipped successfully:", response);
      } else {
        showError(response.message);
        console.error("Failed to equip accessory:", response.message);
      }
    } catch (error) {
      console.error("Error equipping accessory:", error);
      showError("Failed to equip accessory");
    }
  };

  // Determine the appropriate pet state based on current conditions
  const updatePetState = () => {
    if (!pet) return;

    if (pet.energy <= 0) {
      setPetState("dead");
    } else if (pet.happiness <= 10) {
      setPetState("crying");
    } else if (pet.happiness >= 100) {
      setPetState("dancing");
    } else if (pet.energy >= 100) {
      setPetState("dancing");
    } else {
      // Default to chilling when active, idle when inactive
      setPetState("chilling");
    }
  };

  // Helper to calculate levels needed to unlock an accessory
  const getLevelsNeeded = (accessory: PetAccessory) => {
    if (!pet) return accessory.levelRequired;
    return Math.max(0, accessory.levelRequired - pet.level);
  };

  // Helper to check if accessory is unlocked based on user level
  const isAccessoryUnlocked = (accessory: AvailableAccessory) => {
    return userLevel >= accessory.level_required;
  };

  // Set up user activity tracking
  useEffect(() => {
    const resetUserActivity = () => {
      // User is active
      setPetState((prevState) => {
        // Only change to chilling if not in a special state
        if (["idle", "chilling"].includes(prevState)) {
          return "chilling";
        }
        return prevState;
      });

      // Clear existing timeout
      if (userActivityTimeout.current) {
        clearTimeout(userActivityTimeout.current);
      }

      // Set up new timeout to mark as idle after inactivity
      userActivityTimeout.current = setTimeout(() => {
        setPetState((prevState) => {
          // Only change to idle if currently chilling
          if (prevState === "chilling") {
            return "idle";
          }
          return prevState;
        });
      }, 10000); // 30 seconds of inactivity
    };

    // Add event listeners for user activity
    window.addEventListener("mousemove", resetUserActivity);
    window.addEventListener("keydown", resetUserActivity);
    window.addEventListener("click", resetUserActivity);
    window.addEventListener("touchstart", resetUserActivity);

    // Initial call to set up timeout
    resetUserActivity();

    return () => {
      // Clean up event listeners
      window.removeEventListener("mousemove", resetUserActivity);
      window.removeEventListener("keydown", resetUserActivity);
      window.removeEventListener("click", resetUserActivity);
      window.removeEventListener("touchstart", resetUserActivity);

      // Clear timeout
      if (userActivityTimeout.current) {
        clearTimeout(userActivityTimeout.current);
      }
    };
  }, []);

  // Update pet state whenever pet stats change
  useEffect(() => {
    if (pet) {
      updatePetState();
    }
  }, [pet?.happiness, pet?.energy]);

  // Simulate pet stats decreasing over time, at the same hourly rate the
  // backend uses. The server is authoritative (it recomputes decay from the
  // stored timestamp on next load); this just keeps the live view moving.
  useEffect(() => {
    const interval = setInterval(() => {
      setPet((prevPet) => {
        if (!prevPet) return prevPet;
        return {
          ...prevPet,
          happiness: Math.max(0, prevPet.happiness - HAPPINESS_DECAY_PER_HOUR / 60),
          energy: Math.max(0, prevPet.energy - ENERGY_DECAY_PER_HOUR / 60),
        };
      });
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Clean up timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (feedingTimeout.current) clearTimeout(feedingTimeout.current);
      if (playingTimeout.current) clearTimeout(playingTimeout.current);
    };
  }, []);

  // Get the appropriate animation source based on current state
  const getPetAnimationSrc = () => {
    if (isFeeding) return "/animations/Happy.gif";
    if (isPlaying) return "/animations/Dancing.gif";

    switch (petState) {
      case "idle":
        return "/animations/Idle1.gif";
      case "dancing":
        return "/animations/Dancing.gif";
      case "crying":
        return "/animations/Crying.gif";
      case "dead":
        return "/animations/Dead.png";
      case "chilling":
      default:
        return "/animations/Chilling.gif";
    }
  };

  // Helper function to check if accessory is equipped
  const isAccessoryEquipped = (accessory: AvailableAccessory) => {
    return equippedAccessories.some(
      (equipped) => equipped.accessory_id === accessory.accessory_id
    );
  };

  // Accessories tab content
  const renderAccessoriesTab = () => (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Your pet can equip accessories to boost their stats. Unlock new
        accessories by leveling up!
      </div>

      {/* Equipped Accessories Summary */}
      {equippedAccessories.length > 0 && (
        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            Currently Equipped ({equippedAccessories.length})
          </div>
          <div className="flex flex-wrap gap-2">
            {equippedAccessories.map((accessory) => (
              <div
                key={accessory.accessory_id}
                className="flex items-center gap-2 bg-green-100 dark:bg-green-900 px-2 py-1 rounded text-xs"
              >
                <img
                  src={accessory.icon_url}
                  alt={accessory.name}
                  className="w-4 h-4 object-contain"
                />
                <span className="text-green-800 dark:text-green-200">
                  {accessory.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {availableAccessories.map((accessory) => {
          const isUnlocked = isAccessoryUnlocked(accessory);
          const isEquipped = isAccessoryEquipped(accessory);

          return (
            <div
              key={accessory.name}
              className={`p-4 rounded-lg border ${
                isUnlocked
                  ? isEquipped
                    ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                    : "bg-background hover:bg-accent/50"
                  : "bg-muted/50 opacity-60"
              } transition-all`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                  <img
                    src={accessory.icon_url}
                    alt={accessory.name}
                    className="w-8 h-8 object-contain"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm truncate">
                      {accessory.name}
                    </h4>
                    {!isUnlocked && (
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    )}
                    {isEquipped && (
                      <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
                        Equipped
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground mb-2">
                    {accessory.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {isUnlocked
                        ? isEquipped
                          ? "Equipped"
                          : "Available"
                        : `Level ${accessory.level_required} required`}
                    </div>
                    {isEquipped && (
                      <div className="text-xs text-green-600 dark:text-green-400">
                        ✓ Active
                      </div>
                    )}

                    {accessory.stats_boost && (
                      <div className="text-xs">
                        {Object.entries(accessory.stats_boost).map(
                          ([key, value]) => (
                            <span
                              key={key}
                              className="inline-block bg-primary/10 text-primary px-1 rounded mr-1"
                            >
                              +{String(value)} {key.replace("_", " ")}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>

                  {isUnlocked && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant={isEquipped ? "outline" : "default"}
                        onClick={() =>
                          handleEquipAccessory(accessory, !isEquipped)
                        }
                        className="w-full"
                      >
                        {isEquipped ? "Unequip" : "Equip"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {availableAccessories.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No accessories available yet.</p>
          <p className="text-xs mt-1">
            Keep learning to unlock accessories for your pet!
          </p>
        </div>
      )}
    </div>
  );

  // Show loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual Pet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading your pet...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state
  if (error || !pet) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Virtual Pet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-4">
                {error || "Failed to load pet"}
              </p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Percentage of XP earned toward the next level (drives the level bar fill).
  const expProgressPercent =
    pet.experienceToNextLevel > 0
      ? Math.min(
          100,
          Math.round((pet.experience / pet.experienceToNextLevel) * 100)
        )
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Virtual Pet</span>
          <span className="text-sm font-normal">Level {pet.level}</span>
        </CardTitle>
        <CardDescription>Take care of your learning companion</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            {/* Background accessory */}
            {pet.accessories.find((acc) => acc.slot === "background") && (
              <div
                className="absolute"
                style={{
                  width: "140px",
                  height: "140px",
                  top: "0",
                  left: "-10px",
                  zIndex: "0",
                }}
              >
                <Image
                  src={
                    pet.accessories.find((acc) => acc.slot === "background")
                      ?.iconUrl || ""
                  }
                  alt="Pet bed"
                  layout="fill"
                  objectFit="contain"
                />
              </div>
            )}

            {/* Pet with animations */}
            <div
              className="relative flex items-center justify-center"
              style={{ width: "120px", height: "120px" }}
            >
              {/* Background accessory (bed) */}
              {equippedAccessories.find(
                (acc) => acc.accessory_type === "background"
              ) && (
                <div
                  className="absolute"
                  style={{
                    width: "140px",
                    height: "140px",
                    top: "0px", // Position it behind the pet
                    left: "-10px",
                    zIndex: "0",
                  }}
                >
                  <Image
                    src={
                      equippedAccessories.find(
                        (acc) => acc.accessory_type === "background"
                      )?.icon_url || ""
                    }
                    alt="Pet bed"
                    width={140}
                    height={140}
                    objectFit="contain"
                  />
                </div>
              )}

              {/* Left accessory (pole) */}
              {equippedAccessories.find(
                (acc) => acc.accessory_type === "left"
              ) && (
                <div
                  className="absolute"
                  style={{
                    width: "50px",
                    height: "100px",
                    left: "-60px",
                    bottom: "10px",
                    zIndex: "1",
                  }}
                >
                  <Image
                    src={
                      equippedAccessories.find(
                        (acc) => acc.accessory_type === "left"
                      )?.icon_url || ""
                    }
                    alt="Scratch pole"
                    width={50}
                    height={100}
                    objectFit="contain"
                  />
                </div>
              )}

              {/* Bottom left accessory (kitten) */}
              {equippedAccessories.find(
                (acc) => acc.accessory_type === "bottom-left"
              ) && (
                <div
                  className="absolute"
                  style={{
                    width: "40px",
                    height: "40px",
                    left: "-20px",
                    bottom: "0px",
                    zIndex: "2",
                  }}
                >
                  <Image
                    src={
                      equippedAccessories.find(
                        (acc) => acc.accessory_type === "bottom-left"
                      )?.icon_url || ""
                    }
                    alt="Friend kitten"
                    width={40}
                    height={40}
                    objectFit="contain"
                  />
                </div>
              )}

              {/* Bottom right accessory (bowl) */}
              {equippedAccessories.find(
                (acc) => acc.accessory_type === "bottom-right"
              ) && (
                <div
                  className="absolute"
                  style={{
                    width: "40px",
                    height: "40px",
                    right: "-20px",
                    bottom: "0px",
                    zIndex: "2",
                  }}
                >
                  <Image
                    src={
                      equippedAccessories.find(
                        (acc) => acc.accessory_type === "bottom-right"
                      )?.icon_url || ""
                    }
                    alt="Food bowl"
                    width={40}
                    height={40}
                    objectFit="contain"
                  />
                </div>
              )}

              <Image
                src={getPetAnimationSrc()}
                alt={`${pet.name} the Cat`}
                width={120}
                height={120}
                priority
              />
            </div>
          </div>{" "}
          <div className="flex items-center justify-center text-xl font-bold mb-2 gap-2">
            {isEditingName ? (
              <div className="flex items-center">
                <Input
                  value={newPetName}
                  onChange={(e) => setNewPetName(e.target.value)}
                  className="h-8 px-2 py-1 w-32 text-center font-bold"
                  autoFocus
                  disabled={isUpdatingName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isUpdatingName) {
                      handleSaveName();
                    } else if (e.key === "Escape") {
                      setNewPetName(pet.name);
                      setIsEditingName(false);
                    }
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 ml-1"
                  onClick={handleSaveName}
                  disabled={isUpdatingName}
                  title="Save name"
                >
                  {isUpdatingName ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 ml-1"
                  onClick={() => {
                    setNewPetName(pet.name);
                    setIsEditingName(false);
                  }}
                  disabled={isUpdatingName}
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span>{pet.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setNewPetName(pet.name);
                    setIsEditingName(true);
                  }}
                  disabled={isUpdatingName}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          </div>
          {/* Equipped Accessories Indicator */}
          {equippedAccessories.length > 0 && (
            <div className="flex items-center justify-center gap-1 mb-3">
              <span className="text-xs text-muted-foreground">Equipped:</span>
              {equippedAccessories.map((accessory, index) => (
                <span
                  key={accessory.accessory_id}
                  className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded"
                >
                  {accessory.name}
                  {index < equippedAccessories.length - 1 && ","}
                </span>
              ))}
            </div>
          )}
          <div className="w-full space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <svg
                    className="h-4 w-4 mr-1 text-purple-500"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 2c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8z" />
                    <path d="M15 6h-6v12h6v-12z" />
                  </svg>
                  <span>Level {pet.level}</span>
                </div>
                <span>
                  {pet.experienceToNextLevel > 0
                    ? `${pet.experience} / ${pet.experienceToNextLevel} XP (${expProgressPercent}%)`
                    : "Max"}
                </span>
              </div>

              <Progress
                value={expProgressPercent}
                className="h-2 bg-purple-100 dark:bg-purple-900/20"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <Heart className="h-4 w-4 mr-1 text-red-500" />
                  <span>Happiness</span>
                </div>
                <span>{Math.round(pet.happiness)}%</span>
              </div>
              <Progress value={Math.round(pet.happiness)} className="h-2" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <div className="flex items-center">
                  <Zap className="h-4 w-4 mr-1 text-yellow-500" />
                  <span>Energy</span>
                </div>
                <span>{Math.round(pet.energy)}%</span>
              </div>
              <Progress value={Math.round(pet.energy)} className="h-2" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Last fed: {getTimeSince(pet.lastFed)}</span>
          </div>
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            <span>Last played: {getTimeSince(pet.lastPlayed)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Tabs
          defaultValue="interact"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="interact">Interact</TabsTrigger>
            <TabsTrigger value="customize">Customize</TabsTrigger>
          </TabsList>

          <TabsContent value="interact" className="space-y-2 pt-2">
            <div className="mb-2 flex items-center justify-center gap-1.5 text-sm">
              <span aria-hidden>🍖</span>
              <span className="font-medium">{food}</span>
              <span className="text-muted-foreground">food</span>
            </div>
            {food <= 0 && (
              <p className="mb-1 text-center text-xs text-muted-foreground">
                Out of food — complete quizzes and daily quests to earn more.
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleFeedClick}
                disabled={pet.energy >= 100 || isFeeding || food <= 0}
              >
                Feed Pet
              </Button>
              <Button
                onClick={handlePlayClick}
                disabled={pet.energy <= 0 || isPlaying}
              >
                Play
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="customize" className="pt-2">
            <Dialog open={showAccessories} onOpenChange={setShowAccessories}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Accessories
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] border border-slate-200 bg-white text-slate-900 dark:border-border dark:bg-background dark:text-slate-50">
                <DialogHeader>
                  <DialogTitle>Pet Accessories</DialogTitle>
                  <DialogDescription>
                    Customize your pet with special items that boost their stats
                  </DialogDescription>
                </DialogHeader>

                {renderAccessoriesTab()}
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </CardFooter>
    </Card>
  );
}