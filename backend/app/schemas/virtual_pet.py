from pydantic import BaseModel, validator
from typing import Optional, List
from datetime import datetime


class PetCreateRequest(BaseModel):
    name: str
    species: Optional[str] = "cat"
    
    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Pet name cannot be empty')
        if len(v.strip()) > 100:
            raise ValueError('Pet name cannot exceed 100 characters')
        return v.strip()

    @validator('species')
    def validate_species(cls, v):
        allowed_species = ['cat', 'dog', 'dragon', 'owl', 'fox', 'rabbit', 'hamster']
        if v not in allowed_species:
            raise ValueError(f'Species must be one of: {", ".join(allowed_species)}')
        return v


class PetUpdateNameRequest(BaseModel):
    name: str
    
    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) == 0:
            raise ValueError('Pet name cannot be empty')
        if len(v.strip()) > 100:
            raise ValueError('Pet name cannot exceed 100 characters')
        return v.strip()


class PetCheckResponse(BaseModel):
    has_pet: bool
    message: str


class PetAccessoryResponse(BaseModel):
    accessory_id: int
    accessory_type: str
    name: str
    description: Optional[str]
    icon_url: Optional[str]
    level_required: int
    stats_boost: Optional[str]  # JSON string
    is_equipped: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PetResponse(BaseModel):
    pet_id: int
    name: str
    species: str
    happiness: float
    energy: float
    food: int = 0  # consumable for feeding
    level: int  # Now synchronized with user level
    # XP progress within the current level (drives the level bar fill).
    exp_into_level: int = 0
    exp_for_next_level: int = 0
    exp_progress: int = 0  # whole-number percentage 0-100
    last_fed: datetime
    last_played: datetime
    created_at: datetime
    last_updated: datetime
    accessories: Optional[List[PetAccessoryResponse]] = []

    class Config:
        from_attributes = True


class PetCreateResponse(BaseModel):
    success: bool
    message: str
    pet: PetResponse
    is_new_pet: Optional[bool] = False


class PetGetResponse(BaseModel):
    success: bool
    has_pet: bool
    pet: Optional[PetResponse] = None
    message: Optional[str] = None


class PetDeleteResponse(BaseModel):
    success: bool
    message: str


class PetInteractionRequest(BaseModel):
    action: str  # "feed", "play", "rest"
    
    @validator('action')
    def validate_action(cls, v):
        allowed_actions = ['feed', 'play', 'rest']
        if v not in allowed_actions:
            raise ValueError(f'Action must be one of: {", ".join(allowed_actions)}')
        return v


class PetInteractionResponse(BaseModel):
    success: bool
    message: str
    pet: PetResponse
    happiness_change: float
    energy_change: float


class PetStatusResponse(BaseModel):
    success: bool
    pet: PetResponse
    needs_attention: bool
    recommendations: List[str]
    
    
class AccessoryEquipRequest(BaseModel):
    accessory_id: int
    equip: bool  # True to equip, False to unequip


class AccessoryEquipResponse(BaseModel):
    success: bool
    message: str
    accessory: PetAccessoryResponse


class LevelSyncResponse(BaseModel):
    success: bool
    message: str
    old_level: int
    new_level: int
    level_ups: int
    unlocked_accessories: List[dict]
    user_level: int


class AvailableAccessoryResponse(BaseModel):
    accessory_id: int
    name: str
    description: str
    accessory_type: str
    icon_url: str
    level_required: int
    stats_boost: dict
    unlocked: bool


class AccessoriesListResponse(BaseModel):
    success: bool
    available_accessories: List[AvailableAccessoryResponse]
    user_level: int
