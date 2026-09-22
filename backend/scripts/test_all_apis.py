import os
import sys
from fastapi.testclient import TestClient

# Windows 콘솔 인코딩 대응
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app

client = TestClient(app)

def run_tests():
    print("==================================================================")
    print("🚀 Instagram Clone Backend 전체 API 100% E2E 검증 시작")
    print("==================================================================")

    # 1. Health & Root
    print("\n[1] Health & Root 테스트")
    res = client.get("/health")
    assert res.status_code == 200, res.text
    assert res.json()["status"] == "healthy"
    res = client.get("/")
    assert res.status_code == 200, res.text
    print("  ✅ /health 및 / 통과")

    # 2. Auth API
    print("\n[2] Auth API 테스트")
    # 로그인 (seed 계정)
    login_res = client.post("/api/auth/login", json={
        "username_or_email": "alex_creator",
        "password": "aaaa1234"
    })
    assert login_res.status_code == 200, login_res.text
    token_data = login_res.json()
    token = token_data["access_token"]
    refresh_token = token_data["refresh_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"  ✅ 로그인 성공: {token_data['user']['username']}")

    # Refresh token
    ref_res = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == 200, ref_res.text
    assert "access_token" in ref_res.json()
    print("  ✅ 토큰 갱신 성공")

    # Get /me
    me_res = client.get("/api/auth/me", headers=headers)
    assert me_res.status_code == 200, me_res.text
    assert me_res.json()["username"] == "alex_creator"
    print("  ✅ 내 정보 조회 성공")

    # Change password
    pw_res = client.put("/api/auth/password", headers=headers, json={
        "old_password": "aaaa1234",
        "new_password": "aaaa1234_new"
    })
    assert pw_res.status_code == 200, pw_res.text
    # 원상 복구
    client.put("/api/auth/password", headers=headers, json={
        "old_password": "aaaa1234_new",
        "new_password": "aaaa1234"
    })
    print("  ✅ 비밀번호 변경(PUT /api/auth/password) 성공")

    # 3. Users API
    print("\n[3] Users API 테스트")
    # Profile header
    prof_res = client.get("/api/users/alex_creator", headers=headers)
    assert prof_res.status_code == 200, prof_res.text
    pdata = prof_res.json()
    assert pdata["username"] == "alex_creator"
    print(f"  ✅ 프로필 조회 성공: {pdata['username']} (게시물 {pdata['posts_count']}, 팔로워 {pdata['followers_count']})")

    # Profile update
    up_res = client.put("/api/users/profile", headers=headers, json={
        "bio": "Updated bio via API test! ✨",
        "gender": "male",
        "is_private": False
    })
    assert up_res.status_code == 200, up_res.text
    print("  ✅ 프로필 정보 수정 성공")

    # Profile Image update & delete
    img_res = client.put("/api/users/profile/image?image_url=https://example.com/new.jpg", headers=headers)
    assert img_res.status_code == 200, img_res.text
    del_img_res = client.delete("/api/users/profile/image", headers=headers)
    assert del_img_res.status_code == 200, del_img_res.text
    print("  ✅ 프로필 사진 변경/삭제 성공")

    # Suggestions & Search
    sug_res = client.get("/api/users/suggestions", headers=headers)
    assert sug_res.status_code == 200, sug_res.text
    assert len(sug_res.json()) > 0
    print(f"  ✅ 유저 추천 목록 성공: {len(sug_res.json())}명")

    srch_res = client.get("/api/users/search?q=cafe")
    assert srch_res.status_code == 200, srch_res.text
    print(f"  ✅ 유저 검색 성공: {len(srch_res.json())}명 검색됨")

    # User Posts / Reels / Saved
    uposts_res = client.get("/api/users/cafe_vibes/posts")
    assert uposts_res.status_code == 200, uposts_res.text
    print(f"  ✅ 유저 게시물 탭 목록 조회 성공: {len(uposts_res.json())}개")

    ureels_res = client.get("/api/users/alex_creator/reels")
    assert ureels_res.status_code == 200, ureels_res.text
    print(f"  ✅ 유저 릴스 탭 목록 조회 성공: {len(ureels_res.json())}개")

    saved_res = client.get("/api/users/saved", headers=headers)
    assert saved_res.status_code == 200, saved_res.text
    print(f"  ✅ 저장됨 탭 목록 조회 성공: {len(saved_res.json())}개")

    # 4. Follows API
    print("\n[4] Follows API 테스트")
    # alex_creator(id=1)가 nature_wanderer(id=4) 팔로우 토글
    fol_res = client.post("/api/follows/4", headers=headers)
    assert fol_res.status_code == 200, fol_res.text
    print(f"  ✅ 팔로우 토글 성공: {fol_res.json()}")

    followers_res = client.get("/api/users/1/followers")
    assert followers_res.status_code == 200, followers_res.text
    print(f"  ✅ 팔로워 목록 조회 성공: {len(followers_res.json())}명")

    following_res = client.get("/api/users/1/following")
    assert following_res.status_code == 200, following_res.text
    print(f"  ✅ 팔로잉 목록 조회 성공: {len(following_res.json())}명")

    # 5. Posts API
    print("\n[5] Posts API 테스트")
    feed_res = client.get("/api/posts/feed?limit=5", headers=headers)
    assert feed_res.status_code == 200, feed_res.text
    assert "items" in feed_res.json()
    print(f"  ✅ 메인 피드 조회 성공: {len(feed_res.json()['items'])}개 게시물")

    # Create post
    new_post_res = client.post("/api/posts", headers=headers, json={
        "caption": "자동화 테스트 게시물입니다! #테스트 🚀",
        "location": "서울 강남구",
        "media_urls": ["https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800"]
    })
    assert new_post_res.status_code == 200, new_post_res.text
    created_post = new_post_res.json()
    post_id = created_post["id"]
    print(f"  ✅ 게시물 생성 성공 (ID: {post_id})")

    # Detail
    detail_res = client.get(f"/api/posts/{post_id}", headers=headers)
    assert detail_res.status_code == 200, detail_res.text
    print("  ✅ 게시물 상세 조회 성공")

    # Like post
    like_res = client.post(f"/api/posts/{post_id}/likes", headers=headers)
    assert like_res.status_code == 200, like_res.text
    assert like_res.json()["liked"] is True
    print(f"  ✅ 게시물 좋아요 토글 성공: {like_res.json()}")

    # Bookmark post
    bm_res = client.post(f"/api/posts/{post_id}/bookmarks", headers=headers)
    assert bm_res.status_code == 200, bm_res.text
    assert bm_res.json()["bookmarked"] is True
    print(f"  ✅ 게시물 북마크 토글 성공: {bm_res.json()}")

    # 6. Comments API
    print("\n[6] Comments API 테스트")
    comment_res = client.post(f"/api/posts/{post_id}/comments", headers=headers, json={
        "content": "정말 멋진 사진이네요! 👍"
    })
    assert comment_res.status_code == 200, comment_res.text
    created_comment = comment_res.json()
    comment_id = created_comment["id"]
    print(f"  ✅ 댓글 작성 성공 (ID: {comment_id})")

    c_list_res = client.get(f"/api/posts/{post_id}/comments", headers=headers)
    assert c_list_res.status_code == 200, c_list_res.text
    assert len(c_list_res.json()) >= 1
    print(f"  ✅ 댓글 목록 조회 성공: {len(c_list_res.json())}개")

    c_like_res = client.post(f"/api/comments/{comment_id}/likes", headers=headers)
    assert c_like_res.status_code == 200, c_like_res.text
    assert c_like_res.json()["liked"] is True
    print("  ✅ 댓글 좋아요 토글 성공")

    del_c_res = client.delete(f"/api/comments/{comment_id}", headers=headers)
    assert del_c_res.status_code == 200, del_c_res.text
    print("  ✅ 댓글 삭제 성공")

    # Clean up test post
    del_p_res = client.delete(f"/api/posts/{post_id}", headers=headers)
    assert del_p_res.status_code == 200, del_p_res.text
    print("  ✅ 게시물 삭제 성공")

    # 7. Reels API
    print("\n[7] Reels API 테스트")
    reels_res = client.get("/api/reels?limit=5", headers=headers)
    assert reels_res.status_code == 200, reels_res.text
    reels_list = reels_res.json()
    assert len(reels_list) > 0
    reel_id = reels_list[0]["id"]
    print(f"  ✅ 릴스 피드 조회 성공: {len(reels_list)}개 릴스 (첫번째 ID: {reel_id})")
    assert "repostsCount" in reels_list[0] or "reposts_count" in reels_list[0]

    # Create reel
    new_reel_res = client.post("/api/reels", headers=headers, json={
        "video_url": "/videos/test.mp4",
        "poster_url": "https://example.com/poster.jpg",
        "caption": "테스트 릴스입니다 ✨",
        "audio_title": "Original Audio • tester"
    })
    assert new_reel_res.status_code == 200, new_reel_res.text
    test_reel_id = new_reel_res.json()["id"]
    print(f"  ✅ 릴스 업로드 성공 (ID: {test_reel_id})")

    # Like reel
    rl_res = client.post(f"/api/reels/{test_reel_id}/likes", headers=headers)
    assert rl_res.status_code == 200, rl_res.text
    assert rl_res.json()["liked"] is True
    print("  ✅ 릴스 좋아요 토글 성공")

    # Bookmark reel
    rb_res = client.post(f"/api/reels/{test_reel_id}/bookmarks", headers=headers)
    assert rb_res.status_code == 200, rb_res.text
    assert rb_res.json()["bookmarked"] is True
    print("  ✅ 릴스 북마크 토글 성공")

    # Comment on reel
    rc_res = client.post(f"/api/reels/{test_reel_id}/comments", headers=headers, json={"content": "힙하네요!"})
    assert rc_res.status_code == 200, rc_res.text
    print("  ✅ 릴스 댓글 작성 성공")

    rc_list = client.get(f"/api/reels/{test_reel_id}/comments", headers=headers)
    assert rc_list.status_code == 200, rc_list.text
    assert len(rc_list.json()) >= 1
    print("  ✅ 릴스 댓글 목록 조회 성공")

    # Share & Repost
    r_share = client.post(f"/api/reels/{test_reel_id}/share")
    assert r_share.status_code == 200, r_share.text
    assert r_share.json()["shares_count"] >= 1
    r_repost = client.post(f"/api/reels/{test_reel_id}/repost", headers=headers)
    assert r_repost.status_code == 200, r_repost.text
    assert r_repost.json()["reposts_count"] >= 1
    print("  ✅ 릴스 공유 및 리포스트 성공")

    # 7-1. Single Reel Detail (새로 추가된 GET /api/reels/{reel_id})
    single_reel_res = client.get(f"/api/reels/{test_reel_id}", headers=headers)
    assert single_reel_res.status_code == 200, single_reel_res.text
    s_reel = single_reel_res.json()
    assert s_reel["id"] == test_reel_id
    assert s_reel.get("isBookmarked", s_reel.get("is_bookmarked")) is True
    print(f"  ✅ 단일 릴스 상세 조회(GET /api/reels/{test_reel_id}) 성공 및 북마크 상태 확인")

    # 7-2. Saved list includes bookmarked reel
    saved_after_reel = client.get("/api/users/saved", headers=headers)
    assert saved_after_reel.status_code == 200, saved_after_reel.text
    saved_items = saved_after_reel.json()
    assert any(
        item.get("id") == test_reel_id or
        any(m.get("mediaType") == "video" or m.get("media_type") == "video" for m in item.get("media", []))
        for item in saved_items
    )
    print(f"  ✅ 저장됨 탭에 북마크된 릴스 포함 확인 ({len(saved_items)}개 저장됨)")

    # 7-3. Content Views (Seen Filter & Not Interested)
    view_res = client.post("/api/views", headers=headers, json={
        "reel_id": test_reel_id,
        "duration_ms": 3500,
        "completed": True,
        "not_interested": False,
        "source": "reels"
    })
    assert view_res.status_code in (200, 201), view_res.text
    print("  ✅ 시청 이력(POST /api/views) 기록 성공")

    # 8. Explore API
    print("\n[8] Explore API 테스트")
    exp_res = client.get("/api/explore?limit=12")
    assert exp_res.status_code == 200, exp_res.text
    assert len(exp_res.json()) > 0
    print(f"  ✅ 탐색 그리드 조회 성공: {len(exp_res.json())}개 아이템")

    exp_q_res = client.get("/api/explore?q=카페")
    assert exp_q_res.status_code == 200, exp_q_res.text
    print(f"  ✅ 탐색 키워드 검색 성공: {len(exp_q_res.json())}개 검색됨")

    # 9. Direct API
    print("\n[9] Direct API 테스트")
    # Get conversations
    convs_res = client.get("/api/direct/conversations", headers=headers)
    assert convs_res.status_code == 200, convs_res.text
    convs = convs_res.json()
    print(f"  ✅ 대화방 목록 조회 성공: {len(convs)}개")

    # Create or get conversation with user 2 (cafe_vibes)
    c_create_res = client.post("/api/direct/conversations", headers=headers, json={"target_user_id": 2})
    assert c_create_res.status_code == 200, c_create_res.text
    conv_id = c_create_res.json()["id"]
    print(f"  ✅ 대화방 생성/조회 성공: {conv_id}")

    # Send message
    msg_res = client.post(f"/api/direct/conversations/{conv_id}/messages", headers=headers, json={
        "text": "안녕하세요! 자동화 테스트 메시지입니다 ✨"
    })
    assert msg_res.status_code == 200, msg_res.text
    msg_id = msg_res.json()["id"]
    print(f"  ✅ 메시지 전송 성공 (ID: {msg_id})")

    # Get messages
    msgs_res = client.get(f"/api/direct/conversations/{conv_id}/messages", headers=headers)
    assert msgs_res.status_code == 200, msgs_res.text
    print(f"  ✅ 메시지 타임라인 조회 성공: {len(msgs_res.json())}개")

    # Mark as read
    read_res = client.post(f"/api/direct/conversations/{conv_id}/read", headers=headers)
    assert read_res.status_code == 200, read_res.text
    print("  ✅ 대화방 읽음 처리 성공")

    # Toggle reaction
    rx_res = client.post(f"/api/direct/messages/{msg_id}/reactions", headers=headers, json={"reaction": "❤️"})
    assert rx_res.status_code == 200, rx_res.text
    assert "❤️" in rx_res.json()["reactions"]
    print("  ✅ 메시지 하트 반응 토글 성공")

    # 10. Stories API
    print("\n[10] Stories API 테스트")
    tray_res = client.get("/api/stories/feed", headers=headers)
    assert tray_res.status_code == 200, tray_res.text
    print(f"  ✅ 스토리 트레이 피드 조회 성공: {len(tray_res.json())}명")

    # Upload story
    story_upload = client.post("/api/stories?media_url=https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800", headers=headers)
    assert story_upload.status_code == 200, story_upload.text
    s_id = story_upload.json()["id"]
    print(f"  ✅ 스토리 업로드 성공 (ID: {s_id})")

    # View story
    view_res = client.post(f"/api/stories/{s_id}/view", headers=headers)
    assert view_res.status_code == 200, view_res.text
    print("  ✅ 스토리 시청 완료 기록 성공")

    # Highlights
    hl_res = client.get("/api/users/cafe_vibes/highlights")
    assert hl_res.status_code == 200, hl_res.text
    print(f"  ✅ 스토리 하이라이트 조회 성공: {len(hl_res.json())}개")

    # 11. Notifications API
    print("\n[11] Notifications API 테스트")
    notif_res = client.get("/api/notifications", headers=headers)
    assert notif_res.status_code == 200, notif_res.text
    notifs = notif_res.json()
    print(f"  ✅ 알림 목록 조회 성공: {len(notifs)}개")
    if notifs:
        nid = notifs[0]["id"]
        rn_res = client.put(f"/api/notifications/{nid}/read", headers=headers)
        assert rn_res.status_code == 200, rn_res.text
        print(f"  ✅ 단일 알림 읽음 처리 성공 (ID: {nid})")

    ra_res = client.put("/api/notifications/read-all", headers=headers)
    assert ra_res.status_code == 200, ra_res.text
    print("  ✅ 전체 알림 일괄 읽음 처리 성공")

    # 12. Uploads API (JPEG 매직 바이트 검증 통과)
    print("\n[12] Uploads API 테스트")
    # 표준 JPEG SOI + JFIF 헤더
    valid_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\xff\xd9"
    dummy_file = ("test.jpg", valid_jpeg, "image/jpeg")
    upload_res = client.post(
        "/api/uploads/media",
        files={"file": dummy_file},
        data={"category": "posts"},
        headers=headers
    )
    assert upload_res.status_code == 200, upload_res.text
    up_data = upload_res.json()
    assert "url" in up_data
    assert up_data["media_type"] == "image"
    print(f"  ✅ 파일 업로드 성공: {up_data['url']}")

    # 13. Reports API (일반 신고 등록)
    print("\n[13] Reports API 테스트")
    report_res = client.post("/api/reports", headers=headers, json={
        "target_type": "reel",
        "target_id": test_reel_id,
        "reason": "자동화 테스트 신고 건입니다.",
        "details": "테스트 상세 내용"
    })
    assert report_res.status_code in (201, 409), report_res.text
    print("  ✅ 신고 등록(POST /api/reports) 성공 또는 기접수 확인")

    # Clean up test reel
    del_r = client.delete(f"/api/reels/{test_reel_id}", headers=headers)
    assert del_r.status_code == 200, del_r.text
    print("  ✅ 테스트 릴스 삭제 정리 성공")

    print("\n==================================================================")
    print("🎉 ALL API DOMAINS PASSED 100% SUCCESSFULLY!")
    print("==================================================================")

if __name__ == "__main__":
    run_tests()
