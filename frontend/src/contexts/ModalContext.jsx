import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initialPosts, initialStories, initialExplorePosts } from '../data/mockData';
import { postApi, storyApi, exploreApi, reelApi } from '../services';
import { useAuth } from './AuthContext';

const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
  const { user } = useAuth();

  const [posts, setPosts] = useState(() => {
    return initialPosts.map(p => ({ ...p, isLiked: false, isBookmarked: false }));
  });

  const [stories, setStories] = useState([]);
  const [storiesLoading, setStoriesLoading] = useState(true);

  const [explorePosts, setExplorePosts] = useState([]);

  const [feedLoading, setFeedLoading] = useState(false);
  const [feedCursor, setFeedCursor] = useState(null);
  const [hasMoreFeed, setHasMoreFeed] = useState(true);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);

  const normalizePost = (item) => ({
    ...item,
    isBookmarked: item.is_bookmarked ?? item.isBookmarked ?? false,
    is_bookmarked: item.is_bookmarked ?? item.isBookmarked ?? false,
    isLiked: item.is_liked ?? item.isLiked ?? false,
    is_liked: item.is_liked ?? item.isLiked ?? false,
    likesCount: item.likes_count ?? item.likesCount ?? 0,
    likes_count: item.likes_count ?? item.likesCount ?? 0,
    commentsCount: item.comments_count ?? item.commentsCount ?? (item.comments?.length || 0),
    comments_count: item.comments_count ?? item.commentsCount ?? (item.comments?.length || 0),
  });

  // Fetch real feed from backend
  const fetchFeed = useCallback(async () => {
    try {
      setFeedLoading(true);
      const res = await postApi.getFeed(10);
      if (res && Array.isArray(res.items)) {
        setPosts(res.items.map(normalizePost));
        setFeedCursor(res.next_cursor);
        setHasMoreFeed(res.has_more);
      }
    } catch (err) {
      console.warn('Could not fetch feed from backend, using default initial:', err);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  // Fetch more feed for infinite scroll
  const loadMoreFeed = useCallback(async () => {
    if (!hasMoreFeed || loadingMoreFeed || !feedCursor) return;
    try {
      setLoadingMoreFeed(true);
      const res = await postApi.getFeed(10, feedCursor);
      if (res && res.items && res.items.length > 0) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = res.items.map(normalizePost).filter(p => !existingIds.has(p.id));
          return [...prev, ...newItems];
        });
        setFeedCursor(res.next_cursor);
        setHasMoreFeed(res.has_more);
      } else {
        setHasMoreFeed(false);
      }
    } catch (err) {
      console.warn('Failed to load more feed:', err);
    } finally {
      setLoadingMoreFeed(false);
    }
  }, [hasMoreFeed, loadingMoreFeed, feedCursor]);

  // Fetch real stories from backend
  const fetchStories = useCallback(async () => {
    try {
      setStoriesLoading(true);
      const res = await storyApi.getStoriesFeed();
      if (res && Array.isArray(res)) {
        const normalized = res.map(item => ({
          userId: item.user?.id || item.userId,
          username: item.user?.username || item.username,
          fullName: item.user?.full_name || item.fullName,
          profileImage: item.user?.profile_image_url || item.user?.profileImageUrl || item.profileImage,
          hasUnseen: item.has_unseen ?? item.hasUnseen ?? true,
          stories: (item.stories || []).map(st => ({
            id: st.id,
            mediaUrl: st.media_url || st.mediaUrl,
            mediaType: st.media_type || st.mediaType || 'image',
            createdAt: st.created_at || st.createdAt,
            timeAgo: st.timeAgo || '방금 전',
            isViewed: st.is_viewed ?? st.isViewed ?? false
          }))
        }));
        setStories(normalized);
        localStorage.setItem('ig_stories', JSON.stringify(normalized));
      }
    } catch (err) {
      console.warn('Could not fetch stories from backend:', err);
    } finally {
      setStoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    // 사용자 로그인/로그아웃/계정 전환 시 피드 및 스토리 최신 상태 갱신
    fetchFeed();
    fetchStories();
  }, [user, fetchFeed, fetchStories]);

  useEffect(() => {
    localStorage.setItem('ig_stories', JSON.stringify(stories));
  }, [stories]);

  useEffect(() => {
    localStorage.setItem('ig_explore_posts_v3', JSON.stringify(explorePosts));
  }, [explorePosts]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateStoryOpen, setIsCreateStoryOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeStory, setActiveStory] = useState(null); // { userId, initialIndex }
  const [activePostDetail, setActivePostDetail] = useState(null); // post object or id
  const [focusCommentOnDetail, setFocusCommentOnDetail] = useState(false);
  const [activeOptionsPost, setActiveOptionsPost] = useState(null);
  const [isAuthPromptOpen, setIsAuthPromptOpen] = useState(false);
  const [authPromptConfig, setAuthPromptConfig] = useState(null);

  const openAuthPromptModal = (config = {}) => {
    setAuthPromptConfig(config);
    setIsAuthPromptOpen(true);
  };
  const closeAuthPromptModal = () => {
    setIsAuthPromptOpen(false);
    setAuthPromptConfig(null);
  };

  const openCreatePost = () => setIsCreateOpen(true);
  const closeCreatePost = () => setIsCreateOpen(false);

  const openCreateStory = () => setIsCreateStoryOpen(true);
  const closeCreateStory = () => setIsCreateStoryOpen(false);

  const openNotifications = () => setIsNotificationsOpen(true);
  const closeNotifications = () => setIsNotificationsOpen(false);

  const openStoryViewer = (userStory, initialIndex = 0) => {
    setActiveStory({ ...userStory, initialIndex });
  };
  const closeStoryViewer = () => setActiveStory(null);

  // Mark a story item as viewed (sync with backend and local state)
  const markStoryViewed = useCallback(async (userId, storyId) => {
    if (!storyId) return;

    // 1. Optimistically update stories array and local storage
    setStories(prevStories => {
      const updated = prevStories.map(userStory => {
        const isTarget = (userStory.userId && userId && String(userStory.userId) === String(userId)) ||
                         (userStory.username && userStory.username === userId);
        if (!isTarget) return userStory;

        const updatedStories = (userStory.stories || []).map(st => {
          if (st.id === storyId) {
            return { ...st, isViewed: true };
          }
          return st;
        });

        const hasUnseen = updatedStories.some(st => !st.isViewed);

        return {
          ...userStory,
          stories: updatedStories,
          hasUnseen,
        };
      });

      localStorage.setItem('ig_stories', JSON.stringify(updated));
      return updated;
    });

    // 2. Also update activeStory in-place if currently active
    setActiveStory(prev => {
      if (!prev) return prev;
      const isTarget = (prev.userId && userId && String(prev.userId) === String(userId)) ||
                       (prev.username && prev.username === userId);
      if (!isTarget) return prev;

      const updatedStories = (prev.stories || []).map(st => {
        if (st.id === storyId) {
          return { ...st, isViewed: true };
        }
        return st;
      });

      return {
        ...prev,
        stories: updatedStories,
        hasUnseen: updatedStories.some(st => !st.isViewed),
      };
    });

    // 3. Call backend API to record view in database
    try {
      await storyApi.viewStory(storyId);
    } catch (err) {
      console.warn('Could not record story view on backend:', err);
    }
  }, []);

  const openPostDetail = (post, options = {}) => {
    setActivePostDetail(post ? normalizePost(post) : null);
    setFocusCommentOnDetail(!!options?.focusComment);
  };
  const closePostDetail = () => {
    setActivePostDetail(null);
    setFocusCommentOnDetail(false);
  };

  const openOptions = (post) => setActiveOptionsPost(post);
  const closeOptions = () => setActiveOptionsPost(null);

  // Global Actions for posts with backend synchronization
  const toggleLikePost = async (postId) => {
    // 1. 현재 게시물의 대상 객체 및 좋아요 상태를 동기적으로 정확히 산출
    const targetPost = (activePostDetail && activePostDetail.id === postId)
      ? activePostDetail
      : posts.find(p => p.id === postId);

    const currentIsLiked = Boolean(targetPost?.isLiked ?? targetPost?.is_liked ?? false);
    const currentLikesCount = Number(targetPost?.likesCount ?? targetPost?.likes_count ?? 0);

    const nextIsLiked = !currentIsLiked;
    const nextLikesCount = nextIsLiked ? currentLikesCount + 1 : Math.max(0, currentLikesCount - 1);

    const targetIsVideo = Boolean(
      targetPost?.isVideo ||
      targetPost?.is_video ||
      targetPost?.category === 'reel' ||
      targetPost?.media?.[0]?.media_type === 'video'
    );

    // 2. 피드(posts) 상태 즉시 낙관적 업데이트
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            isLiked: nextIsLiked,
            is_liked: nextIsLiked,
            likesCount: nextLikesCount,
            likes_count: nextLikesCount
          };
        }
        return p;
      })
    );

    // 3. 활성 모달(activePostDetail) 상태 즉시 낙관적 업데이트
    setActivePostDetail(prev => {
      if (prev && prev.id === postId) {
        return {
          ...prev,
          isLiked: nextIsLiked,
          is_liked: nextIsLiked,
          likesCount: nextLikesCount,
          likes_count: nextLikesCount
        };
      }
      return prev;
    });

    // 4. 탐색(Explore) 및 기타 뷰에 즉시 동기화 브로드캐스트
    window.dispatchEvent(new CustomEvent('ig_post_activity', {
      detail: { postId, isVideo: targetIsVideo, isLiked: nextIsLiked, likesCount: nextLikesCount }
    }));

    try {
      const res = targetIsVideo
        ? await reelApi.toggleReelLike(postId)
        : await postApi.togglePostLike(postId);
      // Sync actual likes_count if returned
      if (res && typeof res.likes_count === 'number') {
        const confirmedLiked = res.liked;
        const confirmedCount = res.likes_count;
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, isLiked: confirmedLiked, is_liked: confirmedLiked, likesCount: confirmedCount, likes_count: confirmedCount } : p));
        setActivePostDetail(prev => prev && prev.id === postId ? { ...prev, isLiked: confirmedLiked, is_liked: confirmedLiked, likesCount: confirmedCount, likes_count: confirmedCount } : prev);
        window.dispatchEvent(new CustomEvent('ig_post_activity', {
          detail: { postId, isVideo: targetIsVideo, isLiked: confirmedLiked, likesCount: confirmedCount }
        }));
      }
    } catch (err) {
      console.error('Failed to toggle like on backend:', err);
      // Rollback
      setPosts(prev =>
        prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              isLiked: currentIsLiked,
              is_liked: currentIsLiked,
              likesCount: currentLikesCount,
              likes_count: currentLikesCount
            };
          }
          return p;
        })
      );
      setActivePostDetail(prev => {
        if (prev && prev.id === postId) {
          return {
            ...prev,
            isLiked: currentIsLiked,
            is_liked: currentIsLiked,
            likesCount: currentLikesCount,
            likes_count: currentLikesCount
          };
        }
        return prev;
      });
      window.dispatchEvent(new CustomEvent('ig_post_activity', {
        detail: { postId, isVideo: targetIsVideo, isLiked: currentIsLiked, likesCount: currentLikesCount }
      }));
    }
  };

  const toggleBookmarkPost = async (postId, isVideo = false) => {
    // 릴스 여부 판별 (파라미터 우선, 없으면 activePostDetail의 isVideo/is_video/category 검사)
    const targetIsVideo = Boolean(
      isVideo ||
      (activePostDetail?.id === postId && (
        activePostDetail?.isVideo ||
        activePostDetail?.is_video ||
        activePostDetail?.category === 'reel' ||
        activePostDetail?.media?.[0]?.media_type === 'video'
      ))
    );

    // Optimistic update
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const nextVal = !(p.isBookmarked ?? p.is_bookmarked ?? false);
          return { ...p, isBookmarked: nextVal, is_bookmarked: nextVal };
        }
        return p;
      })
    );
    setActivePostDetail(prev => {
      if (prev && prev.id === postId) {
        const nextVal = !(prev.isBookmarked ?? prev.is_bookmarked ?? false);
        return { ...prev, isBookmarked: nextVal, is_bookmarked: nextVal };
      }
      return prev;
    });

    try {
      const res = targetIsVideo
        ? await reelApi.toggleReelBookmark(postId)
        : await postApi.togglePostBookmark(postId);

      if (res && typeof res.bookmarked === 'boolean') {
        setPosts(prev =>
          prev.map(p => (p.id === postId ? { ...p, isBookmarked: res.bookmarked, is_bookmarked: res.bookmarked } : p))
        );
        setActivePostDetail(prev =>
          prev && prev.id === postId ? { ...prev, isBookmarked: res.bookmarked, is_bookmarked: res.bookmarked } : prev
        );
        // 전역 북마크 갱신 이벤트 발생 (저장됨 탭 자동 동기화)
        window.dispatchEvent(new CustomEvent('ig_bookmark_updated', { detail: { postId, isVideo: targetIsVideo, bookmarked: res.bookmarked } }));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark on backend:', err);
      // Rollback both posts and activePostDetail!
      setPosts(prev =>
        prev.map(p => {
          if (p.id === postId) {
            const rollbackVal = !(p.isBookmarked ?? p.is_bookmarked ?? false);
            return { ...p, isBookmarked: rollbackVal, is_bookmarked: rollbackVal };
          }
          return p;
        })
      );
      setActivePostDetail(prev => {
        if (prev && prev.id === postId) {
          const rollbackVal = !(prev.isBookmarked ?? prev.is_bookmarked ?? false);
          return { ...prev, isBookmarked: rollbackVal, is_bookmarked: rollbackVal };
        }
        return prev;
      });
    }
  };

  const addCommentToPost = async (postId, user, text, parentId = null, isVideo = false) => {
    const targetIsVideo = Boolean(
      isVideo ||
      (activePostDetail?.id === postId && (
        activePostDetail?.isVideo ||
        activePostDetail?.is_video ||
        activePostDetail?.category === 'reel' ||
        activePostDetail?.media?.[0]?.media_type === 'video'
      ))
    );

    const optimisticComment = {
      id: Date.now(),
      username: user?.username || 'me',
      text,
      timeAgo: "방금 전",
      likes: 0,
      parentId: parentId,
      replies: []
    };

    // Optimistic UI update for home feed posts
    setPosts(prev =>
      prev.map(p => {
        if (p.id === postId) {
          const currentComments = p.comments || [];
          let updatedComments;
          if (parentId) {
            updatedComments = currentComments.map(c => {
              if (c.id === parentId) {
                return {
                  ...c,
                  replies_count: (c.replies_count || c.replies?.length || 0) + 1,
                  replies: [...(c.replies || []), optimisticComment]
                };
              }
              return c;
            });
          } else {
            updatedComments = [...currentComments, optimisticComment];
          }
          return {
            ...p,
            commentsCount: (p.commentsCount || 0) + 1,
            comments_count: (p.comments_count || 0) + 1,
            comments: updatedComments
          };
        }
        return p;
      })
    );

    // Optimistic UI update for active modal detail
    setActivePostDetail(prev => {
      if (prev && prev.id === postId) {
        const currentComments = prev.comments || [];
        let updatedComments;
        if (parentId) {
          updatedComments = currentComments.map(c => {
            if (c.id === parentId) {
              return {
                ...c,
                replies_count: (c.replies_count || c.replies?.length || 0) + 1,
                replies: [...(c.replies || []), optimisticComment]
              };
            }
            return c;
          });
        } else {
          updatedComments = [...currentComments, optimisticComment];
        }
        return {
          ...prev,
          commentsCount: (prev.commentsCount || prev.comments_count || 0) + 1,
          comments_count: (prev.comments_count || prev.commentsCount || 0) + 1,
          comments: updatedComments
        };
      }
      return prev;
    });

    // Broadcast comment addition to Explore and other pages
    window.dispatchEvent(new CustomEvent('ig_post_activity', {
      detail: {
        postId,
        isVideo: targetIsVideo,
        newComment: optimisticComment,
        incrementCommentCount: true
      }
    }));

    try {
      const res = targetIsVideo
        ? await reelApi.addReelComment(postId, text, parentId)
        : await postApi.addComment(postId, text, parentId);
      if (res?.id) {
        window.dispatchEvent(new CustomEvent('ig_post_activity', {
          detail: {
            postId,
            isVideo: targetIsVideo,
            tempId: optimisticComment.id,
            serverComment: res
          }
        }));
      }
      return res;
    } catch (err) {
      console.error('Failed to add comment on backend:', err);
      throw err;
    }
  };

  const addNewPost = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  const deletePost = async (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (activePostDetail && activePostDetail.id === postId) {
      setActivePostDetail(null);
    }
    try {
      await postApi.deletePost(postId);
    } catch (err) {
      console.error('Failed to delete post on backend:', err);
    }
  };

  return (
    <ModalContext.Provider
      value={{
        posts,
        setPosts,
        feedLoading,
        fetchFeed,
        loadMoreFeed,
        hasMoreFeed,
        loadingMoreFeed,
        stories,
        setStories,
        storiesLoading,
        fetchStories,
        explorePosts,
        setExplorePosts,
        isCreateOpen,
        openCreatePost,
        closeCreatePost,
        isCreateStoryOpen,
        openCreateStory,
        closeCreateStory,
        isNotificationsOpen,
        openNotifications,
        closeNotifications,
        activeStory,
        openStoryViewer,
        closeStoryViewer,
        markStoryViewed,
        activePostDetail,
        focusCommentOnDetail,
        setFocusCommentOnDetail,
        openPostDetail,
        closePostDetail,
        activeOptionsPost,
        openOptions,
        closeOptions,
        isAuthPromptOpen,
        authPromptConfig,
        openAuthPromptModal,
        closeAuthPromptModal,
        toggleLikePost,
        toggleBookmarkPost,
        addCommentToPost,
        addNewPost,
        deletePost
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModal = () => useContext(ModalContext);
