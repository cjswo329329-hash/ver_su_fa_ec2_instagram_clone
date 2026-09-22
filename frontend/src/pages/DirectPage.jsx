import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ConversationList } from '../components/direct/ConversationList';
import { ChatThread } from '../components/direct/ChatThread';
import { NewMessageModal } from '../components/direct/NewMessageModal';
import { initialConversations } from '../data/mockDirectData';
import { useAuth } from '../contexts/AuthContext';
import { directApi, userApi, uploadApi } from '../services';

export const DirectPage = () => {
  const { user, allUsers } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const getStorageKey = (userId) => (userId ? `ig_direct_conversations_${userId}` : 'ig_direct_conversations_guest');

  // Load conversations from backend with fallback
  const [conversations, setConversations] = useState(() => {
    const key = getStorageKey(user?.id);
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return initialConversations;
      }
    }
    return initialConversations;
  });

  const [activeConversationId, setActiveConversationId] = useState(null);
  const [isNewMessageOpen, setIsNewMessageOpen] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const [errorToast, setErrorToast] = useState('');

  // 유저 ID 변경 시 해당 유저의 대화 목록 캐시로 전환 (다중 사용자 격리)
  useEffect(() => {
    if (user?.id) {
      const key = getStorageKey(user.id);
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setConversations(JSON.parse(saved));
        } catch (e) {
          setConversations([]);
        }
      }
    }
  }, [user?.id]);

  // Sync to localStorage under user's specific key
  useEffect(() => {
    if (user?.id && conversations && conversations.length > 0) {
      const key = getStorageKey(user.id);
      localStorage.setItem(key, JSON.stringify(conversations));
    }
  }, [conversations, user?.id]);

  // Auth guard: If guest, redirect to login
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fetch real conversations from backend
  const loadConversations = useCallback(async () => {
    try {
      const data = await directApi.getConversations();
      if (data && data.length > 0) {
        setConversations(data);
      }
    } catch (err) {
      console.warn('Could not load conversations from backend, using cached/mock:', err);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user, loadConversations]);

  // Handle ?user= query parameter
  useEffect(() => {
    const targetUsername = searchParams.get('user');
    if (!targetUsername) return;

    const initTargetChat = async () => {
      // 1. Check local/cached list
      const existing = conversations.find(c => c.partner?.username === targetUsername);
      if (existing) {
        setActiveConversationId(existing.id);
        return;
      }

      // 2. Fetch target user to get user ID
      try {
        const targetProfile = await userApi.getUserProfile(targetUsername);
        if (targetProfile && targetProfile.id) {
          const newConv = await directApi.createConversation(targetProfile.id);
          setConversations(prev => [newConv, ...prev.filter(c => c.id !== newConv.id)]);
          setActiveConversationId(newConv.id);
        }
      } catch (err) {
        console.error('Failed to create conversation for user param:', err);
      }
    };

    initTargetChat();
  }, [searchParams, conversations]);

  // Select active conversation & mark as read
  const handleSelectConversation = async (convId) => {
    setActiveConversationId(convId);
    setConversations(prev =>
      prev.map(c => (c.id === convId ? { ...c, unread_count: 0 } : c))
    );

    try {
      await directApi.markAsRead(convId);
      const messages = await directApi.getMessages(convId);
      if (messages) {
        setConversations(prev =>
          prev.map(c => (c.id === convId ? { ...c, messages } : c))
        );
      }
    } catch (err) {
      console.error('Failed to sync messages/read status:', err);
    }
  };

  // Send message
  const handleSendMessage = async (convId, messageData) => {
    const now = new Date();
    const timeStr = `오후 ${now.getHours() > 12 ? now.getHours() - 12 : now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

    const tempMsgId = `msg-${Date.now()}`;
    const optimisticMsg = {
      id: tempMsgId,
      conversation_id: convId,
      sender_id: user?.id || 'me',
      text: messageData.text,
      mediaUrl: messageData.mediaUrl,
      isUploading: !!messageData.file,
      created_at: timeStr,
      is_read: false,
      reactions: []
    };

    setConversations(prev => {
      const target = prev.find(c => c.id === convId);
      if (!target) return prev;

      const updated = {
        ...target,
        time_ago: '방금',
        messages: [...target.messages, optimisticMsg]
      };

      // Move this conversation to the top
      return [updated, ...prev.filter(c => c.id !== convId)];
    });

    try {
      let finalMediaUrl = messageData.mediaUrl;
      // If a real file was passed, upload it to the server first
      if (messageData.file) {
        const uploadRes = await uploadApi.uploadMedia(messageData.file, 'direct');
        if (uploadRes && uploadRes.url) {
          finalMediaUrl = uploadRes.url;
        } else {
          throw new Error('미디어 업로드 응답에 URL이 없습니다.');
        }
      }

      const realMsg = await directApi.sendMessage(convId, messageData.text, finalMediaUrl);
      // Replace optimistic message with backend response
      setConversations(prev =>
        prev.map(c => {
          if (c.id === convId) {
            const updatedMessages = c.messages.map(m => m.id === tempMsgId ? realMsg : m);
            return { ...c, messages: updatedMessages };
          }
          return c;
        })
      );
    } catch (err) {
      console.error('Failed to send message/media to backend:', err);
      // Rollback optimistic message on failure
      setConversations(prev =>
        prev.map(c => {
          if (c.id === convId) {
            return { ...c, messages: c.messages.filter(m => m.id !== tempMsgId) };
          }
          return c;
        })
      );
      setErrorToast('메시지 또는 사진 전송에 실패했습니다. 네트워크를 확인하고 다시 시도해주세요.');
      setTimeout(() => setErrorToast(''), 4500);
    }
  };

  // Periodic message sync for the active conversation
  useEffect(() => {
    if (!activeConversationId || !user) return;

    const interval = setInterval(async () => {
      try {
        const remoteMessages = await directApi.getMessages(activeConversationId);
        if (remoteMessages && Array.isArray(remoteMessages)) {
          setConversations(prev =>
            prev.map(c => {
              if (c.id === activeConversationId) {
                // Do not overwrite while an optimistic message is still uploading
                const isUploading = c.messages?.some(m => m.isUploading);
                if (isUploading) return c;

                if (c.messages?.length !== remoteMessages.length ||
                    (remoteMessages.length > 0 && c.messages?.[c.messages.length - 1]?.id !== remoteMessages[remoteMessages.length - 1]?.id)) {
                  return { ...c, messages: remoteMessages };
                }
              }
              return c;
            })
          );
        }
      } catch (err) {
        // Silently handle background sync errors
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [activeConversationId, user]);

  // Toggle reaction on message
  const handleToggleReaction = async (convId, messageId) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === convId) {
          const updatedMessages = c.messages.map(m => {
            if (m.id === messageId) {
              const hasHeart = m.reactions?.includes('❤️');
              const newReactions = hasHeart ? [] : ['❤️'];
              return { ...m, reactions: newReactions };
            }
            return m;
          });
          return { ...c, messages: updatedMessages };
        }
        return c;
      })
    );

    try {
      await directApi.toggleReaction(messageId, '❤️');
    } catch (err) {
      console.error('Failed to toggle reaction on backend:', err);
    }
  };

  // Open / create conversation from new message modal
  const handleSelectUserFromModal = async (selectedUser) => {
    try {
      const conv = await directApi.createConversation(selectedUser.id);
      setConversations(prev => [conv, ...prev.filter(c => c.id !== conv.id)]);
      setActiveConversationId(conv.id);
    } catch (err) {
      console.error('Failed to create conversation with user:', err);
      // Fallback
      const existing = conversations.find(c => c.partner?.username === selectedUser?.username);
      if (existing) {
        handleSelectConversation(existing.id);
      }
    }
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: 'var(--bg-primary)',
        overflow: 'hidden',
        display: 'flex',
        margin: 0,
        padding: 0,
      }}
      className="direct-page-container"
    >
      {/* Left Column: Conversation List (397px wide) */}
      <div
        style={{
          width: '397px',
          flexShrink: 0,
          height: '100%',
          borderRight: '1px solid var(--border-color)',
        }}
        className={`direct-left-col ${activeConversationId ? 'hide-on-mobile' : ''}`}
      >
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={handleSelectConversation}
          onOpenNewMessage={() => setIsNewMessageOpen(true)}
          onSelectUser={handleSelectUserFromModal}
        />
      </div>

      {/* Right Column: Chat Thread or Empty State */}
      <div
        style={{
          flex: 1,
          height: '100%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
        className={`direct-right-col ${!activeConversationId ? 'hide-on-mobile' : ''}`}
      >
        <ChatThread
          conversation={activeConversation}
          onSendMessage={handleSendMessage}
          onToggleReaction={handleToggleReaction}
          onOpenNewMessage={() => setIsNewMessageOpen(true)}
          onBackToConversations={() => setActiveConversationId(null)}
          isPartnerTyping={isPartnerTyping}
        />
      </div>

      {/* New Message Selection Modal */}
      <NewMessageModal
        isOpen={isNewMessageOpen}
        onClose={() => setIsNewMessageOpen(false)}
        onSelectUser={handleSelectUserFromModal}
      />

      {/* Recoverable Error Toast Banner */}
      {errorToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#262626',
            color: '#ffffff',
            padding: '10px 20px',
            borderRadius: '10px',
            fontSize: '13.5px',
            fontWeight: 500,
            boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <span style={{ color: '#ed4956', fontSize: '15px' }}>⚠️</span>
          <span>{errorToast}</span>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .direct-page-container {
            height: calc(100vh - var(--bottom-bar-height-mobile)) !important;
          }
          .direct-left-col {
            width: 100% !important;
            border-right: none !important;
          }
          .direct-right-col {
            width: 100% !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
