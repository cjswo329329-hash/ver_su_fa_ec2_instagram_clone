import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Smile, X, Heart } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Avatar } from '../common/Avatar';
import { MediaCarousel } from '../feed/MediaCarousel';
import { PostActions } from '../feed/PostActions';
import { useModal } from '../../contexts/ModalContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { postApi, followApi, reelApi } from '../../services';

export const PostDetailModal = () => {
  const {
    activePostDetail,
    closePostDetail,
    focusCommentOnDetail,
    setFocusCommentOnDetail,
    toggleLikePost,
    toggleBookmarkPost,
    addCommentToPost,
    openOptions,
    fetchFeed
  } = useModal();
  const { user, requireAuth } = useAuthGuard();
  const navigate = useNavigate();

  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null); // { commentId: number, username: string }
  const [expandedReplies, setExpandedReplies] = useState(new Set()); // Set of parent comment IDs
  const [submitting, setSubmitting] = useState(false);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const inputRef = useRef(null);

  const post = activePostDetail;

  const isReel = Boolean(
    post?.isVideo ||
    post?.is_video ||
    post?.category === 'reel' ||
    post?.media?.[0]?.media_type === 'video'
  );

  // Sync author follow status
  useEffect(() => {
    if (post?.author) {
      setIsFollowingAuthor(!!(post.author.is_following || post.author.isFollowing));
    }
  }, [post?.author?.id, post?.author?.is_following, post?.author?.isFollowing]);

  // Auto-focus comment input if opened with focusComment
  useEffect(() => {
    if (activePostDetail && focusCommentOnDetail) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        if (setFocusCommentOnDetail) setFocusCommentOnDetail(false);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activePostDetail, focusCommentOnDetail, setFocusCommentOnDetail]);

  const handleToggleFollowAuthor = async () => {
    requireAuth(async () => {
      if (!post?.author?.id) return;
      const prev = isFollowingAuthor;
      setIsFollowingAuthor(!prev);
      try {
        const res = await followApi.toggleFollow(post.author.id);
        setIsFollowingAuthor(res.following);
        if (fetchFeed) fetchFeed();
      } catch (err) {
        setIsFollowingAuthor(prev);
        console.error('Failed to toggle follow author:', err);
      }
    }, { actionType: 'follow' });
  };

  const handleNavigateToUser = (targetUsername) => {
    if (!targetUsername) return;
    closePostDetail();
    navigate(`/${targetUsername}`);
  };

  // 댓글 및 대댓글 실시간 로드 (릴스 vs 일반 포스트 분기)
  const loadComments = async (targetPost) => {
    if (!targetPost?.id) return;
    const isVideoReel = Boolean(
      targetPost.isVideo ||
      targetPost.is_video ||
      targetPost.category === 'reel' ||
      targetPost.media?.[0]?.media_type === 'video'
    );
    try {
      const data = isVideoReel
        ? await reelApi.getReelComments(targetPost.id)
        : await postApi.getComments(targetPost.id);
      if (Array.isArray(data)) {
        setCommentsList(data);
      }
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  useEffect(() => {
    // 새 게시물이 열리거나 전환될 때 이전 게시물의 댓글 잔존 및 증발 현상 방지
    const initialComments = Array.isArray(post?.comments) ? post.comments : [];
    setCommentsList(initialComments);
    setReplyingTo(null);
    setExpandedReplies(new Set());

    if (!post?.id) return;

    let isCancelled = false;
    const isVideoReel = Boolean(
      post.isVideo ||
      post.is_video ||
      post.category === 'reel' ||
      post.media?.[0]?.media_type === 'video'
    );

    const fetchComments = async () => {
      try {
        const data = isVideoReel
          ? await reelApi.getReelComments(post.id)
          : await postApi.getComments(post.id);
        if (!isCancelled && Array.isArray(data)) {
          setCommentsList(data);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load comments:', err);
        }
      }
    };

    fetchComments();

    return () => {
      isCancelled = true;
    };
  }, [post?.id, post?.isVideo, post?.is_video]);

  if (!activePostDetail) return null;

  const mediaList = post.media || (post.mediaUrl ? [{ mediaUrl: post.mediaUrl }] : []);

  const handleStartReply = (comment) => {
    requireAuth(() => {
      const username = comment.author?.username || comment.username;
      setReplyingTo({
        commentId: comment.id,
        username: username
      });
      setCommentText(`@${username} `);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, { actionType: 'comment' });
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setCommentText('');
  };

  const toggleRepliesVisibility = (commentId) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const handleToggleCommentLike = async (commentId) => {
    requireAuth(async () => {
      try {
        const res = await postApi.toggleCommentLike(commentId);
        // 상태 즉시 업데이트
        setCommentsList(prev =>
          prev.map(c => {
            if (c.id === commentId) {
              return { ...c, is_liked: res.liked, likes_count: res.likes_count };
            }
            if (c.replies && c.replies.length > 0) {
              const updatedReplies = c.replies.map(r => {
                if (r.id === commentId) {
                  return { ...r, is_liked: res.liked, likes_count: res.likes_count };
                }
                return r;
              });
              return { ...c, replies: updatedReplies };
            }
            return c;
          })
        );
      } catch (err) {
        console.error('Failed to toggle comment like:', err);
      }
    }, { actionType: 'like' });
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    requireAuth(async () => {
      const trimmed = commentText.trim();
      if (!trimmed || submitting) return;

      const parentId = replyingTo ? replyingTo.commentId : null;

      // 1. 즉시(0ms) 입력창 초기화 및 답글 배너 해제 (즉각 반응)
      setCommentText('');
      setReplyingTo(null);
      if (parentId) {
        setExpandedReplies(prev => new Set(prev).add(parentId));
      }

      // 2. 즉시(0ms) 낙관적 UI(Optimistic Update)로 댓글 목록에 바로 렌더링
      const tempId = Date.now();
      const optimisticComment = {
        id: tempId,
        content: trimmed,
        text: trimmed,
        created_at: new Date().toISOString(),
        timeAgo: '방금 전',
        likes_count: 0,
        is_liked: false,
        parent_id: parentId,
        author: {
          id: user?.id,
          username: user?.username || 'me',
          profile_image_url: user?.profile_image_url || user?.profileImageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
          profileImageUrl: user?.profile_image_url || user?.profileImageUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
        },
        username: user?.username || 'me',
        replies: [],
        replies_count: 0,
      };

      setCommentsList(prev => {
        if (parentId) {
          return prev.map(c => {
            if (c.id === parentId) {
              const prevReplies = c.replies || [];
              return {
                ...c,
                replies_count: (c.replies_count || prevReplies.length) + 1,
                replies: [...prevReplies, optimisticComment]
              };
            }
            return c;
          });
        }
        return [...prev, optimisticComment];
      });

      // 3. 백엔드 비동기 통신
      setSubmitting(true);
      try {
        const savedComment = await addCommentToPost(post.id, user, trimmed, parentId, isReel);
        if (savedComment?.id) {
          // 서버에서 발급된 실제 ID로 매끄럽게 교체
          setCommentsList(prev => {
            if (parentId) {
              return prev.map(c => {
                if (c.id === parentId) {
                  return {
                    ...c,
                    replies: (c.replies || []).map(r => r.id === tempId ? { ...r, id: savedComment.id } : r)
                  };
                }
                return c;
              });
            }
            return prev.map(c => c.id === tempId ? { ...c, id: savedComment.id } : c);
          });
        }
      } catch (err) {
        console.error('Comment submit error:', err);
        // 실패 시 롤백 및 입력 텍스트 복구
        setCommentsList(prev => {
          if (parentId) {
            return prev.map(c => {
              if (c.id === parentId) {
                return {
                  ...c,
                  replies_count: Math.max(0, (c.replies_count || 1) - 1),
                  replies: (c.replies || []).filter(r => r.id !== tempId)
                };
              }
              return c;
            });
          }
          return prev.filter(c => c.id !== tempId);
        });
        setCommentText(trimmed);
      } finally {
        setSubmitting(false);
      }
    }, { actionType: 'comment' });
  };

  // 최상위 댓글 + 대댓글 전체 합산 개수 (백엔드 카운트와 100% 일치 보장)
  const totalCommentsCount = commentsList.reduce((acc, c) => {
    const repCount = c.replies?.length ?? c.replies_count ?? 0;
    return acc + 1 + repCount;
  }, 0);

  return (
    <Modal
      isOpen={!!activePostDetail}
      onClose={closePostDetail}
      maxWidth="1050px"
      width="95%"
      style={{
        maxHeight: '92vh',
        height: 'min(720px, 92vh)',
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: 'var(--bg-primary)',
      }}
      showCloseButton={true}
    >
      <div style={{ display: 'flex', width: '100%', height: '100%' }} className="post-detail-modal-body">
        {/* Left Media Area */}
        <div
          style={{
            flex: '1.25',
            height: '100%',
            backgroundColor: '#000000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
          className="post-detail-media-container"
        >
          <MediaCarousel
            media={mediaList}
            onDoubleTap={() => requireAuth(() => toggleLikePost(post.id), { actionType: 'like' })}
            fillContainer={true}
          />
        </div>

        {/* Right Info & Comments Panel */}
        <div
          style={{
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            borderLeft: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-elevated)',
            minWidth: 0,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <Avatar
                src={post.author?.profileImageUrl || post.author?.profile_image_url}
                size="sm"
                onClick={() => handleNavigateToUser(post.author?.username)}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    onClick={() => handleNavigateToUser(post.author?.username)}
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                    }}
                  >
                    {post.author?.username}
                  </span>

                  {user?.id !== post.author?.id && (
                    <>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>•</span>
                      <button
                        type="button"
                        onClick={handleToggleFollowAuthor}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: isFollowingAuthor ? 'var(--text-secondary)' : '#0095f6',
                          fontWeight: 600,
                          fontSize: '14px',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        {isFollowingAuthor ? '팔로잉' : '팔로우'}
                      </button>
                    </>
                  )}
                </div>
                {post.location && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {post.location}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => openOptions(post)}
              style={{ color: 'var(--text-primary)', padding: '4px', background: 'none', border: 'none', cursor: 'pointer' }}
              aria-label="More options"
            >
              <MoreHorizontal size={20} />
            </button>
          </div>

          {/* Comments & Caption Scrollable Stream */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            {/* Author Caption */}
            {post.caption && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <Avatar
                  src={post.author?.profileImageUrl || post.author?.profile_image_url}
                  size="sm"
                  onClick={() => handleNavigateToUser(post.author?.username)}
                  style={{ cursor: 'pointer' }}
                />
                <div style={{ fontSize: '14px', lineHeight: 1.45, flex: 1, minWidth: 0 }}>
                  <span
                    onClick={() => handleNavigateToUser(post.author?.username)}
                    style={{ fontWeight: 600, marginRight: '8px', cursor: 'pointer', color: 'var(--text-primary)' }}
                  >
                    {post.author?.username}
                  </span>
                  <span style={{ whiteSpace: 'pre-line', color: 'var(--text-primary)' }}>{post.caption}</span>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {post.timeAgo || '1일 전'}
                  </div>
                </div>
              </div>
            )}

            {/* Comments List (with nested replies) */}
            {commentsList.map((comment) => {
              const username = comment.author?.username || comment.username;
              const profileImg = comment.author?.profileImageUrl || comment.author?.profile_image_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
              const replies = comment.replies || [];
              const repliesCount = comment.replies_count || replies.length;
              const isRepliesExpanded = expandedReplies.has(comment.id);

              return (
                <div key={comment.id} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Root Comment Row */}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <Avatar
                      src={profileImg}
                      size="sm"
                      onClick={() => handleNavigateToUser(username)}
                      style={{ cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, fontSize: '14px', lineHeight: 1.45, minWidth: 0 }}>
                      <div>
                        <span
                          onClick={() => handleNavigateToUser(username)}
                          style={{ fontWeight: 600, marginRight: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}
                        >
                          {username}
                        </span>
                        <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                          {comment.content || comment.text}
                        </span>
                      </div>

                      {/* Comment Meta & Actions */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          marginTop: '4px',
                        }}
                      >
                        <span>{comment.timeAgo || '방금 전'}</span>
                        {comment.likes_count > 0 && (
                          <span style={{ fontWeight: 600 }}>좋아요 {comment.likes_count}개</span>
                        )}
                        <button
                          onClick={() => handleStartReply(comment)}
                          style={{
                            color: 'var(--text-muted)',
                            fontWeight: 600,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          답글 달기
                        </button>
                      </div>

                      {/* View / Hide Replies Toggle Button */}
                      {repliesCount > 0 && (
                        <button
                          onClick={() => toggleRepliesVisibility(comment.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            color: 'var(--text-secondary)',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            marginTop: '10px',
                            padding: 0,
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-block',
                              width: '24px',
                              height: '1px',
                              backgroundColor: 'var(--border-color)',
                            }}
                          />
                          {isRepliesExpanded
                            ? '답글 숨기기'
                            : `답글 보기(${repliesCount}개)`}
                        </button>
                      )}
                    </div>

                    {/* Comment Heart Like Button */}
                    <button
                      onClick={() => handleToggleCommentLike(comment.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        color: comment.is_liked ? '#ed4956' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      aria-label="Like comment"
                    >
                      <Heart
                        size={12}
                        fill={comment.is_liked ? '#ed4956' : 'none'}
                        color={comment.is_liked ? '#ed4956' : 'currentColor'}
                      />
                    </button>
                  </div>

                  {/* Nested Replies Stream (Indented) */}
                  {isRepliesExpanded && replies.length > 0 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        marginTop: '12px',
                        paddingLeft: '44px',
                      }}
                    >
                      {replies.map((reply) => {
                        const replyUsername = reply.author?.username || reply.username;
                        const replyImg = reply.author?.profileImageUrl || reply.author?.profile_image_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';

                        return (
                          <div
                            key={reply.id}
                            style={{
                              display: 'flex',
                              gap: '10px',
                              alignItems: 'flex-start',
                            }}
                          >
                            <Avatar
                              src={replyImg}
                              size="xs"
                              onClick={() => handleNavigateToUser(replyUsername)}
                              style={{ cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1, fontSize: '13px', lineHeight: 1.45, minWidth: 0 }}>
                              <div>
                                <span
                                  onClick={() => handleNavigateToUser(replyUsername)}
                                  style={{ fontWeight: 600, marginRight: '8px', color: 'var(--text-primary)', cursor: 'pointer' }}
                                >
                                  {replyUsername}
                                </span>
                                <span style={{ color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                                  {reply.content || reply.text}
                                </span>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  fontSize: '11px',
                                  color: 'var(--text-muted)',
                                  marginTop: '4px',
                                }}
                              >
                                <span>{reply.timeAgo || '방금 전'}</span>
                                {reply.likes_count > 0 && (
                                  <span style={{ fontWeight: 600 }}>좋아요 {reply.likes_count}개</span>
                                )}
                                <button
                                  onClick={() => handleStartReply({ ...reply, id: comment.id, username: replyUsername })}
                                  style={{
                                    color: 'var(--text-muted)',
                                    fontWeight: 600,
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  답글 달기
                                </button>
                              </div>
                            </div>

                            {/* Reply Heart Like Button */}
                            <button
                              onClick={() => handleToggleCommentLike(reply.id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: reply.is_liked ? '#ed4956' : 'var(--text-muted)',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              aria-label="Like reply"
                            >
                              <Heart
                                size={11}
                                fill={reply.is_liked ? '#ed4956' : 'none'}
                                color={reply.is_liked ? '#ed4956' : 'currentColor'}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action Bar & Stats */}
          <div style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
            <PostActions
              isLiked={post.isLiked ?? post.is_liked ?? false}
              isBookmarked={post.isBookmarked ?? post.is_bookmarked ?? false}
              likesCount={post.likesCount ?? post.likes_count ?? 0}
              commentsCount={commentsList.length > 0 ? totalCommentsCount : (post.commentsCount ?? post.comments_count ?? 0)}
              showCounts={true}
              onLike={() => requireAuth(() => toggleLikePost(post.id), { actionType: 'like' })}
              onComment={() => inputRef.current?.focus()}
              onBookmark={() => requireAuth(() => toggleBookmarkPost(post.id, isReel), { actionType: 'bookmark' })}
            />

            <div style={{ padding: '0 16px 10px 16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {post.timeAgo || '방금 전'}
              </div>
            </div>

            {/* Replying Banner */}
            {replyingTo && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 16px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  <strong>@{replyingTo.username}</strong> 님에게 답글 남기는 중
                </span>
                <button
                  type="button"
                  onClick={handleCancelReply}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  aria-label="Cancel reply"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Comment Form */}
            <form
              onSubmit={handleAddComment}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  requireAuth(() => {}, { actionType: 'comment' });
                }}
                style={{ color: 'var(--text-secondary)', marginRight: '10px', background: 'transparent', border: 'none', cursor: 'pointer' }}
                aria-label="Emoji picker"
              >
                <Smile size={24} />
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder={
                  replyingTo
                    ? `@${replyingTo.username}님에게 답글 달기...`
                    : user
                    ? "댓글 달기..."
                    : "로그인 후 댓글을 남겨보세요..."
                }
                value={commentText}
                onFocus={(e) => {
                  if (!user) {
                    e.target.blur();
                    requireAuth(() => {}, { actionType: 'comment' });
                  }
                }}
                onClick={() => {
                  if (!user) {
                    requireAuth(() => {}, { actionType: 'comment' });
                  }
                }}
                onChange={(e) => setCommentText(e.target.value)}
                style={{
                  flex: 1,
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={submitting || (user && !commentText.trim())}
                style={{
                  color: (!user || commentText.trim()) ? 'var(--ig-primary-button)' : 'var(--text-muted)',
                  fontWeight: 600,
                  fontSize: '14px',
                  marginLeft: '8px',
                  cursor: (!user || commentText.trim()) ? 'pointer' : 'default',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              >
                {replyingTo ? '답글' : '게시'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .post-detail-modal-body {
            flex-direction: column !important;
            overflow-y: auto !important;
          }
          .post-detail-media-container {
            height: 380px !important;
            flex: none !important;
          }
        }
      `}</style>
    </Modal>
  );
};

export default PostDetailModal;
