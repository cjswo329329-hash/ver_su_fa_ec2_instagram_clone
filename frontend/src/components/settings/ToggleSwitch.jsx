import React from 'react';

export const ToggleSwitch = ({ checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: '44px',
      height: '24px',
      borderRadius: '12px',
      backgroundColor: checked ? 'var(--ig-primary-button)' : 'var(--border-color)',
      padding: '2px',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transform: checked ? 'translateX(20px)' : 'translateX(0px)',
        transition: 'transform 0.2s ease',
      }}
    />
  </div>
);

export default ToggleSwitch;
