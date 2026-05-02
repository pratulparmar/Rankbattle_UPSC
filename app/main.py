from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import auth, mcqs, sessions, analytics, daily
from app.api.routes.ai_coach import router as ai_coach_router
from app.api.routes.mcq_generator import router as mcq_generator_router
from app.api.routes.admin import router as admin_router
from app.db.database import engine
from app.models.models import Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RankBattle UPSC", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://rankbattle-upsc.vercel.app","https://upsc.rankbattle.in","http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(mcqs.router)
app.include_router(sessions.router)
app.include_router(analytics.router)
app.include_router(daily.router)
app.include_router(ai_coach_router)
app.include_router(mcq_generator_router)
app.include_router(admin_router)

@app.get("/health")
def health():
    return {"status": "ok", "service": "RankBattle UPSC API"}
