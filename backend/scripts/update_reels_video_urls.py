"""
update_reels_video_urls.py
=============================================================================
Supabase DB reels 테이블의 160개 레코드를 160개 고유 물리 비디오 파일
(/videos/reel1.mp4 ~ /videos/reel160.mp4)과 1:1 완벽 매핑하도록 갱신.
=============================================================================
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.database import SessionLocal
from app.models import Reel
from scripts.generate_160_reel_videos import CATEGORIES, CATEGORY_THEMES

def update_reels():
    db = SessionLocal()
    try:
        reels = db.query(Reel).order_by(Reel.id).all()
        print(f"Loaded {len(reels)} reels from Supabase DB.")

        reel_mapping = []
        file_idx = 1
        for cat in CATEGORIES:
            theme = CATEGORY_THEMES[cat]
            titles = theme["titles"]
            for sub_idx in range(10):
                title = titles[sub_idx]
                video_url = f"/videos/reel{file_idx}.mp4"
                caption = f"{title} #{cat} #인스타릴스 #오운완" if cat == "fitness" else f"{title} #{cat} #일상 #추천"
                reel_mapping.append((cat, video_url, caption))
                file_idx += 1

        print(f"Prepared {len(reel_mapping)} unique video mappings.")

        updated_count = 0
        for i, reel in enumerate(reels):
            if i < len(reel_mapping):
                cat, v_url, cap = reel_mapping[i]
                reel.category = cat
                reel.video_url = v_url
                reel.caption = cap
                updated_count += 1

        db.commit()
        print(f"Successfully updated {updated_count} reels in Supabase DB!")

        # 검증 출력
        sample_reels = db.query(Reel).filter(Reel.id.in_([1, 15, 35, 75, 125, 160])).all()
        print("\n=== Verification Sample ===")
        for r in sample_reels:
            print(f"Reel ID {r.id}: cat={r.category}, url={r.video_url}, caption={r.caption}")

    except Exception as e:
        db.rollback()
        print(f"Error during update: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    update_reels()
