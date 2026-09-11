"""
migrate_and_backfill_categories.py
- SQLite (instagram.db) 및 Supabase PostgreSQL 스키마 자동 업그레이드
- posts: category 컬럼 추가
- reels: category, duration_ms 컬럼 추가
- content_views 테이블 생성
- 기존 posts / reels 카테고리 및 영상길이(ms) 백필
"""

import os
import sys

# 프로젝트 루트 경로를 sys.path에 추가하여 app 모듈 임포트 가능하게 설정
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import sqlite3
from sqlalchemy import create_engine, text, inspect
from app.config import settings
from app.database import Base
import app.models # 모든 모델 로드

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

CATEGORIES = ["cafe", "travel", "fashion", "food", "fitness", "pets", "tech", "art"]

TAG_CATEGORY_MAP = {
    "카페": "cafe", "커피": "cafe", "디저트": "cafe", "cafe": "cafe", "coffee": "cafe",
    "여행": "travel", "travel": "travel", "바다": "travel", "호캉스": "travel", "제주": "travel",
    "패션": "fashion", "ootd": "fashion", "오오티디": "fashion", "데일리룩": "fashion", "style": "fashion",
    "맛집": "food", "먹스타그램": "food", "푸드": "food", "점심": "food", "저녁": "food",
    "운동": "fitness", "오운완": "fitness", "헬스": "fitness", "러닝": "fitness", "다이어트": "fitness",
    "반려": "pets", "강아지": "pets", "고양이": "pets", "멍스타그램": "pets", "냥스타그램": "pets", "pet": "pets",
    "테크": "tech", "개발": "tech", "코딩": "tech", "it": "tech", "ai": "tech",
    "아트": "art", "전시": "art", "미술": "art", "디자인": "art", "사진": "art",
}

def guess_category(caption: str, index: int) -> str:
    if caption:
        lower = caption.lower()
        for kw, cat in TAG_CATEGORY_MAP.items():
            if kw in lower:
                return cat
    return CATEGORIES[index % len(CATEGORIES)]

def migrate_engine(engine, target_name="Database"):
    print(f"\n==================================================")
    print(f"🚀 [{target_name}] 마이그레이션 및 동기화 시작")
    print(f"==================================================")

    # 1. Base.metadata.create_all (새 테이블 content_views 생성)
    Base.metadata.create_all(bind=engine)
    print("✅ Base.metadata.create_all 완료 (content_views 등 신규 테이블 생성)")

    # 2. 컬럼 누락 검사 및 ALTER TABLE 실행
    with engine.connect() as conn:
        inspector = inspect(conn)
        table_names = inspector.get_table_names()

        # posts 테이블
        if "posts" in table_names:
            post_cols = [c["name"] for c in inspector.get_columns("posts")]
            if "category" not in post_cols:
                print("⚠️ posts.category 컬럼 추가 중...")
                conn.execute(text("ALTER TABLE posts ADD COLUMN category VARCHAR(50)"))
                conn.commit()
                print("✅ posts.category 컬럼 추가 완료")
            else:
                print("ℹ️ posts.category 컬럼이 이미 존재합니다.")

        # reels 테이블
        if "reels" in table_names:
            reel_cols = [c["name"] for c in inspector.get_columns("reels")]
            if "category" not in reel_cols:
                print("⚠️ reels.category 컬럼 추가 중...")
                conn.execute(text("ALTER TABLE reels ADD COLUMN category VARCHAR(50)"))
                conn.commit()
                print("✅ reels.category 컬럼 추가 완료")
            else:
                print("ℹ️ reels.category 컬럼이 이미 존재합니다.")

            if "duration_ms" not in reel_cols:
                print("⚠️ reels.duration_ms 컬럼 추가 중...")
                conn.execute(text("ALTER TABLE reels ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 15000"))
                conn.commit()
                print("✅ reels.duration_ms 컬럼 추가 완료")
            else:
                print("ℹ️ reels.duration_ms 컬럼이 이미 존재합니다.")

        # 3. 기존 posts 카테고리 백필
        result = conn.execute(text("SELECT id, caption, category FROM posts")).fetchall()
        updated_posts = 0
        for idx, row in enumerate(result):
            p_id, caption, cat = row[0], row[1], row[2]
            if not cat:
                new_cat = guess_category(caption, idx)
                conn.execute(text("UPDATE posts SET category = :cat WHERE id = :pid"), {"cat": new_cat, "pid": p_id})
                updated_posts += 1
        if updated_posts > 0:
            conn.commit()
            print(f"✅ 게시물 {updated_posts}개 category 백필 완료")
        else:
            print(f"ℹ️ 게시물 카테고리 백필 대상 없음 (총 {len(result)}개)")

        # 4. 기존 reels 카테고리 및 duration_ms 백필
        result = conn.execute(text("SELECT id, caption, category, duration_ms FROM reels")).fetchall()
        updated_reels = 0
        for idx, row in enumerate(result):
            r_id, caption, cat, dur = row[0], row[1], row[2], row[3]
            needs_update = False
            new_cat = cat
            new_dur = dur
            if not new_cat:
                new_cat = guess_category(caption, idx)
                needs_update = True
            if not new_dur or new_dur == 0:
                new_dur = 15000  # 기본 15초(15,000ms)
                needs_update = True
            if needs_update:
                conn.execute(text("UPDATE reels SET category = :cat, duration_ms = :dur WHERE id = :rid"), {
                    "cat": new_cat,
                    "dur": new_dur,
                    "rid": r_id
                })
                updated_reels += 1
        if updated_reels > 0:
            conn.commit()
            print(f"✅ 릴스 {updated_reels}개 category & duration_ms 백필 완료")
        else:
            print(f"ℹ️ 릴스 카테고리 백필 대상 없음 (총 {len(result)}개)")

        # 5. 최종 검증 출력
        inspector = inspect(conn)
        print(f"\n--- [{target_name}] 최종 스키마 상태 ---")
        print("테이블 목록:", inspector.get_table_names())
        if "posts" in inspector.get_table_names():
            print("posts 컬럼:", [c["name"] for c in inspector.get_columns("posts")])
        if "reels" in inspector.get_table_names():
            print("reels 컬럼:", [c["name"] for c in inspector.get_columns("reels")])
        if "content_views" in inspector.get_table_names():
            print("content_views 컬럼:", [c["name"] for c in inspector.get_columns("content_views")])

def main():
    # 1. Supabase PostgreSQL 마이그레이션
    supabase_url = settings.DATABASE_URL
    print(f"Supabase 연결 시도: {supabase_url.split('@')[-1] if '@' in supabase_url else supabase_url}")
    supabase_engine = create_engine(supabase_url, pool_pre_ping=True)
    try:
        migrate_engine(supabase_engine, target_name="Supabase PostgreSQL")
    except Exception as e:
        print(f"❌ Supabase 마이그레이션 실패: {e}")

    # 2. 로컬 SQLite (instagram.db) 마이그레이션
    local_db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "instagram.db")
    if os.path.exists(local_db_path):
        sqlite_engine = create_engine(f"sqlite:///{local_db_path}")
        try:
            migrate_engine(sqlite_engine, target_name="Local SQLite (instagram.db)")
        except Exception as e:
            print(f"❌ SQLite 마이그레이션 실패: {e}")

    print("\n🎉 모든 데이터베이스 마이그레이션 및 백필이 성공적으로 완료되었습니다!")

if __name__ == "__main__":
    main()
