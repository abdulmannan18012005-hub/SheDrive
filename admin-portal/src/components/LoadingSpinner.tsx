import React from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'medium', text }) => {
  const sizeMap = {
    small: { width: '20px', height: '20px', borderWidth: '2px' },
    medium: { width: '40px', height: '40px', borderWidth: '3px' },
    large: { width: '60px', height: '60px', borderWidth: '4px' },
  };

  const spinnerStyle = {
    border: '3px solid #E4E6EF',
    borderTop: `3px solid #E91E63`,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    ...sizeMap[size],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={spinnerStyle}></div>
      {text && <span style={{ fontSize: '14px', color: '#7E8299', fontWeight: '600' }}>{text}</span>}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
