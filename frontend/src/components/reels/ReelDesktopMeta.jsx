import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, User, Music } from 'lucide-react';

export const ReelDesktopMeta = ({ reel, onToggleFollow }) => {
  const navigate = useNavigate();
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  const renderCaptionText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (part.startsWith('#') || part.startsWith('@')) {
        return (
          <span key={i} style={{ color: 'var(--ig-link)', cursor: 'pointer' }}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div 
      className="reel-desktop-meta"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        width: '280px',
        paddingRight: '24px',
        paddingBottom: '12px',
        textAlign: 'left',
        flexShrink: 0,
      }}
    >
      {/* Creator Row */}
      <div 
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (reel?.author?.username) navigate(`/${reel.author.username}`);
          }}
          style={{ flexShrink: 0, cursor: 'pointer' }}
        >
          <img 
            src={reel?.author?.profileImageUrl} 
            alt={reel?.author?.username} 
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '1px solid var(--border-color)',
              display: 'block',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span 
            onClick={(e) => {
              e.stopPropagation();
              if (reel?.author?.username) navigate(`/${reel.author.username}`);
            }}
            style={{
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {reel?.author?.username}
          </span>

          {reel?.author?.isVerified && (
            <CheckCircle2 size={14} color="var(--ig-primary-button)" fill="var(--ig-primary-button)" />
          )}

          <span style={{ color: 'var(--ig-primary-button)', fontSize: '13px', fontWeight: 600 }}>•</span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (reel?.author?.id && onToggleFollow) onToggleFollow(reel.author.id);
            }}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: reel?.author?.isFollowing ? 'var(--text-secondary)' : 'var(--ig-primary-button)',
              cursor: 'pointer',
            }}
          >
            {reel?.author?.isFollowing ? '팔로잉' : '팔로우'}
          </button>
        </div>
      </div>

      {/* Tagged user Row */}
      {reel?.taggedUser && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
          <User size={13} />
          <span style={{ fontWeight: 500, cursor: 'pointer' }}>
            {reel.taggedUser}
          </span>
        </div>
      )}

      {/* Audio Row */}
      {reel?.audio && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
          <Music size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
            {reel.audio.title}
          </span>
        </div>
      )}

      {/* Caption */}
      <div style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.45, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
        <p style={{ display: '-webkit-box', WebkitLineClamp: isCaptionExpanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: isCaptionExpanded ? 'visible' : 'hidden' }}>
          {renderCaptionText(reel?.caption)}
        </p>
        {reel?.caption && reel.caption.length > 50 && (
          <button
            onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
            style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px', cursor: 'pointer' }}
          >
            {isCaptionExpanded ? '접기' : '...더 보기'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ReelDesktopMeta;
