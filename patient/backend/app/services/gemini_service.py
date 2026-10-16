from google import genai

from app.core.config import settings
from app.prompts.medical_prompt import MEDICAL_SYSTEM_PROMPT
from app.utils.text_formatter import clean_response


class GeminiService:
    def __init__(self):
        self.client = None

    def _client(self):
        if self.client is None:
            if not settings.gemini_api_key:
                raise RuntimeError("MediBot AI provider is not configured.")
            self.client = genai.Client(api_key=settings.gemini_api_key)
        return self.client

    def generate_response(self, question: str, history: list):
        conversation = "\n".join(
            f"{message.get('role', 'user').title()}: {message.get('content', '')}"
            for message in history
            if message.get("role") in {"user", "assistant"}
        )
        prompt = (
            f"{MEDICAL_SYSTEM_PROMPT}\n\n"
            f"Previous conversation:\n{conversation}\n\n"
            f"Latest user question:\n{question}\n\n"
            "Answer the latest question directly and concisely."
        )
        response = self._client().models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
        )
        answer = clean_response(response.text)
        if not answer:
            raise RuntimeError("MediBot returned an empty response.")
        return answer


gemini_service = GeminiService()
