"""
Main webhook router and event dispatcher.
"""

import inspect
import logging
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session

from app.database.connection import get_db
from .utils import log_and_ack
from .base_processor import WebhookProcessor
from .handlers import (
    handle_quiz_attempt_submitted,
    # new start events will reuse generic processor via lightweight endpoints
    handle_assign_submitted,
    handle_assign_graded,
    handle_forum_post_created,
    handle_forum_discussion_created,
    handle_lesson_completed,
    handle_lesson_viewed,
    handle_course_completion_updated,
    handle_feedback_submitted,
    handle_choice_answer_submitted,
    handle_resource_file_viewed,
    handle_resource_book_viewed,
    handle_resource_page_viewed,
    handle_resource_url_viewed,
    handle_glossary_entry_created,
    handle_wiki_page_created,
    handle_wiki_page_updated,
    handle_chat_message_sent
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

# Event handlers mapping
EVENT_HANDLERS = {
    "quiz/attempt-submitted": {
        "message": "Quiz attempt submitted webhook received and logged",
        "handler": handle_quiz_attempt_submitted
    },
    # Start events (lightweight endpoints handled below)
    "assign/viewed": {
        "message": "Assignment viewed webhook received and logged",
        "handler": None
    },
    "quiz/attempt-started": {
        "message": "Quiz attempt started webhook received and logged",
        "handler": None
    },
    "assign/submitted": {
        "message": "Assignment submitted webhook received and logged",
        "handler": handle_assign_submitted
    },
    "assign/graded": {
        "message": "Assignment graded webhook received and logged",
        "handler": handle_assign_graded
    },
    "course/completion-updated": {
        "message": "Module completion updated webhook received and logged",
        "handler": handle_course_completion_updated
    },
    "forum/post-created": {
        "message": "Forum post created webhook received and logged",
        "handler": handle_forum_post_created
    },
    "forum/discussion-created": {
        "message": "Forum discussion created webhook received and logged",
        "handler": handle_forum_discussion_created
    },
    "lesson/completed": {
        "message": "Lesson completed webhook received and logged",
        "handler": handle_lesson_completed
    },
    "lesson/viewed": {
        "message": "Lesson viewed webhook received and logged",
        "handler": handle_lesson_viewed
    },
    "feedback/submitted": {
        "message": "Feedback submitted webhook received and logged",
        "handler": handle_feedback_submitted
    },
    "glossary/entry-created": {
        "message": "Glossary entry created webhook received and logged",
        "handler": handle_glossary_entry_created
    },
    "resource/file-viewed": {
        "message": "File viewed webhook received and logged",
        "handler": handle_resource_file_viewed
    },
    "resource/book-viewed": {
        "message": "Book viewed webhook received and logged",
        "handler": handle_resource_book_viewed
    },
    "resource/page-viewed": {
        "message": "Page viewed webhook received and logged",
        "handler": handle_resource_page_viewed
    },
    "resource/url-viewed": {
        "message": "URL viewed webhook received and logged",
        "handler": handle_resource_url_viewed
    },
    "choice/answer-submitted": {
        "message": "Choice answer submitted webhook received and logged",
        "handler": handle_choice_answer_submitted
    },
    "wiki/page-created": {
        "message": "Wiki page created webhook received and logged",
        "handler": handle_wiki_page_created
    },
    "wiki/page-updated": {
        "message": "Wiki page updated webhook received and logged",
        "handler": handle_wiki_page_updated
    },
    "chat/message-sent": {
        "message": "Chat message sent webhook received and logged",
        "handler": handle_chat_message_sent
    },
}


@router.post("/{event_path:path}")
async def handle_webhook(event_path: str, request: Request, db: Session = Depends(get_db)):
    """
    Main webhook endpoint that handles all Moodle webhook events.
    
    Args:
        event_path: The event path (e.g., "quiz/attempt-submitted")
        request: The HTTP request containing webhook payload
        db: Database session
        
    Returns:
        dict: Standard acknowledgment response
        
    Raises:
        HTTPException: If event path is unknown or processing fails
    """
    try:
        data = await request.json()

        if event_path not in EVENT_HANDLERS:
            raise HTTPException(status_code=404, detail="Unknown webhook event path")

        event_info = EVENT_HANDLERS[event_path]
        msg = event_info["message"]

        handler = event_info.get("handler")
        processor = WebhookProcessor(db)

        if handler:
            # Pass db session if handler expects it
            if "db" in inspect.signature(handler).parameters:
                handler(data, db)
            else:
                handler(data)

        # Always forward to engagement processor with normalized event type
        EVENT_TO_TYPE = {
            "assign/viewed": "assignment_viewed",
            "assign/submitted": "assignment_submitted",
            "assign/graded": "assignment_graded",
            "quiz/attempt-started": "quiz_attempt_started",
            "quiz/attempt-submitted": "quiz_attempt_submitted",
            "lesson/viewed": "lesson_viewed",
            "lesson/completed": "lesson_completed",
            "feedback/submitted": "feedback_submitted",
            "forum/post-created": "forum_post_created",
            "forum/discussion-created": "forum_discussion_created",
            "wiki/page-created": "wiki_page_created",
            "wiki/page-updated": "wiki_page_updated",
            "choice/answer-submitted": "choice_answer_submitted",
            "chat/message-sent": "chat_message_sent",
            "resource/file-viewed": "file_viewed",
            "resource/book-viewed": "book_viewed",
            "resource/page-viewed": "page_viewed",
            "resource/url-viewed": "url_viewed",
            "course/completion-updated": "module_completion_updated",
        }

        normalized = EVENT_TO_TYPE.get(event_path)
        if normalized:
            processor.process_engagement_event(data, normalized)

        return log_and_ack(event_path.replace("/", "_"), data, msg)

    except Exception as e:
        logger.error("❌ Error processing webhook for %s: %s", event_path, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to process webhook: {str(e)}")
