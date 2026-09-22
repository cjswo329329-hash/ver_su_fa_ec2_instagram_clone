import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { postApi } from '../services';
import { PostCard } from '../components/feed/PostCard';

export const PostDetailPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const id = parseInt(postId, 10);
        if (isNaN(id)) {
          throw new Error('유효하지 않은 게시물 ID입니다.');
        }
        const data = await postApi.getPostDetail(id);
        if (isMounted) {
          setPost(data);
        }
      } catch (err) {
        console.error('Failed to load post detail:', err);
        if (isMounted) {
          setError(err.response?.data?.detail || '게시물을 찾을 수 없습니다.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (postId) {
      fetchPost();
    }
    return () => {
      isMounted = false;
    };
  }, [postId]);

  return (
    <div
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '20px 16px 60px',
        width: '100%',
      }}
    >
      {/* Header bar with Back button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-primary)',
            fontSize: '15px',
            fontWeight: 600,
            padding: '6px 8px',
            borderRadius: '8px',
          }}
          title="뒤로가기"
        >
          <ArrowLeft size={20} />
          <span>뒤로</span>
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          게시물
        </h1>
      </div>

      {/* Content state */}
      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--ig-primary-button)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <p style={{ fontSize: '14px' }}>게시물을 불러오는 중...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-elevated)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
          }}
        >
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>
            게시물을 볼 수 없습니다
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '8px 20px',
              backgroundColor: 'var(--ig-primary-button)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            홈으로 이동
          </button>
        </div>
      )}

      {!loading && !error && post && (
        <div style={{ backgroundColor: 'var(--bg-primary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <PostCard post={post} />
        </div>
      )}
    </div>
  );
};

export default PostDetailPage;
