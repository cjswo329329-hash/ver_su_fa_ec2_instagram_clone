import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Link as LinkIcon, UserPlus, MoreHorizontal, Check, Music, Smile, ChevronDown } from 'lucide-react';
import { Avatar } from '../common/Avatar';
import { Button } from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { useModal } from '../../contexts/ModalContext';
import { FollowersModal } from './FollowersModal';
import { ProfileOptionsModal } from './ProfileOptionsModal';
import { OtherUserOptionsModal } from './OtherUserOptionsModal';
import { ProfileQRCodeModal } from './ProfileQRCodeModal';
import { ChangeAvatarModal } from './ChangeAvatarModal';
import { followApi, userApi } from '../../services';

export const ProfileHeader = ({ profileUser, isMe = true, onProfileRefresh }) => {
  const navigate = useNavigate();
  const { user, updateProfile, updateAvatar, allUsers } = useAuth();
  const { requireAuth } = useAuthGuard();
  const { stories, openStoryViewer, fetchFeed, fetchStories } = useModal();

  // 해당 프로필 유저의 스토리 존재 여부 확인 (ID 및 username, isMe 포괄 매칭)
  const profileStory = stories?.find(s => {
    if (profileUser?.id && s.userId && String(s.userId) === String(profileUser.id)) return true;
    if (profileUser?.username && s.username && s.username.toLowerCase() === profileUser.username.toLowerCase()) return true;
    if (isMe && user) {
      if (user.id && s.userId && String(s.userId) === String(user.id)) return true;
      if (user.username && s.username && s.username.toLowerCase() === user.username.toLowerCase()) return true;
    }
    return false;
  });
  const hasActiveStory = Boolean(profileStory && profileStory.stories && profileStory.stories.length > 0);

  const handleAvatarClick = () => {
    // 스토리가 있는 경우에만 스토리 뷰어 재생!
    // 사진 변경 모달은 프로필 사진 클릭으로 절대 열리지 않음 (오직 '프로필 편집'을 통해서만 변경)
    if (hasActiveStory) {
      openStoryViewer(profileStory);
    }
  };

  // Modals state
  const [isFollowersModalOpen, setIsFollowersModalOpen] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState('followers');
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [isOtherUserOptionsOpen, setIsOtherUserOptionsOpen] = useState(false);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // Other user state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(profileUser?.followers_count || 0);
  const [followingCount, setFollowingCount] = useState(profileUser?.following_count || 0);
  const [showSuggested, setShowSuggested] = useState(false);
  const [noteText, setNoteText] = useState(isMe ? '생각을 여기에 공유해보세요...' : '음악 공유중 🎧 New Jeans - Hype Boy');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [inputNote, setInputNote] = useState('');
  const [isRequested, setIsRequested] = useState(false);

  useEffect(() => {
    if (profileUser) {
      setIsFollowing(!!(profileUser.is_following ?? profileUser.isFollowing));
      setIsRequested(!!(profileUser.is_requested ?? profileUser.isRequested));
      if (typeof profileUser.followers_count === 'number') {
        setFollowersCount(profileUser.followers_count);
      }
      if (typeof profileUser.following_count === 'number') {
        setFollowingCount(profileUser.following_count);
      }
    }
  }, [profileUser?.id, profileUser?.username, profileUser?.followers_count, profileUser?.following_count]);

  useEffect(() => {
    const handleFollowRequestAccepted = () => {
      if (isMe) {
        setFollowersCount(prev => prev + 1);
        if (onProfileRefresh) onProfileRefresh(true);
      }
    };
    window.addEventListener('follow_request_accepted', handleFollowRequestAccepted);
    return () => {
      window.removeEventListener('follow_request_accepted', handleFollowRequestAccepted);
    };
  }, [isMe, onProfileRefresh]);

  const handleToggleFollow = async () => {
    requireAuth(async () => {
      if (!profileUser?.id) return;

      try {
        const res = await followApi.toggleFollow(profileUser.id);
        if (res.following) {
          if (res.status === 'pending') {
            setIsRequested(true);
            setIsFollowing(false);
          } else {
            setIsFollowing(true);
            setIsRequested(false);
            if (typeof res.target_followers_count === 'number') {
              setFollowersCount(res.target_followers_count);
            } else {
              setFollowersCount(prev => prev + 1);
            }
          }
        } else {
          setIsFollowing(false);
          setIsRequested(false);
          if (typeof res.target_followers_count === 'number') {
            setFollowersCount(res.target_followers_count);
          } else {
            setFollowersCount(prev => Math.max(0, prev - 1));
          }
        }
        if (onProfileRefresh) onProfileRefresh(true);
        if (fetchFeed) fetchFeed();
        if (fetchStories) fetchStories();
      } catch (err) {
        console.error('Follow toggle error:', err);
      }
    }, {
      actionType: 'follow',
      title: `${profileUser?.username || '사용자'}님을 팔로우하세요`,
      description: 'Instagram에 로그인하여 게시물과 스토리를 피드에서 확인하세요.'
    });
  };

  const handleOpenFollowers = (tabName) => {
    setFollowersModalTab(tabName);
    setIsFollowersModalOpen(true);
  };

  const handleCloseFollowersModal = () => {
    setIsFollowersModalOpen(false);
    if (onProfileRefresh) {
      onProfileRefresh(true);
    }
  };

  const handleSaveNote = () => {
    if (inputNote.trim()) {
      setNoteText(inputNote.trim());
    }
    setIsEditingNote(false);
  };

  const followersDisplayCount = followersCount;
  const followingDisplayCount = followingCount;

  const handleModalFollowChange = (change) => {
    if (!change) return;
    const {
      type,
      userId,
      following,
      followersCount: newFollowersCount,
      followingCount: newFollowingCount
    } = change;

    if (type === 'modal_closed') {
      if (onProfileRefresh) onProfileRefresh(true);
      return;
    }

    if (typeof newFollowersCount === 'number') {
      setFollowersCount(newFollowersCount);
    } else if (type === 'remove_follower') {
      setFollowersCount(prev => Math.max(0, prev - 1));
    } else if (type === 'remove_follower_revert' || type === 'accept_request') {
      setFollowersCount(prev => prev + 1);
    }

    if (typeof newFollowingCount === 'number') {
      setFollowingCount(newFollowingCount);
    } else if (type === 'toggle_follow') {
      if (isMe) {
        setFollowingCount(prev => Math.max(0, prev + (following ? 1 : -1)));
      } else if (userId === profileUser?.id) {
        setFollowersCount(prev => Math.max(0, prev + (following ? 1 : -1)));
      }
    }
  };

  const suggestedUsers = allUsers.filter(u => u.username !== profileUser?.username && u.username !== user?.username).slice(0, 5);

  return (
    <header
      style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '36px',
        padding: '0 20px',
      }}
      className="profile-header-container"
    >
      {/* Desktop Profile Header Layout */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '40px' }} className="profile-desktop-layout">
        {/* Large Avatar with Note Bubble */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            minWidth: '150px',
          }}
          className="profile-avatar-wrapper"
        >
          {/* Note Bubble (Instagram Notes) */}
          <div
            onClick={() => {
              if (isMe) {
                setInputNote(noteText);
                setIsEditingNote(true);
              }
            }}
            style={{
              position: 'relative',
              marginBottom: '-8px',
              backgroundColor: 'var(--bg-elevated)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              padding: '6px 12px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              maxWidth: '140px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              cursor: isMe ? 'pointer' : 'default',
              zIndex: 3,
            }}
            title={noteText}
          >
            {noteText}
            {/* Bubble arrow pointer */}
            <div
              style={{
                position: 'absolute',
                bottom: '-5px',
                left: '20px',
                width: '8px',
                height: '8px',
                backgroundColor: 'var(--bg-elevated)',
                borderRight: '1px solid var(--border-color)',
                borderBottom: '1px solid var(--border-color)',
                transform: 'rotate(45deg)',
              }}
            />
          </div>

          {/* Avatar with story viewer */}
          <div
            onClick={handleAvatarClick}
            style={{
              cursor: hasActiveStory ? 'pointer' : 'default',
              position: 'relative',
              marginTop: '6px',
            }}
            title={hasActiveStory ? '스토리 시청하기' : profileUser?.username}
          >
            <Avatar
              src={profileUser?.profile_image_url}
              size="xxl"
              hasStory={hasActiveStory}
              isStoryViewed={profileStory ? !profileStory.hasUnseen : false}
              alt={profileUser?.username}
            />
          </div>
        </div>

        {/* Profile Details Right Column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Username & Action Buttons Row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }} className="profile-actions-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {profileUser?.username}
              </h2>
              {profileUser?.is_verified && (
                <span
                  style={{
                    backgroundColor: '#0095f6',
                    color: '#ffffff',
                    borderRadius: '50%',
                    width: '18px',
                    height: '18px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                  }}
                >
                  ✓
                </span>
              )}
            </div>

            {isMe ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/accounts/edit')}
                  style={{ fontWeight: 600, padding: '7px 16px', borderRadius: '8px' }}
                >
                  프로필 편집
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => alert("보관된 스토리 보관함으로 이동합니다.")}
                  style={{ fontWeight: 600, padding: '7px 16px', borderRadius: '8px' }}
                >
                  보관된 스토리 보기
                </Button>
                <button
                  onClick={() => setIsOptionsModalOpen(true)}
                  style={{
                    color: 'var(--text-primary)',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Settings"
                >
                  <Settings size={22} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button
                  variant={isRequested || isFollowing ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={handleToggleFollow}
                  style={{ minWidth: '88px', fontWeight: 600, padding: '7px 18px', borderRadius: '8px' }}
                >
                  {isFollowing
                    ? '팔로잉'
                    : (isRequested ? '요청됨' : '팔로우')}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    requireAuth(() => {
                      navigate(`/direct?user=${profileUser?.username}`);
                    }, {
                      actionType: 'message',
                      title: `${profileUser?.username}님에게 메시지 보내기`,
                      description: 'Instagram에 로그인하여 1:1 다이렉트 메시지를 주고받으세요.'
                    });
                  }}
                  style={{ fontWeight: 600, padding: '7px 16px', borderRadius: '8px' }}
                >
                  메시지 보내기
                </Button>
                <button
                  onClick={() => setShowSuggested(!showSuggested)}
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '7px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--text-primary)',
                  }}
                  title="추천 사람 보기"
                >
                  <UserPlus size={16} />
                </button>
                <button
                  onClick={() => setIsOtherUserOptionsOpen(true)}
                  style={{
                    color: 'var(--text-primary)',
                    padding: '6px',
                    cursor: 'pointer',
                  }}
                  title="옵션 더 보기"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
            )}
          </div>

          {/* Stats Row (Posts, Followers, Following) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }} className="profile-stats-row">
            <div style={{ fontSize: '16px' }}>
              게시물 <strong style={{ fontWeight: 600 }}>{profileUser?.posts_count || 0}</strong>
            </div>
            <div
              onClick={() => handleOpenFollowers('followers')}
              style={{ fontSize: '16px', cursor: 'pointer' }}
            >
              팔로워 <strong style={{ fontWeight: 600 }}>{followersDisplayCount.toLocaleString()}</strong>
            </div>
            <div
              onClick={() => handleOpenFollowers('following')}
              style={{ fontSize: '16px', cursor: 'pointer' }}
            >
              팔로잉 <strong style={{ fontWeight: 600 }}>{followingDisplayCount.toLocaleString()}</strong>
            </div>
          </div>

          {/* Bio & Details Row */}
          <div>
            {profileUser?.full_name && (
              <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', color: 'var(--text-primary)' }}>
                {profileUser.full_name}
              </div>
            )}

            {/* Category tag */}
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 500 }}>
              {profileUser?.category || '디지털 크리에이터'}
            </div>

            {profileUser?.bio && (
              <div
                style={{
                  fontSize: '14px',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-line',
                  color: 'var(--text-primary)',
                  marginBottom: '8px',
                }}
              >
                {profileUser.bio}
              </div>
            )}

            {profileUser?.website && (
              <a
                href={profileUser.website}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: '14px',
                  color: 'var(--ig-link)',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '6px',
                }}
              >
                <LinkIcon size={14} />
                {profileUser.website.replace(/^https?:\/\//, '')}
              </a>
            )}

            {/* Mutual followers preview for other users */}
            {!isMe && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>cafe_vibes</span>님 외 12명이 팔로우합니다
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Profile Header Layout (Matches real Instagram mobile) */}
      <div className="profile-mobile-layout">
        {/* Top: Avatar (Left) + Username & Stats (Right) */}
        <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          {/* Avatar Container with Note Bubble and + Badge */}
          <div
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              width: '84px',
              flexShrink: 0,
            }}
          >
            {/* Note Bubble */}
            <div
              onClick={() => {
                if (isMe) {
                  setInputNote(noteText);
                  setIsEditingNote(true);
                }
              }}
              style={{
                position: 'relative',
                backgroundColor: 'var(--bg-elevated)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                padding: '5px 8px',
                fontSize: '11px',
                lineHeight: 1.25,
                color: 'var(--text-primary)',
                maxWidth: '90px',
                textAlign: 'center',
                cursor: isMe ? 'pointer' : 'default',
                marginBottom: '-6px',
                zIndex: 3,
                wordBreak: 'keep-all',
              }}
              title={noteText}
            >
              {noteText}
              <div
                style={{
                  position: 'absolute',
                  bottom: '-4px',
                  left: '18px',
                  width: '7px',
                  height: '7px',
                  backgroundColor: 'var(--bg-elevated)',
                  borderRight: '1px solid var(--border-color)',
                  borderBottom: '1px solid var(--border-color)',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>

            {/* Avatar with Story Ring */}
            <div style={{ position: 'relative', width: '76px', height: '76px', marginTop: '4px' }}>
              <div
                onClick={handleAvatarClick}
                style={{
                  width: '100%',
                  height: '100%',
                  cursor: hasActiveStory ? 'pointer' : 'default',
                }}
              >
                <Avatar
                  src={profileUser?.profile_image_url}
                  size="xl"
                  hasStory={hasActiveStory}
                  isStoryViewed={profileStory ? !profileStory.hasUnseen : false}
                  alt={profileUser?.username}
                />
              </div>

              {/* + Icon on bottom right of avatar */}
              {isMe && (
                <div
                  onClick={() => {
                    setInputNote(noteText);
                    setIsEditingNote(true);
                  }}
                  style={{
                    position: 'absolute',
                    bottom: '0px',
                    right: '0px',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: '#111111',
                    color: '#ffffff',
                    border: '2px solid var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '15px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    zIndex: 4,
                  }}
                  title="생각 공유"
                >
                  +
                </div>
              )}
            </div>
          </div>

          {/* Right: Username & 3 Stats */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              paddingLeft: '22px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            {/* Display Name or Username */}
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '8px',
                letterSpacing: '-0.2px',
              }}
            >
              {profileUser?.full_name || profileUser?.username}
            </div>

            {/* 3 Stats: 게시물 / 팔로워 / 팔로잉 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              {/* 게시물 */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {profileUser?.posts_count || 0}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                  게시물
                </span>
              </div>

              {/* 팔로워 */}
              <div
                onClick={() => handleOpenFollowers('followers')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }}
              >
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {followersDisplayCount.toLocaleString()}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                  팔로워
                </span>
              </div>

              {/* 팔로잉 */}
              <div
                onClick={() => handleOpenFollowers('following')}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, cursor: 'pointer' }}
              >
                <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {followingDisplayCount.toLocaleString()}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                  팔로잉
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Bio / Details */}
        {(profileUser?.category || profileUser?.bio || profileUser?.website) && (
          <div style={{ marginTop: '10px' }}>
            {/* Category */}
            {profileUser?.category && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '3px', fontWeight: 500 }}>
                {profileUser.category}
              </div>
            )}

          {/* Bio */}
          {profileUser?.bio && (
            <div
              style={{
                fontSize: '13.5px',
                lineHeight: 1.45,
                whiteSpace: 'pre-line',
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}
            >
              {profileUser.bio}
            </div>
          )}

          {/* Website Link */}
          {profileUser?.website && (
            <a
              href={profileUser.website}
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '13.5px',
                color: 'var(--ig-link)',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <LinkIcon size={13} />
              {profileUser.website.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      )}

        {/* Bottom: Action Buttons */}
        {isMe ? (
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', width: '100%' }}>
            <button
              onClick={() => navigate('/accounts/edit')}
              style={{
                flex: 1,
                height: '36px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              프로필 편집
            </button>
            <button
              onClick={() => setIsQRCodeModalOpen(true)}
              style={{
                flex: 1,
                height: '36px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              프로필 공유
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', width: '100%' }}>
            <Button
              variant={isRequested || isFollowing ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleToggleFollow}
              style={{ flex: 1, height: '36px', fontWeight: 600, borderRadius: '8px', fontSize: '14px' }}
            >
              {isFollowing
                ? '팔로잉'
                : (isRequested ? '요청됨' : '팔로우')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                requireAuth(() => {
                  navigate(`/direct?user=${profileUser?.username}`);
                }, {
                  actionType: 'message',
                  title: `${profileUser?.username}님에게 메시지 보내기`,
                  description: 'Instagram에 로그인하여 1:1 다이렉트 메시지를 주고받으세요.'
                });
              }}
              style={{ flex: 1, height: '36px', fontWeight: 600, borderRadius: '8px', fontSize: '14px' }}
            >
              메시지 보내기
            </Button>
            <button
              onClick={() => setShowSuggested(!showSuggested)}
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                flexShrink: 0,
              }}
              title="추천 사람 보기"
            >
              <UserPlus size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Suggested Users Carousel (Expanded when user clicks user plus icon) */}
      {showSuggested && (
        <div
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>추천 사람</span>
            <button
              onClick={() => navigate('/explore')}
              style={{ fontSize: '12px', color: 'var(--ig-primary-button)', fontWeight: 600, cursor: 'pointer' }}
            >
              모두 보기
            </button>
          </div>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto' }} className="no-scrollbar">
            {suggestedUsers.map(su => (
              <div
                key={su.id}
                style={{
                  minWidth: '130px',
                  padding: '14px 10px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Avatar src={su.profile_image_url} size="lg" />
                <div style={{ fontSize: '13px', fontWeight: 600, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {su.username}
                </div>
                <Button variant="primary" size="sm" style={{ width: '100%', fontSize: '12px', padding: '4px 0' }}>
                  팔로우
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note Edit Modal */}
      {isEditingNote && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '360px',
              width: '90%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>새로운 메모</h3>
            <input
              type="text"
              placeholder="생각을 남겨보세요..."
              value={inputNote}
              onChange={(e) => setInputNote(e.target.value)}
              maxLength={60}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                fontSize: '14px',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" size="sm" onClick={() => setIsEditingNote(false)}>
                취소
              </Button>
              <Button variant="primary" size="sm" onClick={handleSaveNote}>
                공유
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Followers / Following Modal */}
      <FollowersModal
        isOpen={isFollowersModalOpen}
        onClose={handleCloseFollowersModal}
        initialTab={followersModalTab}
        profileUser={{
          ...profileUser,
          followers_count: followersCount,
          following_count: followingCount
        }}
        isMe={isMe}
        onFollowChange={handleModalFollowChange}
      />

      {/* Profile Options Modal (Gear Icon for Me) */}
      <ProfileOptionsModal
        isOpen={isOptionsModalOpen}
        onClose={() => setIsOptionsModalOpen(false)}
        onOpenQRCode={() => setIsQRCodeModalOpen(true)}
      />

      {/* Other User Options Modal (More Horizontal for Others) */}
      <OtherUserOptionsModal
        isOpen={isOtherUserOptionsOpen}
        onClose={() => setIsOtherUserOptionsOpen(false)}
        profileUser={profileUser}
      />

      {/* Profile QR Code Modal */}
      <ProfileQRCodeModal
        isOpen={isQRCodeModalOpen}
        onClose={() => setIsQRCodeModalOpen(false)}
        username={profileUser?.username}
      />

      {/* Change Avatar Modal */}
      <ChangeAvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatar={profileUser?.profile_image_url}
        onAvatarChange={async (newUrl) => {
          try {
            await updateAvatar(newUrl);
            if (onProfileRefresh) onProfileRefresh();
          } catch (err) {
            console.error('Failed to update avatar:', err);
          }
        }}
      />

      <style>{`
        .profile-desktop-layout {
          display: flex;
          align-items: flex-start;
          gap: 40px;
        }
        .profile-mobile-layout {
          display: none;
        }
        @media (max-width: 768px) {
          .profile-desktop-layout {
            display: none !important;
          }
          .profile-mobile-layout {
            display: flex !important;
            flex-direction: column;
            width: 100%;
          }
          .profile-header-container {
            padding: 0 !important;
            margin-bottom: 20px !important;
          }
        }
      `}</style>
    </header>
  );
};
