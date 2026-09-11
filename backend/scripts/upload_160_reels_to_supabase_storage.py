"""
upload_160_reels_to_supabase_storage.py
=============================================================================
160개 비디오(frontend/public/videos/reel1.mp4 ~ reel160.mp4)를
Supabase Storage 버킷(instagram-media/reels/)에 고속 병렬 업로드하고,
Supabase DB reels 테이블의 video_url을 Supabase Storage 공개 URL로 1:1 업데이트.
=============================================================================
"""

import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.config import settings
from app.database import SessionLocal
from app.models import Reel
from supabase import create_client

def upload_single_video(args):
    idx, local_path, bucket_name = args
    storage_path = f"reels/reel{idx}.mp4"
    
    with open(local_path, "rb") as f:
        file_bytes = f.read()

    # Create fresh client per thread to avoid connection pool conflicts
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    for attempt in range(5):
        try:
            supabase.storage.from_(bucket_name).upload(
                storage_path,
                file_bytes,
                {"content-type": "video/mp4", "upsert": "true"}
            )
            public_url = supabase.storage.from_(bucket_name).get_public_url(storage_path)
            return idx, public_url, len(file_bytes)
        except Exception as e:
            if attempt == 4:
                raise e
            time.sleep(1 + attempt)

def main():
    start_time = time.time()
    source_dir = "d:/바이브코딩/Instagram_Vercel_Supabase_FastAPI/frontend/public/videos"
    bucket_name = "instagram-media"

    tasks = []
    for i in range(1, 161):
        local_path = os.path.join(source_dir, f"reel{i}.mp4")
        if os.path.exists(local_path):
            tasks.append((i, local_path, bucket_name))
        else:
            print(f"Warning: {local_path} not found!")

    print(f"Starting batch upload of {len(tasks)} videos to Supabase Storage '{bucket_name}' (3 workers with retry)...")

    results = {}
    completed = 0
    total_bytes = 0
    with ThreadPoolExecutor(max_workers=3) as executor:
        for idx, pub_url, size in executor.map(upload_single_video, tasks):
            completed += 1
            total_bytes += size
            results[idx] = pub_url
            if completed % 20 == 0 or completed == len(tasks):
                elapsed = time.time() - start_time
                print(f"[{completed}/{len(tasks)}] Uploaded reel{idx}.mp4 -> {pub_url} ({size//1024} KB) - {elapsed:.1f}s")

    print(f"\nAll {completed} videos uploaded to Supabase Storage! Total: {total_bytes / (1024*1024):.2f} MB")

    # Supabase DB reels 테이블의 video_url 업데이트
    print("\nUpdating Supabase DB reels table with new Supabase Storage URLs...")
    db = SessionLocal()
    try:
        reels = db.query(Reel).order_by(Reel.id).all()
        updated = 0
        for i, r in enumerate(reels):
            file_idx = i + 1
            if file_idx in results:
                r.video_url = results[file_idx]
                updated += 1

        db.commit()
        print(f"Successfully updated {updated} reels with Supabase Storage URLs in DB!")

        # 샘플 확인
        sample_reels = db.query(Reel).filter(Reel.id.in_([1, 50, 100, 160])).all()
        print("\n=== Verification in DB ===")
        for r in sample_reels:
            print(f"ID {r.id}: {r.category} -> {r.video_url}")

    except Exception as e:
        db.rollback()
        print(f"DB update error: {e}")
        raise
    finally:
        db.close()

    elapsed = time.time() - start_time
    print(f"\nDone in {elapsed:.1f} seconds.")

if __name__ == "__main__":
    main()
