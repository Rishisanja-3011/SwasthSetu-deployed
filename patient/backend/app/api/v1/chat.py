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
        # Preserve the existing Groq preference when it is configured, while
        # allowing a deployment with only GEMINI_API_KEY to run the same UI.
        provider = groq_service if settings.groq_api_key else gemini_service
        answer = provider.generate_response(request.question, request.history)
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
