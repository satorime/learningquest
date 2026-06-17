from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timezone

from app.database.connection import get_db
from app.models.user import User
from app.models.virtual_pet import VirtualPet, PetAccessory
from app.schemas.virtual_pet import (
    PetCreateRequest, 
    PetUpdateNameRequest,
    PetCreateResponse,
    PetGetResponse,
    PetDeleteResponse,
    PetResponse,
    PetAccessoryResponse,
    PetCheckResponse,
    LevelSyncResponse,
    AvailableAccessoryResponse,
    AccessoriesListResponse
)
from app.utils.auth import get_current_active_user
from app.services.activity_log_service import log_activity
from app.services.pet_service import PetService
from app.services.daily_quest_service import DailyQuestService

import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/virtual-pet", tags=["virtual-pet"])


# How fast the pet's stats decay while it is left alone. These rates are also
# mirrored on the frontend so the live display matches what the server persists.
HAPPINESS_DECAY_PER_HOUR = 5.0
ENERGY_DECAY_PER_HOUR = 3.0


def _utcnow() -> datetime:
    """Timezone-aware UTC now (matches the DB's timestamptz columns)."""
    return datetime.now(timezone.utc)


def _apply_time_decay(pet: VirtualPet, db: Session, commit: bool = True) -> None:
    """Decay happiness/energy based on the real time elapsed since the pet was
    last touched, then persist it.

    This is what makes the decline survive logout/login: instead of relying on a
    client-side timer (which is lost on refresh), we recompute from the stored
    ``last_updated`` timestamp every time the pet is read or interacted with.
    """
    ref = pet.last_updated or pet.last_fed or pet.created_at
    if ref is None:
        pet.last_updated = _utcnow()
        if commit:
            db.commit()
        return

    # timestamptz columns come back tz-aware; guard against a naive value just in case.
    if ref.tzinfo is None:
        ref = ref.replace(tzinfo=timezone.utc)

    elapsed_hours = (_utcnow() - ref).total_seconds() / 3600.0
    if elapsed_hours <= 0:
        return

    pet.happiness = float(max(0, min(100, round(pet.happiness - HAPPINESS_DECAY_PER_HOUR * elapsed_hours))))
    pet.energy = float(max(0, min(100, round(pet.energy - ENERGY_DECAY_PER_HOUR * elapsed_hours))))
    pet.last_updated = _utcnow()
    if commit:
        db.commit()
        db.refresh(pet)


@router.get("/check-pet", response_model=PetCheckResponse)
async def check_pet(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Check if the current user has a virtual pet.
    This is used by the frontend to determine whether to show onboarding or load the pet.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) checking for pet")
        
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        has_pet = pet is not None
        message = f"User has a pet named '{pet.name}'" if has_pet else "User does not have a pet"
        
        logger.info(f"Pet check result for user {current_user.username}: {message}")
        
        return PetCheckResponse(
            has_pet=has_pet,
            message=message
        )
        
    except Exception as e:
        logger.error(f"Error checking pet for user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check pet status"
        )


@router.get("/get-pet", response_model=PetGetResponse)
async def get_pet(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get the current user's virtual pet information with synchronized level.
    Returns 404 if no pet exists.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting pet data")
        
        pet_service = PetService(db)
        pet = pet_service.get_pet_with_synchronized_level(current_user.id)

        if not pet:
            logger.info(f"No pet found for user {current_user.username} (ID: {current_user.id})")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No virtual pet found for this user"
            )

        # Apply time-based decay so happiness/energy reflect time spent away.
        _apply_time_decay(pet, db)

        # XP progress toward the next level (drives the level bar).
        progress = pet_service.get_level_progress(current_user.id)

        # Get pet accessories
        accessories = db.query(PetAccessory).filter(PetAccessory.pet_id == pet.pet_id).all()

        accessories_data = []
        for accessory in accessories:
            accessories_data.append(PetAccessoryResponse(
                accessory_id=accessory.accessory_id,
                accessory_type=accessory.accessory_type,
                name=accessory.name,
                description=accessory.description,
                icon_url=accessory.icon_url,
                level_required=accessory.level_required,
                stats_boost=accessory.stats_boost,
                is_equipped=bool(accessory.is_equipped),
                created_at=accessory.created_at
            ))

        pet_data = PetResponse(
            pet_id=pet.pet_id,
            name=pet.name,
            species=pet.species,
            happiness=pet.happiness,
            energy=pet.energy,
            food=pet.food or 0,
            level=pet.level,  # Now synchronized with user level
            exp_into_level=progress["exp_into_level"],
            exp_for_next_level=progress["exp_for_next_level"],
            exp_progress=progress["exp_progress"],
            last_fed=pet.last_fed,
            last_played=pet.last_played,
            created_at=pet.created_at,
            last_updated=pet.last_updated,
            accessories=accessories_data
        )

        logger.info(f"Successfully retrieved pet '{pet.name}' for user {current_user.username}")

        return PetGetResponse(
            success=True,
            has_pet=True,
            pet=pet_data,
            message=f"Pet '{pet.name}' loaded successfully"
        )

    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"Error getting pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pet information"
        )


