import React, { useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  requireReason?: boolean;
  reasonPlaceholder?: string;
  isLoading?: boolean;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = '#0D9488',
  requireReason = false,
  reasonPlaceholder = 'Please specify a reason...',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(requireReason ? reason : undefined);
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    onCancel();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) handleCancel();
      }}
    >
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '28px',
          maxWidth: '460px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid rgba(233,30,99,0.1)',
        }}
      >
        <h3
          style={{
            margin: '0 0 10px 0',
            fontSize: '18px',
            fontWeight: '800',
            color: '#181C32',
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: '0 0 20px 0',
            fontSize: '14px',
            color: '#5E6278',
            lineHeight: 1.6,
          }}
        >
          {message}
        </p>

        {requireReason && (
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '700',
                color: '#3F4254',
                marginBottom: '6px',
              }}
            >
              Reason / Admin Notes *
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #E4E6EF',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleCancel}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid #E4E6EF',
              backgroundColor: '#FFFFFF',
              color: '#7E8299',
              fontSize: '13px',
              fontWeight: '700',
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelText}
          </button>

          <button
            type="button"
            disabled={isLoading || (requireReason && !reason.trim())}
            onClick={handleConfirm}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: confirmColor,
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: (isLoading || (requireReason && !reason.trim())) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || (requireReason && !reason.trim())) ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isLoading ? '⏳ Processing...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
