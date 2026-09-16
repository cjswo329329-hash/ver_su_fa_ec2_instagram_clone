import time
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User
from app.routers.admin import get_admin_posts, get_admin_reels, get_admin_users

def run_tests():
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.is_admin == True).first()
        if not admin_user:
            print("ERROR: Admin user not found!")
            sys.exit(1)
            
        print("=" * 60)
        print("ADMIN QUERY OPTIMIZATION & BUG FIX VERIFICATION")
        print("=" * 60)

        # 1. Test get_admin_posts
        start = time.perf_counter()
        posts_res = get_admin_posts(page=1, page_size=15, db=db, admin_user=admin_user)
        posts_elapsed_ms = (time.perf_counter() - start) * 1000

        print(f"\n[1] get_admin_posts:")
        print(f"    - Total Count: {posts_res.total} (Expected: 240)")
        print(f"    - Returned Items: {len(posts_res.items)} (Page Size: 15)")
        print(f"    - Total Pages: {posts_res.total_pages}")
        print(f"    - Elapsed Time: {posts_elapsed_ms:.2f} ms")
        if posts_res.items:
            first_post = posts_res.items[0]
            print(f"    - Sample Post: ID={first_post.id}, Author=@{first_post.author.username}, Likes={first_post.likes_count}, Comments={first_post.comments_count}")

        # 2. Test get_admin_reels
        start = time.perf_counter()
        reels_res = get_admin_reels(page=1, page_size=15, db=db, admin_user=admin_user)
        reels_elapsed_ms = (time.perf_counter() - start) * 1000

        print(f"\n[2] get_admin_reels:")
        print(f"    - Total Count: {reels_res.total} (Expected: 160)")
        print(f"    - Returned Items: {len(reels_res.items)} (Page Size: 15)")
        print(f"    - Total Pages: {reels_res.total_pages}")
        print(f"    - Elapsed Time: {reels_elapsed_ms:.2f} ms")
        if reels_res.items:
            first_reel = reels_res.items[0]
            print(f"    - Sample Reel: ID={first_reel.id}, Author=@{first_reel.author.username}, Likes={first_reel.likes_count}, Comments={first_reel.comments_count}, Shares={first_reel.shares_count}")

        # 3. Test get_admin_users
        start = time.perf_counter()
        users_res = get_admin_users(page=1, page_size=15, db=db, admin_user=admin_user)
        users_elapsed_ms = (time.perf_counter() - start) * 1000

        print(f"\n[3] get_admin_users:")
        print(f"    - Total Count: {users_res.total} (Expected: 107)")
        print(f"    - Returned Items: {len(users_res.items)} (Page Size: 15)")
        print(f"    - Total Pages: {users_res.total_pages}")
        print(f"    - Elapsed Time: {users_elapsed_ms:.2f} ms")
        if users_res.items:
            first_user = users_res.items[0]
            print(f"    - Sample User: ID={first_user.id}, Username=@{first_user.username}, Posts={first_user.posts_count}, Followers={first_user.followers_count}, Following={first_user.following_count}")

        # 4. Sort variations test
        print(f"\n[4] Sort Variations Verification:")
        for sort_opt in ["created_at_desc", "created_at_asc", "likes_desc", "comments_desc"]:
            t0 = time.perf_counter()
            p = get_admin_posts(sort_by=sort_opt, db=db, admin_user=admin_user)
            ms = (time.perf_counter() - t0) * 1000
            print(f"    - Posts sort='{sort_opt}': total={p.total}, first_id={p.items[0].id if p.items else None}, time={ms:.2f}ms")

        for sort_opt in ["created_at_desc", "created_at_asc", "likes_desc", "comments_desc", "shares_desc"]:
            t0 = time.perf_counter()
            r = get_admin_reels(sort_by=sort_opt, db=db, admin_user=admin_user)
            ms = (time.perf_counter() - t0) * 1000
            print(f"    - Reels sort='{sort_opt}': total={r.total}, first_id={r.items[0].id if r.items else None}, time={ms:.2f}ms")

        for sort_opt in ["created_at_desc", "created_at_asc", "posts_desc", "followers_desc"]:
            t0 = time.perf_counter()
            u = get_admin_users(sort_by=sort_opt, db=db, admin_user=admin_user)
            ms = (time.perf_counter() - t0) * 1000
            print(f"    - Users sort='{sort_opt}': total={u.total}, first_id={u.items[0].id if u.items else None}, time={ms:.2f}ms")

        # 5. Search test
        print(f"\n[5] Search (q) Verification:")
        p_search = get_admin_posts(q="test", db=db, admin_user=admin_user)
        print(f"    - Posts search q='test': total={p_search.total}, items={len(p_search.items)}")
        r_search = get_admin_reels(q="reel", db=db, admin_user=admin_user)
        print(f"    - Reels search q='reel': total={r_search.total}, items={len(r_search.items)}")
        u_search = get_admin_users(q="admin", db=db, admin_user=admin_user)
        print(f"    - Users search q='admin': total={u_search.total}, items={len(u_search.items)}")

        # Verification check
        assert posts_res.total == 240, f"Expected 240 posts, got {posts_res.total}"
        assert reels_res.total == 160, f"Expected 160 reels, got {reels_res.total}"
        assert users_res.total == 107, f"Expected 107 users, got {users_res.total}"
        print("\n>>> ALL ASSERTIONS PASSED SUCCESSFULLY! <<<")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
