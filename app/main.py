from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, mcqs, sessions, analytics, daily
from app.db.database import engine
from app.models.models import Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RankBattle UPSC", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(mcqs.router)
app.include_router(sessions.router)
app.include_router(analytics.router)
app.include_router(daily.router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "RankBattle UPSC API"}
