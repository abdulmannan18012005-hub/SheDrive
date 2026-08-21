import React from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  const styles = {
    container: {
      position: 'fixed' as const,
      top: '20px',
      right: '20px',
      zIndex: 9999,
      padding: '16px 20px',
      borderRadius: '12px',
      minWidth: '300px',
      maxWidth: '400px',
      boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.15)',
      animation: 'slideIn 0.3s ease-out',
      backgroundColor: type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : type === 'warning' ? '#F59E0B' : '#3B82F6',
      color: '#FFFFFF',
      fontWeight: '600',
      fontSize: '14px',
    },
    closeButton: {
      position: 'absolute' as const,
      top: '8px',
      right: '12px',
      background: 'none',
      border: 'none',
      color: '#FFFFFF',
      fontSize: '18px',
      cursor: 'pointer',
      opacity: 0.8,
    },
  };

  React.useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div style={styles.container}>
      <button style={styles.closeButton} onClick={onClose}>×</button>
      {message}
    </div>
  );
};

// Toast container for managing multiple toasts
interface ToastContainerProps {
  toasts: Array<{ id: string; message: string; type: 'success' | 'error' | 'warning' | 'info' }>;
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
  return (
    <>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};
