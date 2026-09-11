import os
import sys
import time

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from sqlalchemy import event
from sqlalchemy.engine import Engine
from app.database import SessionLocal
from app.routers.posts import get_feed
from app.routers.reels import get_reels
from app.routers.explore import get_explore, invalidate_explore_cache
from app.models import User

class QueryCounter:
    def __init__(self):
        self.count = 0

    def __enter__(self):
        self.count = 0
        event.listen(Engine, "before_cursor_execute", self._handler)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        event.remove(Engine, "before_cursor_execute", self._handler)

    def _handler(self, conn, cursor, statement, parameters, context, executemany):
        self.count += 1

def test_feed_performance_sla():
    db = SessionLocal()
    user = db.query(User).first()

    with QueryCounter() as qc:
        t0 = time.time()
        res = get_feed(limit=10, cursor=None, db=db, current_user=user)
        elapsed = time.time() - t0

    db.close()

    print(f"\n[FEED SLA] Queries: {qc.count} (SLA <= 6), Elapsed: {elapsed:.2f}s (SLA <= 1.5s)")
    assert qc.count <= 6, f"Feed queries {qc.count} > 6"
    assert elapsed <= 1.5, f"Feed time {elapsed}s > 1.5s"
    assert len(res.items) > 0, "Feed should return items"

def test_reels_performance_sla():
    db = SessionLocal()
    user = db.query(User).first()

    # Pre-warm metadata cache
    get_reels(limit=2, offset=0, seed=42, db=db, current_user=user)

    with QueryCounter() as qc:
        t0 = time.time()
        res = get_reels(limit=10, offset=10, seed=42, exclude_ids="1,2", cursor=None, db=db, current_user=user)
        elapsed = time.time() - t0

    db.close()

    print(f"\n[REELS SLA] Queries: {qc.count} (SLA <= 6), Elapsed: {elapsed:.2f}s (SLA <= 1.5s)")
    assert qc.count <= 6, f"Reels queries {qc.count} > 6"
    assert elapsed <= 1.5, f"Reels time {elapsed}s > 1.5s"
    assert len(res) > 0, "Reels should return items"

def test_explore_performance_sla():
    db = SessionLocal()
    invalidate_explore_cache()

    # Cold cache miss
    with QueryCounter() as qc_cold:
        t0 = time.time()
        res_cold = get_explore(q=None, limit=24, offset=0, db=db)
        elapsed_cold = time.time() - t0

    print(f"\n[EXPLORE COLD SLA] Queries: {qc_cold.count} (SLA <= 8), Elapsed: {elapsed_cold:.2f}s (SLA <= 2.0s)")
    assert qc_cold.count <= 8, f"Explore cold queries {qc_cold.count} > 8"
    assert elapsed_cold <= 2.0, f"Explore cold time {elapsed_cold}s > 2.0s"
    assert len(res_cold) > 0, "Explore cold should return items"

    # Warm cache hit
    with QueryCounter() as qc_warm:
        t0 = time.time()
        res_warm = get_explore(q=None, limit=24, offset=0, db=db)
        elapsed_warm = time.time() - t0

    db.close()

    print(f"[EXPLORE CACHED SLA] Queries: {qc_warm.count} (SLA == 0), Elapsed: {elapsed_warm*1000:.2f}ms (SLA <= 50ms)")
    assert qc_warm.count == 0, f"Explore cached queries {qc_warm.count} != 0"
    assert elapsed_warm < 0.05, f"Explore cached time {elapsed_warm}s >= 50ms"

if __name__ == "__main__":
    test_feed_performance_sla()
    test_reels_performance_sla()
    test_explore_performance_sla()
    print("\n✅ ALL RED TEAM SLA TESTS PASSED!")
