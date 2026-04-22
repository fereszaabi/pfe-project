from typing import List, Optional
import os
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel, Field
from dotenv import load_dotenv


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[ChatMessage] = []
    image_path: Optional[str] = ""


app = FastAPI(title="IDSoft Python Support Bot")
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)


@app.post("/chat")
def chat(req: ChatRequest):
    if not os.getenv("GROQ_API_KEY"):
        return {
            "detail": "GROQ_API_KEY manquant. Configurez la cle API pour activer le chatbot.",
        }

    try:
        from chat import ask_support_bot
    except Exception:  # pragma: no cover
        return {
            "reply": "Le moteur intelligent est en cours de preparation. Veuillez creer un ticket de support pour continuer.",
        }

    history_lines = [f"{m.role.capitalize()}: {m.content}" for m in req.history]
    try:
        reply = ask_support_bot(req.message, history=history_lines, image_path=req.image_path or "")
    except Exception:  # pragma: no cover
        return {
            "reply": "Assistant indisponible pour le moment. Veuillez creer un ticket de support.",
        }

    return {"reply": reply}


@app.get("/health")
def health():
    return {"ok": True}