@router.post("/create-pet", response_model=PetCreateResponse)
async def create_pet_new(
    pet_data: PetCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new virtual pet for the current user using moodleToken authentication.
    Each user can only have one virtual pet. Used during onboarding flow.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) creating pet: {pet_data.name}")
        
        # Check if user already has a pet
        existing_pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if existing_pet:
            logger.warning(f"User {current_user.username} already has a pet: {existing_pet.name}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a pet named '{existing_pet.name}'. You can only have one pet."
            )
        
        # Create new pet with synchronized level
        pet_service = PetService(db)
        user_level = pet_service.calculate_user_level(current_user.id)
        
        new_pet = VirtualPet(
            user_id=current_user.id,
            name=pet_data.name,
            species=pet_data.species,
            happiness=100.0,
            energy=100.0,
            level=user_level  # Initialize with user level
        )
        
        db.add(new_pet)
        db.commit()
        db.refresh(new_pet)
        
        # Check for initial accessory unlocks
        unlocked_accessories = pet_service._check_accessory_unlocks(new_pet, user_level)
        if unlocked_accessories:
            pet_service._send_accessory_unlock_notifications(current_user.id, unlocked_accessories)
        
        # Log the pet creation activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_created",
            action_details={
                "pet_name": pet_data.name,
                "species": pet_data.species,
                "pet_id": new_pet.pet_id,
                "initial_level": user_level
            },
            related_entity_type="virtual_pet",
            related_entity_id=new_pet.pet_id
        )
        
        # Create response with new pet data
        pet_response = PetResponse(
            pet_id=new_pet.pet_id,
            name=new_pet.name,
            species=new_pet.species,
            happiness=new_pet.happiness,
            energy=new_pet.energy,
            level=new_pet.level,
            last_fed=new_pet.last_fed,
            last_played=new_pet.last_played,
            created_at=new_pet.created_at,
            last_updated=new_pet.last_updated,
            accessories=[]
        )
        
        logger.info(f"Successfully created pet '{pet_data.name}' for user {current_user.username}")
        
        return PetCreateResponse(
            success=True,
            message=f"Pet '{pet_data.name}' created successfully!",
            pet=pet_response,
            is_new_pet=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pet"
        )


