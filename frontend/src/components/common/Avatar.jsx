import React from 'react';
import { Plus } from 'lucide-react';

const sizeMap = {
  xs: { width: 24, height: 24, padding: 1 },
  sm: { width: 32, height: 32, padding: 2 },
  md: { width: 44, height: 44, padding: 2 },
  lg: { width: 56, height: 56, padding: 2 },
  xl: { width: 77, height: 77, padding: 3 },
  xxl: { width: 150, height: 150, padding: 4 },
};

export const Avatar = ({
  src,
  alt = "avatar",
  size = "md",
  hasStory = false,
  isStoryViewed = false,
  isAddable = false,
  onAddClick,
  onClick,
  className = ""
}) => {
  const currentSize = sizeMap[size] || sizeMap.md;
  const defaultAvatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80";

  const renderImage = (
    <img
      src={src || defaultAvatar}
      alt={alt}
      style={{
        width: `${currentSize.width}px`,
        height: `${currentSize.height}px`,
        borderRadius: '50%',
        objectFit: 'cover',
        display: 'block'
      }}
      onError={(e) => {
        if (src && src.startsWith('/uploads/') && !e.target.dataset.retried) {
          e.target.dataset.retried = 'true';
          e.target.src = `http://13.125.66.53:8000${src}`;
          return;
        }
        e.target.src = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80";
      }}
    />
  );

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none'
      }}
      onClick={onClick}
      className={className}
    >
      {hasStory ? (
        <div
          className={isStoryViewed ? "story-ring-viewed" : "story-ring-gradient"}
          style={{ padding: `${currentSize.padding}px` }}
        >
          <div className="story-ring-inner">
            {renderImage}
          </div>
        </div>
      ) : (
        renderImage
      )}

      {isAddable && (
        <div
          onClick={(e) => {
            if (onAddClick) {
              e.stopPropagation();
              onAddClick(e);
            }
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            backgroundColor: 'var(--ig-primary-button)',
            color: '#ffffff',
            borderRadius: '50%',
            width: size === 'xl' || size === 'lg' ? '24px' : '18px',
            height: size === 'xl' || size === 'lg' ? '24px' : '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid var(--bg-primary)',
            cursor: 'pointer',
            transition: 'transform 0.15s ease',
          }}
          title="스토리 추가"
        >
          <Plus size={size === 'xl' || size === 'lg' ? 16 : 12} strokeWidth={3} />
        </div>
      )}
    </div>
  );
};
