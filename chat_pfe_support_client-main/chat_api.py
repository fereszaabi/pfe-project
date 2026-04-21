from typing import List, Optional

from fastapi import FastAPI
from fastapi import HTTPException
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: List[ChatMessage] = []
    image_path: Optional[str] = ""


app = FastAPI(title="IDSoft Python Support Bot")


@app.post("/chat")
def chat(req: ChatRequest):
    try:
        from chat import ask_support_bot
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=503, detail=f"Chatbot bootstrap failed: {exc}")

    history_lines = [f"{m.role.capitalize()}: {m.content}" for m in req.history]
    try:
        reply = ask_support_bot(req.message, history=history_lines, image_path=req.image_path or "")
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=503, detail=f"Chatbot request failed: {exc}")

    return {"reply": reply}


@app.get("/health")
def health():
    return {"ok": True}
