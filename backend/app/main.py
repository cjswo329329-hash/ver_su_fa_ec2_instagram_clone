import os
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, Base, SessionLocal
import app.models  # load all models for metadata
from app.models.user import User
from app.core.security import get_password_hash
from app.routers import (
    auth_router,
    users_router,
    posts_router,
    comments_router,
    reels_router,
    explore_router,
    direct_router,
    stories_router,
    bookmarks_router,
    follows_router,
    notifications_router,
    uploads_router,
    admin_router,
    views_router,
)

# 데이터베이스 테이블 자동 생성
Base.metadata.create_all(bind=engine)

def init_db_and_admin():
    """
    데이터베이스 스키마 마이그레이션 및 기본 관리자 계정 초기화 (SQLite / PostgreSQL 공통 호환)
    아이디: admin / 비밀번호: pass123
    """
    with engine.connect() as conn:
        from sqlalchemy import text, inspect
        try:
            inspector = inspect(conn)
            table_names = inspector.get_table_names()
            if "users" in table_names:
                columns = [col["name"] for col in inspector.get_columns("users")]
                if "is_admin" not in columns:
                    conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE"))
                    conn.commit()

            if "posts" in table_names:
                p_columns = [col["name"] for col in inspector.get_columns("posts")]
                if "category" not in p_columns:
                    conn.execute(text("ALTER TABLE posts ADD COLUMN category VARCHAR(50)"))
                    conn.commit()

            if "reels" in table_names:
                r_columns = [col["name"] for col in inspector.get_columns("reels")]
                if "category" not in r_columns:
                    conn.execute(text("ALTER TABLE reels ADD COLUMN category VARCHAR(50)"))
                    conn.commit()
                if "duration_ms" not in r_columns:
                    conn.execute(text("ALTER TABLE reels ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 15000"))
                    conn.commit()
        except Exception as e:
            print(f"[WARN] 테이블 스키마 검사 중 예외: {e}")

    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@instagram.local",
                hashed_password=get_password_hash("pass123"),
                full_name="시스템 관리자",
                bio="Instagram 시스템 최고 관리자 계정",
                profile_image_url="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
                is_private=False,
                is_verified=True,
                is_admin=True,
            )
            db.add(admin_user)
            db.commit()
            print("[INFO] 관리자 계정(admin)이 새로 생성되었습니다.")
        else:
            # 관리자 권한 및 요청된 비밀번호 동기화
            admin_user.is_admin = True
            admin_user.hashed_password = get_password_hash("pass123")
            db.commit()
            print("[INFO] 관리자 계정(admin) 정보가 업데이트되었습니다.")
    except Exception as e:
        print(f"[WARN] 관리자 계정 초기화 중 예외: {e}")
        db.rollback()
    finally:
        db.close()

init_db_and_admin()

# 미디어 업로드 폴더 생성
for category in ["posts", "reels", "profiles", "stories", "direct"]:
    os.makedirs(os.path.join(settings.UPLOAD_DIR, category), exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Instagram Clone Backend REST API with FastAPI, Supabase, and EC2",
    version="1.0.0",
)

# CORS 설정 (로컬 개발 환경 및 Vercel 배포 도메인 연동 지원)
cors_origins = list(settings.BACKEND_CORS_ORIGINS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https?://.*",  # Vercel 배포 URL(*.vercel.app) 및 모든 클라이언트 원격 연동 지원
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 업로드 파일 서빙
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# 정적 비디오 파일 서빙 (릴스 비디오 로컬 호스팅 지원)
videos_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "public", "videos"))
if os.path.exists(videos_dir):
    app.mount("/videos", StaticFiles(directory=videos_dir), name="videos")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    from fastapi.encoders import jsonable_encoder
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "status_code": 422,
            "error": "UNPROCESSABLE_ENTITY",
            "message": "요청 데이터의 유효성 검사에 실패했습니다.",
            "detail": jsonable_encoder(exc.errors()),
        },
    )

# API 라우터 등록 (전체 12개 라우터)
app.include_router(auth_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(posts_router, prefix="/api")
app.include_router(comments_router, prefix="/api")
app.include_router(reels_router, prefix="/api")
app.include_router(explore_router, prefix="/api")
app.include_router(direct_router, prefix="/api")
app.include_router(stories_router, prefix="/api")
app.include_router(bookmarks_router, prefix="/api")
app.include_router(follows_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(views_router, prefix="/api")

@app.get("/")
def root():
    return {
        "project": settings.PROJECT_NAME,
        "status": "online",
        "docs": "/docs",
        "version": "1.0.0"
    }

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
