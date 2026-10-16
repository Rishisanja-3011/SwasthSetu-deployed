import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.chat import router as chat_router
from app.api.v1.health import router as health_router
from app.exceptions.handlers import register_exception_handlers


app = FastAPI(
    title="MediBot API",
    version="1.0.0",
)

frontend_origins = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5176,http://127.0.0.1:5176,https://swasth-setu-xi.vercel.app",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api/v1")
app.include_router(chat_router, prefix="/api/v1")
register_exception_handlers(app)


@app.get("/")
def root():
    return {"message": "MediBot API is running"}
