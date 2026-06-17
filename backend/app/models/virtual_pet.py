from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database.connection import Base
import math


class VirtualPet(Base):
    __tablename__ = "virtual_pets"

    pet_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    species = Column(String(50), nullable=False)
    happiness = Column(Float, nullable=False, default=100.0)
    energy = Column(Float, nullable=False, default=100.0)
    # Consumable earned from schoolwork; each feed consumes 1 food.
    food = Column(Integer, nullable=False, default=0)
    level = Column(Integer, nullable=False, default=1)  # Now synchronized with user level
    last_fed = Column(DateTime(timezone=True), server_default=func.now())
    last_played = Column(DateTime(timezone=True), server_default=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    accessories = relationship("PetAccessory", back_populates="pet", cascade="all, delete-orphan")
    user = relationship("User", foreign_keys=[user_id])

    def synchronize_with_user_level(self, user_level: int) -> dict:
        """Synchronize pet level with user level and return level change info."""
        old_level = self.level
        self.level = user_level
        
        level_ups = 0
        if user_level > old_level:
            level_ups = user_level - old_level
        
        return {
            "level_ups": level_ups,
            "old_level": old_level,
            "new_level": self.level,
            "synchronized": True
        }

    def get_available_accessories(self, user_level: int) -> list:
        """Get accessories that are available at the current user level."""
        from app.models.virtual_pet import PetAccessory
        # This will be implemented in the service layer
        return []


class PetAccessory(Base):
    __tablename__ = "pet_accessories"

    accessory_id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("virtual_pets.pet_id", ondelete="CASCADE"), nullable=False)
    accessory_type = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon_url = Column(String(255))
    level_required = Column(Integer, nullable=False, default=1)
    stats_boost = Column(Text)  # JSON string
    is_equipped = Column(Integer, nullable=False, default=0)  # 0 = not equipped, 1 = equipped
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    pet = relationship("VirtualPet", back_populates="accessories")