@router.post("/sync-level", response_model=LevelSyncResponse)
def sync_pet_level(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Synchronize pet level with user level and handle accessory unlocks.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) syncing pet level")
        
        pet_service = PetService(db)
        sync_result = pet_service.synchronize_pet_level(current_user.id)
        
        if "error" in sync_result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=sync_result["error"]
            )
        
        logger.info(f"Successfully synced pet level for user {current_user.username}")

        # Award any pet-level milestone badges the new level unlocks (best-effort).
        try:
            from ..services.badge_service import BadgeService
            BadgeService(db).check_and_award_badges(current_user.id)
        except Exception as badge_exc:  # noqa: BLE001 - never block level sync
            logger.warning(f"Badge check after pet level sync failed: {badge_exc}")

        return LevelSyncResponse(
            success=True,
            message="Pet level synchronized successfully",
            old_level=sync_result["old_level"],
            new_level=sync_result["new_level"],
            level_ups=sync_result["level_ups"],
            unlocked_accessories=sync_result["unlocked_accessories"],
            user_level=sync_result["user_level"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error syncing pet level for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync pet level"
        )


@router.get("/accessories", response_model=AccessoriesListResponse)
async def get_available_accessories(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all available accessories for the current user level.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting available accessories")
        pet_service = PetService(db)
        user_level = pet_service.calculate_user_level(current_user.id)
        available_accessories = pet_service.get_available_accessories_for_level(user_level)

        # Get user's pet and all unlocked accessories from DB
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        db_accessories = []
        if pet:
            db_accessories = db.query(PetAccessory).filter(PetAccessory.pet_id == pet.pet_id).all()

        accessories_response = []
        for config in available_accessories:
            # Try to find the DB accessory for this config (by name)
            db_acc = next((a for a in db_accessories if a.name == config["name"]), None)
            accessories_response.append(AvailableAccessoryResponse(
                accessory_id=db_acc.accessory_id if db_acc else 0,
                name=config["name"],
                description=config["description"],
                accessory_type=config["accessory_type"],
                icon_url=config["icon_url"],
                level_required=config["level_required"],
                stats_boost=config["stats_boost"],
                unlocked=config["unlocked"]
            ))

        logger.info(f"Successfully retrieved {len(accessories_response)} accessories for user {current_user.username}")
        return AccessoriesListResponse(
            success=True,
            available_accessories=accessories_response,
            user_level=user_level
        )
    except Exception as e:
        logger.error(f"Error getting accessories for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get available accessories"
        )


@router.get("/my-pet", response_model=PetGetResponse)
def get_my_pet(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get the current user's virtual pet information.
    Returns 404 if no pet exists (normal for first-time users).
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting pet data")
        
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if not pet:
            logger.info(f"No pet found for user {current_user.username} (ID: {current_user.id})")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No virtual pet found for this user"
            )

        # Apply time-based decay so happiness/energy reflect time spent away.
        _apply_time_decay(pet, db)

        # XP progress toward the next level (drives the level bar).
        progress = PetService(db).get_level_progress(current_user.id)

        # Get pet accessories
        accessories = db.query(PetAccessory).filter(PetAccessory.pet_id == pet.pet_id).all()

        accessories_data = []
        for accessory in accessories:
            accessories_data.append(PetAccessoryResponse(
                accessory_id=accessory.accessory_id,
                accessory_type=accessory.accessory_type,
                name=accessory.name,
                description=accessory.description,
                icon_url=accessory.icon_url,
                level_required=accessory.level_required,
                stats_boost=accessory.stats_boost,
                is_equipped=bool(accessory.is_equipped),
                created_at=accessory.created_at
            ))

        pet_data = PetResponse(
            pet_id=pet.pet_id,
            name=pet.name,
            species=pet.species,
            happiness=pet.happiness,
            energy=pet.energy,
            food=pet.food or 0,
            level=pet.level,  # Add the missing level field
            exp_into_level=progress["exp_into_level"],
            exp_for_next_level=progress["exp_for_next_level"],
            exp_progress=progress["exp_progress"],
            last_fed=pet.last_fed,
            last_played=pet.last_played,
            created_at=pet.created_at,
            last_updated=pet.last_updated,
            accessories=accessories_data
        )

        logger.info(f"Successfully retrieved pet '{pet.name}' for user {current_user.username}")

        return PetGetResponse(
            success=True,
            has_pet=True,
            pet=pet_data,
            message=f"Pet '{pet.name}' loaded successfully"
        )

    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception as e:
        logger.error(f"Error getting pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get pet information"
        )


@router.post("/create", response_model=PetCreateResponse)
async def create_pet(
    pet_data: PetCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create a new virtual pet for the current user.
    Each user can only have one virtual pet.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) creating pet: {pet_data.name}")
        
        # Check if user already has a pet
        existing_pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if existing_pet:
            logger.warning(f"User {current_user.username} already has a pet: {existing_pet.name}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"You already have a pet named '{existing_pet.name}'. You can only have one pet."
            )
        
        # Create new pet
        new_pet = VirtualPet(
            user_id=current_user.id,
            name=pet_data.name,
            species=pet_data.species,
            happiness=100.0,
            energy=100.0
        )
        
        db.add(new_pet)
        db.commit()
        db.refresh(new_pet)
        
        # Log the pet creation activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_created",
            action_details={
                "pet_name": pet_data.name,
                "species": pet_data.species,
                "pet_id": new_pet.pet_id
            },
            related_entity_type="virtual_pet",
            related_entity_id=new_pet.pet_id
        )
        
        logger.info(f"Successfully created pet '{pet_data.name}' for user {current_user.username}")
        
        pet_response = PetResponse(
            pet_id=new_pet.pet_id,
            name=new_pet.name,
            species=new_pet.species,
            happiness=new_pet.happiness,
            energy=new_pet.energy,
            level=new_pet.level,  # Add the missing level field
            last_fed=new_pet.last_fed,
            last_played=new_pet.last_played,
            created_at=new_pet.created_at,
            last_updated=new_pet.last_updated,
            accessories=[]
        )
        
        return PetCreateResponse(
            success=True,
            message=f"Virtual pet '{pet_data.name}' created successfully!",
            pet=pet_response,
            is_new_pet=True
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create pet"
        )


@router.put("/update-name", response_model=PetCreateResponse)
async def update_pet_name(
    pet_data: PetUpdateNameRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Update the name of the current user's pet using moodleToken authentication.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) updating pet name to: {pet_data.name}")
        
        # Check if user has a pet
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if not pet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pet found. Create a pet first."
            )
        
        # Update pet name
        old_name = pet.name
        pet.name = pet_data.name
        pet.last_updated = datetime.utcnow()
        
        db.commit()
        db.refresh(pet)
        
        # Log the name change activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_name_change",
            action_details={
                "old_name": old_name,
                "new_name": pet_data.name,
                "pet_id": pet.pet_id
            },
            related_entity_type="virtual_pet",
            related_entity_id=pet.pet_id
        )
        
        logger.info(f"Successfully updated pet name from '{old_name}' to '{pet_data.name}' for user {current_user.username}")
        
        pet_response = PetResponse(
            pet_id=pet.pet_id,
            name=pet.name,
            species=pet.species,
            happiness=pet.happiness,
            energy=pet.energy,
            level=pet.level,  # Add the missing level field
            last_fed=pet.last_fed,
            last_played=pet.last_played,
            created_at=pet.created_at,
            last_updated=pet.last_updated,
            accessories=[]
        )
        
        return PetCreateResponse(
            success=True,
            message=f"Pet name updated from '{old_name}' to '{pet_data.name}'",
            pet=pet_response,
            is_new_pet=False
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating pet name for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update pet name"
        )


