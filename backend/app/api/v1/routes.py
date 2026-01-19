from fastapi import APIRouter

from app.api.v1.controllers import auth_controller, hr_controller, student_controller, maintenance_controller, reminder_controller


router = APIRouter()

router.include_router(auth_controller.router)
router.include_router(hr_controller.router)
router.include_router(student_controller.router)
router.include_router(reminder_controller.router)
router.include_router(maintenance_controller.router, prefix="/maintenance", tags=["Maintenance"])


@router.get("/ping", tags=["Health"])
async def ping():
    return {"message": "pong"}