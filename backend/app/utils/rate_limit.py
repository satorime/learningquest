"""Lightweight in-memory rate limiting for sensitive endpoints.

A sliding-window counter keyed by (scope, client IP). This is process-local —
which matches the app's single-instance deployment. For a multi-instance deploy
this would need a shared store (e.g. Redis), the same caveat as the SSE system.
"""
import time
from collections import defaultdict, deque
from typing import Deque, Dict

from fastapi import HTTPException, Request, status

# scope:ip -> timestamps (monotonic seconds) of recent calls
_BUCKETS: Dict[str, Deque[float]] = defaultdict(deque)


def rate_limit(scope: str, max_calls: int, window_seconds: int):
    """Return a FastAPI dependency that throttles by client IP.

    e.g. `Depends(rate_limit("login", 10, 300))` = max 10 calls / 5 min per IP.
    """
    async def _dependency(request: Request) -> None:
        ip = request.client.host if request.client else "unknown"
        key = f"{scope}:{ip}"
        now = time.monotonic()
        bucket = _BUCKETS[key]

        # Drop timestamps outside the window.
        cutoff = now - window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) >= max_calls:
            retry_after = int(bucket[0] + window_seconds - now) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many attempts. Please wait a moment and try again.",
                headers={"Retry-After": str(max(retry_after, 1))},
            )
        bucket.append(now)

    return _dependency
