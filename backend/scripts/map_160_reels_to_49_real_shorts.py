"""
map_160_reels_to_49_real_shorts.py
=============================================================================
Supabase DB reels 테이블의 160개 레코드를
현재 Supabase Storage에 존재하는 49개의 실제 실사 숏폼 비디오(reel1.mp4 ~ reel49.mp4)로
골고루 매핑하여 모든 릴스가 100% 실사 영상으로 재생되도록 동기화.
=============================================================================
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal
from app.models import Reel

SUPABASE_STORAGE_REELS_URL = "https://npnclxvzpeedvyogpmqw.supabase.co/storage/v1/object/public/instagram-media/reels"

def main():
    db = SessionLocal()
    try:
        reels = db.query(Reel).order_by(Reel.id).all()
        print(f"Loaded {len(reels)} reels from Supabase DB.")

        updated_count = 0
        for r in reels:
            # 1~49번 실사 비디오로 순환 매핑 (50 이상 파일은 스토리지에서 삭제되었으므로 접근 방지)
            video_num = ((r.id - 1) % 49) + 1
            real_video_url = f"{SUPABASE_STORAGE_REELS_URL}/reel{video_num}.mp4"
            r.video_url = real_video_url
            updated_count += 1

        db.commit()
        print(f"Successfully mapped all {updated_count} reels to 49 real shorts videos!")

        # 검증 출력
        sample_ids = [1, 25, 49, 50, 75, 100, 150, 160]
        samples = db.query(Reel).filter(Reel.id.in_(sample_ids)).order_by(Reel.id).all()
        print("\n=== Verification in DB ===")
        for s in samples:
            print(f"Reel ID {s.id:3d}: cat={s.category:15s} -> {s.video_url}")

    except Exception as e:
        db.rollback()
        print(f"Error mapping reels: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
