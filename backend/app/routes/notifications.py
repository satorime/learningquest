# filepath: backend/app/routes/notifications.py
import asyncio
import json
import logging
from typing import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.models.user import User
from app.services.notification_service import notification_service
from app.utils.auth import decode_token, require_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _user_from_token(db: Session, token: str | None) -> User:
    """Validate a JWT passed as a query param (EventSource can't set headers)."""
    payload = decode_token(token) if token else None
    username = payload.get("sub") if payload else None
    if not username:
        raise HTTPException(status_code=401, detail="Authentication required")
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


@router.get("/events/{user_id}")
async def stream_notifications(
    user_id: int,
    token: str | None = Query(None, description="JWT access token"),
    db: Session = Depends(get_db),
):
    """
    Server-Sent Events endpoint for real-time notifications.

    Requires a valid access token (passed as `?token=` because EventSource can't
    send an Authorization header). A user may only subscribe to their OWN stream;
    admins may subscribe to any.
    """
    current_user = _user_from_token(db, token)

    # Enforce ownership: you can only listen to your own notification stream.
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Cannot subscribe to another user's stream")

    user = current_user if current_user.id == user_id else db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate Server-Sent Events for the client"""
        
        # Connect user to notification service
        queue = await notification_service.connect_user(user.id)
        
        try:
            # Send initial connection event
            yield f"data: {json.dumps({'type': 'connected', 'message': 'SSE connection established'})}\n\n"
            
            # Keep connection alive and send notifications
            while True:
                try:
                    # Wait for notification with timeout to send heartbeat
                    notification = await asyncio.wait_for(queue.get(), timeout=30.0)
                    
                    # Send the notification as SSE data
                    event_data = json.dumps(notification)
                    yield f"data: {event_data}\n\n"
                    
                except asyncio.TimeoutError:
                    # Send heartbeat to keep connection alive
                    heartbeat = {
                        "type": "heartbeat",
                        "timestamp": notification_service.active_connections and 
                                   len(notification_service.active_connections) or 0
                    }
                    yield f"data: {json.dumps(heartbeat)}\n\n"
                    
                except asyncio.CancelledError:
                    # Client disconnected
                    logger.info(f"SSE connection cancelled for user {user.id}")
                    break
                    
                except Exception as e:
                    logger.error(f"Error in SSE event generator for user {user.id}: {e}")
                    error_event = {
                        "type": "error",
                        "message": "An error occurred in the notification stream"
                    }
                    yield f"data: {json.dumps(error_event)}\n\n"
                    break
                    
        except Exception as e:
            logger.error(f"Fatal error in SSE connection for user {user.id}: {e}")
        finally:
            # Clean up connection
            await notification_service.disconnect_user(user.id, queue)
            logger.info(f"SSE connection closed for user {user.id}")

    return StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "*"
        }
    )

@router.get("/status")
async def get_notification_status(_admin: User = Depends(require_admin)):
    """Get the status of the notification service (admin only)."""
    return {
        "active_connections": len(notification_service.active_connections),
        "connected_users": notification_service.get_connected_users(),
        "service_status": "running"
    }
