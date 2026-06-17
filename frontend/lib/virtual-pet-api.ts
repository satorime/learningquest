// Virtual Pet API service functions
import { apiClient, isApiError } from "./api-client";

export interface VirtualPetData {
  pet_id: number;
  name: string;
  species: string;
  happiness: number;
  energy: number;
  food?: number;
  level: number;
  exp_into_level?: number;
  exp_for_next_level?: number;
  exp_progress?: number; // whole-number percentage 0-100
  last_fed: string;
  last_played: string;
  created_at: string;
  last_updated: string;
  accessories: any[];
}

export interface VirtualPetResponse {
  success: boolean;
  message?: string;
  pet?: VirtualPetData;
  has_pet?: boolean;
  is_new_pet?: boolean;
}

// Get current user's pet
export async function getMyPet(): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>("/virtual-pet/get-pet", "GET");

    return {
      success: true,
      has_pet: true,
      pet: data.pet,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching pet:", error);

    // Handle 404 as a normal case for users without pets
    if (isApiError(error, 404)) {
      console.log(
        "No pet found for user (404) - this is normal for first-time users"
      );
      return {
        success: true,
        has_pet: false,
        message: "No pet found - first time user",
      };
    }

    // Handle 401 as authentication issue
    if (isApiError(error, 401)) {
      console.log("Not authenticated (401) - user may need to log in");
      return {
        success: false,
        has_pet: false,
        message: "Authentication required - please log in",
      };
    }

    return {
      success: false,
      has_pet: false,
      message: `Failed to fetch pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Create new pet
export async function createPet(
  name: string,
  species: string = "cat"
): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>(
      "/virtual-pet/create-pet",
      "POST",
      {
        name: name,
        species: species,
      }
    );

    return {
      success: true,
      pet: data.pet,
      message: data.message,
      is_new_pet: data.is_new_pet,
    };
  } catch (error) {
    console.error("Error creating pet:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in to create a pet",
      };
    }

    if (isApiError(error, 400)) {
      return {
        success: false,
        message: "You already have a pet. You can only have one pet at a time.",
      };
    }

    return {
      success: false,
      message: `Failed to create pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Update pet name
export async function updatePetName(name: string): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>(
      "/virtual-pet/update-name",
      "PUT",
      {
        name: name,
      }
    );

    return {
      success: true,
      pet: data.pet,
      message: data.message,
      is_new_pet: false,
    };
  } catch (error) {
    console.error("Error updating pet name:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in to update pet name",
      };
    }

    if (isApiError(error, 404)) {
      return {
        success: false,
        message: "No pet found - please create a pet first",
      };
    }

    return {
      success: false,
      message: `Failed to update pet name: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Delete pet
export async function deletePet(): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<VirtualPetResponse>(
      "/virtual-pet/delete",
      "DELETE"
    );

    return data;
  } catch (error) {
    console.error("Error deleting pet:", error);

    // Handle 401 as authentication issue
    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in to delete pet",
      };
    }

    if (isApiError(error, 404)) {
      return {
        success: false,
        message: "No pet found to delete",
      };
    }

    return {
      success: false,
      message: `Failed to delete pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

export interface PetCheckResponse {
  has_pet: boolean;
  message: string;
}

export interface LevelSyncResponse {
  success: boolean;
  message: string;
  old_level: number;
  new_level: number;
  level_ups: number;
  unlocked_accessories: any[];
  user_level: number;
}

export interface AvailableAccessory {
  accessory_id: number;
  name: string;
  description: string;
  accessory_type: string;
  icon_url: string;
  level_required: number;
  stats_boost: any;
  unlocked: boolean;
}

export interface AccessoriesListResponse {
  success: boolean;
  message?: string;
  available_accessories: AvailableAccessory[];
  user_level: number;
}

// Check if user has a pet using moodleToken authentication
export async function checkUserHasPet(): Promise<{
  success: boolean;
  data?: PetCheckResponse;
  message?: string;
}> {
  try {
    const data = await apiClient.request<PetCheckResponse>(
      "/virtual-pet/check-pet",
      "GET"
    );

    return {
      success: true,
      data: data,
    };
  } catch (error) {
    console.error("❌ Error checking pet status:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in",
      };
    }

    return {
      success: false,
      message: `Failed to check pet status: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Get user's pet using moodleToken authentication
export async function getUserPet(): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>("/virtual-pet/get-pet", "GET");

    return {
      success: true,
      has_pet: true,
      pet: data.pet,
      message: data.message,
    };
  } catch (error) {
    console.error("Error fetching pet:", error);

    // Handle 404 as a normal case for users without pets
    if (isApiError(error, 404)) {
      console.log(
        "No pet found for user (404) - this is normal for first-time users"
      );
      return {
        success: true,
        has_pet: false,
        message: "No pet found - first time user",
      };
    }

    // Handle 401 as authentication issue
    if (isApiError(error, 401)) {
      console.log("Not authenticated (401) - user may need to log in");
      return {
        success: false,
        has_pet: false,
        message: "Authentication required - please log in",
      };
    }

    return {
      success: false,
      has_pet: false,
      message: `Failed to fetch pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Create new pet using moodleToken authentication (for onboarding)
export async function createUserPet(
  name: string,
  species: string = "cat"
): Promise<VirtualPetResponse> {
  try {
    const data = await apiClient.request<any>(
      "/virtual-pet/create-pet",
      "POST",
      {
        name: name,
        species: species,
      }
    );

    return {
      success: true,
      pet: data.pet,
      message: data.message,
      is_new_pet: data.is_new_pet,
    };
  } catch (error) {
    console.error("Error creating pet:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in to create a pet",
      };
    }

    if (isApiError(error, 400)) {
      return {
        success: false,
        message: "You already have a pet. You can only have one pet at a time.",
      };
    }

    return {
      success: false,
      message: `Failed to create pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Sync pet level with user level
export async function syncPetLevel(): Promise<LevelSyncResponse> {
  try {
    const data = await apiClient.request<LevelSyncResponse>(
      "/virtual-pet/sync-level",
      "POST"
    );

    return data;
  } catch (error) {
    console.error("Error syncing pet level:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in to sync pet level",
        old_level: 0,
        new_level: 0,
        level_ups: 0,
        unlocked_accessories: [],
        user_level: 0,
      };
    }

    if (isApiError(error, 404)) {
      return {
        success: false,
        message: "No pet found - please create a pet first",
        old_level: 0,
        new_level: 0,
        level_ups: 0,
        unlocked_accessories: [],
        user_level: 0,
      };
    }

    return {
      success: false,
      message: `Failed to sync pet level: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      old_level: 0,
      new_level: 0,
      level_ups: 0,
      unlocked_accessories: [],
      user_level: 0,
    };
  }
}

// Get available accessories for current user level
export async function getAvailableAccessories(): Promise<AccessoriesListResponse> {
  try {
    const data = await apiClient.request<AccessoriesListResponse>(
      "/virtual-pet/accessories",
      "GET"
    );

    return data;
  } catch (error) {
    console.error("Error getting available accessories:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in to view accessories",
        available_accessories: [],
        user_level: 0,
      };
    }

    return {
      success: false,
      message: `Failed to get available accessories: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      available_accessories: [],
      user_level: 0,
    };
  }
}

// Equip or unequip an accessory
export async function equipAccessory(
  accessoryId: number,
  equip: boolean
): Promise<{
  success: boolean;
  message: string;
  accessory_id?: number;
  equipped?: boolean;
  pet_stats?: {
    happiness: number;
    energy: number;
  };
}> {
  try {
    const data = await apiClient.request<any>(
      "/virtual-pet/equip-accessory",
      "POST",
      {
        accessory_id: accessoryId,
        equip: equip,
      }
    );

    return data;
  } catch (error) {
    console.error("Error equipping accessory:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        message: "Authentication required - please log in to equip accessories",
      };
    }

    if (isApiError(error, 404)) {
      return {
        success: false,
        message: "Accessory not found",
      };
    }

    if (isApiError(error, 400)) {
      return {
        success: false,
        message: "Level requirement not met for this accessory",
      };
    }

    return {
      success: false,
      message: `Failed to equip accessory: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

export interface PetInteractionResult {
  success: boolean;
  message?: string;
  pet_stats?: {
    happiness: number;
    energy: number;
    food?: number;
  };
}

// Feed the pet (persists energy/happiness on the backend)
export async function feedPet(): Promise<PetInteractionResult> {
  try {
    return await apiClient.request<PetInteractionResult>(
      "/virtual-pet/feed",
      "POST"
    );
  } catch (error) {
    console.error("Error feeding pet:", error);
    return {
      success: false,
      message: `Failed to feed pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Play with the pet (persists energy/happiness on the backend)
export async function playWithPet(): Promise<PetInteractionResult> {
  try {
    return await apiClient.request<PetInteractionResult>(
      "/virtual-pet/play",
      "POST"
    );
  } catch (error) {
    console.error("Error playing with pet:", error);
    return {
      success: false,
      message: `Failed to play with pet: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

// Get equipped accessories
export async function getEquippedAccessories(): Promise<{
  success: boolean;
  equipped_accessories: any[];
  pet_stats?: {
    happiness: number;
    energy: number;
  };
}> {
  try {
    const data = await apiClient.request<any>(
      "/virtual-pet/equipped-accessories",
      "GET"
    );

    return data;
  } catch (error) {
    console.error("Error getting equipped accessories:", error);

    if (isApiError(error, 401)) {
      return {
        success: false,
        equipped_accessories: [],
      };
    }

    return {
      success: false,
      equipped_accessories: [],
    };
  }
}
