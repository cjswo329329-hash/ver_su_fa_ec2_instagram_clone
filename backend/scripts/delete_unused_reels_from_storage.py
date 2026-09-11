"""
delete_unused_reels_from_storage.py
=============================================================================
Supabase Storage 버킷(instagram-media)에서 사용하지 않는
reels/reel50.mp4 ~ reel160.mp4 파일들을 일괄 삭제하여 스토리지를 261MB로 최적화.
=============================================================================
"""

import os
import sys

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.config import settings
from supabase import create_client

def delete_unused_storage_files():
    supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    files_to_delete = [f"reels/reel{i}.mp4" for i in range(50, 161)]
    print(f"Requesting deletion of {len(files_to_delete)} unused files from Supabase Storage...")

    # Supabase storage remove API accepts list of paths
    try:
        # Batch in chunks of 50
        for i in range(0, len(files_to_delete), 50):
            chunk = files_to_delete[i:i+50]
            res = supabase.storage.from_("instagram-media").remove(chunk)
            print(f"Deleted chunk {i//50 + 1}: {len(chunk)} files -> {res}")

        print("\nAll 50~160 files successfully deleted from Supabase Storage!")

        # Verify remaining files
        remaining = supabase.storage.from_("instagram-media").list("reels", {"limit": 200})
        print(f"Remaining active files in instagram-media/reels/: {len(remaining)} (Expected: 49)")

    except Exception as e:
        print(f"Error during deletion: {e}")
        raise

if __name__ == "__main__":
    delete_unused_storage_files()