@router.delete("/delete", response_model=PetDeleteResponse)
async def delete_pet(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Delete the current user's virtual pet.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) deleting pet")
        
        # Check if user has a pet
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        
        if not pet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pet found to delete"
            )
        
        pet_name = pet.name
        pet_id = pet.pet_id
        
        # Delete the pet (accessories will be deleted automatically due to cascade)
        db.delete(pet)
        db.commit()
        
        # Log the pet deletion activity
        log_activity(
            db=db,
            user_id=current_user.id,
            action_type="pet_deleted",
            action_details={
                "pet_name": pet_name,
                "pet_id": pet_id
            },
            related_entity_type="virtual_pet",
            related_entity_id=pet_id
        )
        
        logger.info(f"Successfully deleted pet '{pet_name}' for user {current_user.username}")
        
        return PetDeleteResponse(
            success=True,
            message=f"Pet '{pet_name}' has been deleted"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete pet"
        )


@router.post("/equip-accessory", response_model=dict)
async def equip_accessory(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Get parameters from request body
    body = await request.json()
    accessory_id = body.get("accessory_id")
    equip = body.get("equip")
    
    if accessory_id is None or equip is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="accessory_id and equip are required"
        )
    """
    Equip or unequip a pet accessory.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) {'equipping' if equip else 'unequipping'} accessory {accessory_id}")
        
        # Get user's pet
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        if not pet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pet found for this user"
            )
        
        # Get the accessory
        accessory = db.query(PetAccessory).filter(
            PetAccessory.accessory_id == accessory_id,
            PetAccessory.pet_id == pet.pet_id
        ).first()
        
        if not accessory:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Accessory not found"
            )
        
        # Check if user level meets the requirement
        pet_service = PetService(db)
        user_level = pet_service.calculate_user_level(current_user.id)
        
        if user_level < accessory.level_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"User level {user_level} does not meet requirement {accessory.level_required}"
            )
        
        # Update accessory equipped status
        accessory.is_equipped = 1 if equip else 0
        db.commit()
        
        # Apply stat boosts if equipping
        if equip:
            if accessory.stats_boost:
                try:
                    import json
                    stats = json.loads(accessory.stats_boost)
                    
                    # Apply stat boosts
                    if "energy_boost" in stats:
                        pet.energy = min(100.0, pet.energy + stats["energy_boost"])
                    if "happiness_boost" in stats:
                        pet.happiness = min(100.0, pet.happiness + stats["happiness_boost"])
                    
                    db.commit()
                    logger.info(f"Applied stat boosts: {stats}")
                except Exception as e:
                    logger.error(f"Error applying stat boosts: {e}")
        else:
            # Remove stat boosts if unequipping
            if accessory.stats_boost:
                try:
                    import json
                    stats = json.loads(accessory.stats_boost)
                    
                    # Remove stat boosts
                    if "energy_boost" in stats:
                        pet.energy = max(0.0, pet.energy - stats["energy_boost"])
                    if "happiness_boost" in stats:
                        pet.happiness = max(0.0, pet.happiness - stats["happiness_boost"])
                    
                    db.commit()
                    logger.info(f"Removed stat boosts: {stats}")
                except Exception as e:
                    logger.error(f"Error removing stat boosts: {e}")
        
        logger.info(f"Successfully {'equipped' if equip else 'unequipped'} accessory {accessory.name}")
        
        return {
            "success": True,
            "message": f"Successfully {'equipped' if equip else 'unequipped'} {accessory.name}",
            "accessory_id": accessory_id,
            "equipped": equip,
            "pet_stats": {
                "happiness": pet.happiness,
                "energy": pet.energy
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error equipping accessory: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to equip accessory"
        )


@router.get("/equipped-accessories", response_model=dict)
async def get_equipped_accessories(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get all equipped accessories for the current user's pet.
    """
    try:
        logger.info(f"User {current_user.username} (ID: {current_user.id}) requesting equipped accessories")
        
        # Get user's pet
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        if not pet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No pet found for this user"
            )
        
        # Get equipped accessories
        equipped_accessories = db.query(PetAccessory).filter(
            PetAccessory.pet_id == pet.pet_id,
            PetAccessory.is_equipped == 1
        ).all()
        
        accessories_data = []
        for accessory in equipped_accessories:
            accessories_data.append({
                "accessory_id": accessory.accessory_id,
                "name": accessory.name,
                "accessory_type": accessory.accessory_type,
                "icon_url": accessory.icon_url,
                "stats_boost": accessory.stats_boost
            })
        
        logger.info(f"Found {len(accessories_data)} equipped accessories for user {current_user.username}")
        
        return {
            "success": True,
            "equipped_accessories": accessories_data,
            "pet_stats": {
                "happiness": pet.happiness,
                "energy": pet.energy
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting equipped accessories: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get equipped accessories"
        )


@router.post("/feed", response_model=dict)
async def feed_pet(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Feed the current user's pet. Also completes the 'Feed your pet' daily quest if available.
    """
    try:
        # Lock the pet row so two concurrent feed requests can't both pass the
        # food check and double-spend a single unit of food.
        pet = (
            db.query(VirtualPet)
            .filter(VirtualPet.user_id == current_user.id)
            .with_for_update()
            .first()
        )
        if not pet:
            raise HTTPException(status_code=404, detail="No pet found for this user")

        # Settle any pending decay first.
        _apply_time_decay(pet, db, commit=False)

        # Feeding costs 1 food and restores 15 energy.
        if (pet.food or 0) <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No food — earn some by completing quizzes and daily quests.",
            )
        pet.food = pet.food - 1
        pet.energy = min(100.0, pet.energy + 15)
        pet.last_fed = _utcnow()
        pet.last_updated = _utcnow()
        db.commit()

        return {
            "success": True,
            "message": "Pet fed successfully!",
            "pet_stats": {
                "happiness": pet.happiness,
                "energy": pet.energy,
                "food": pet.food,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error feeding pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to feed pet"
        )


@router.post("/play", response_model=dict)
async def play_with_pet(
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Play with the current user's pet. Raises happiness at the cost of energy,
    and persists the result so it survives logout/login.
    """
    try:
        pet = db.query(VirtualPet).filter(VirtualPet.user_id == current_user.id).first()
        if not pet:
            raise HTTPException(status_code=404, detail="No pet found for this user")

        # Settle any pending decay first.
        _apply_time_decay(pet, db, commit=False)

        if pet.energy <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Your pet is too tired to play. Feed it first."
            )

        pet.happiness = min(100.0, pet.happiness + 15)
        pet.energy = max(0.0, pet.energy - 10)
        pet.last_played = _utcnow()
        pet.last_updated = _utcnow()
        db.commit()

        return {
            "success": True,
            "message": "You played with your pet!",
            "pet_stats": {
                "happiness": pet.happiness,
                "energy": pet.energy
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error playing with pet for user {current_user.id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to play with pet"
        )
