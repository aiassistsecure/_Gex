"""
test-app — API Routes
Add your backend endpoints here.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/info")
async def app_info():
    """Get application info."""
    return {
        "name": "test-app",
        "version": "1.0.0",
        "framework": "Gene",
    }


@router.get("/greet/{name}")
async def greet(name: str):
    """Example greeting endpoint."""
    return {"message": f"Hello, {name}! Welcome to test-app 🧬"}


# ─── Add your routes below ──────────────────────────────────────
# @router.post("/your-endpoint")
# async def your_handler():
#     pass
