from fastapi import APIRouter, HTTPException

from app.schemas.chat_schema import ChatRequest
from app.schemas.response_schema import ApiResponse
from app.core.config import settings
from app.services.gemini_service import gemini_service
from app.services.groq_service import groq_service


router = APIRouter()


@router.post("/chat", response_model=ApiResponse)
def chat(request: ChatRequest):
    try:
        # Prefer Groq when configured, but fall back to Gemini so one expired
        # or misconfigured provider does not take the deployed demo offline.
        if settings.groq_api_key:
            try:
                answer = groq_service.generate_response(request.question, request.history)
            except Exception:
                if not settings.gemini_api_key:
                    raise
                answer = gemini_service.generate_response(request.question, request.history)
        else:
            answer = gemini_service.generate_response(request.question, request.history)
    except RuntimeError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    return ApiResponse(
        success=True,
        message="Response generated successfully.",
        data={
            "question": request.question,
            "answer": answer,
        },
    )
