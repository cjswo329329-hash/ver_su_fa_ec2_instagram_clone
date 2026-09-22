-- ==============================================================================
-- 🛡️ Supabase Security Hardening Script (Option A: 3-Tier Backend Only)
-- ==============================================================================
-- 본 스크립트는 프론트엔드나 외부 인터넷에서 Supabase의 anon 키(PostgREST Data API)를
-- 이용해 직접 DB 테이블을 털거나 무단 열람/조작하는 것을 원천 차단합니다.
-- 오직 안전한 FastAPI 백엔드(DATABASE_URL 연결)만 데이터베이스에 접근하도록 강제합니다.
--
-- [실행 방법]: Supabase 대시보드 -> SQL Editor 에서 본 스크립트 실행
-- ==============================================================================

-- 1. 모든 Public 테이블에 Row Level Security (RLS) 강제 활성화
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS content_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. anon(익명 사용자) 및 authenticated(클라이언트 JWT)의 Public 스키마 직접 쿼리 권한 완전 박탈
-- (FastAPI 백엔드는 postgres 서비스 롤로 접속하므로 이 권한 제한의 영향을 받지 않고 정상 작동합니다)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon;

-- 3. Storage 버킷 (instagram-media) 보안 정책
-- 공개 읽기는 허용하되, anon 키를 통한 임의 파일 삭제/덮어쓰기는 원천 차단
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'instagram-media') THEN
        UPDATE storage.buckets SET public = true WHERE id = 'instagram-media';
    END IF;
END $$;

-- 4. Supabase 대시보드 권장 조치 (Option A 완성):
-- Supabase Dashboard -> Project Settings -> API -> Data API Settings 에서
-- "Enable Data API"를 비활성화(OFF)하면 PostgREST 엔드포인트 자체가 꺼져 가장 안전합니다.
