import React from 'react';

interface PaginationBarProps {
  currentPage: number;
  totalPages: number;
  totalRecords: number;
  limit: number;
  isLoading?: boolean;
  onPageChange: (newPage: number) => void;
}

export const PaginationBar: React.FC<PaginationBarProps> = ({
  currentPage,
  totalPages,
  totalRecords,
  limit,
  isLoading = false,
  onPageChange,
}) => {
  if (totalRecords === 0) return null;

  const startRecord = (currentPage - 1) * limit + 1;
  const endRecord = Math.min(currentPage * limit, totalRecords);

  const canGoPrev = currentPage > 1 && !isLoading;
  const canGoNext = currentPage < totalPages && !isLoading;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        borderTop: '1px solid #EFF2F5',
        backgroundColor: '#FCFDFE',
        borderRadius: '0 0 16px 16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}
    >
      <div style={{ fontSize: '13px', color: '#7E8299', fontWeight: '600' }}>
        Showing <span style={{ color: '#181C32', fontWeight: '700' }}>{startRecord}</span> to{' '}
        <span style={{ color: '#181C32', fontWeight: '700' }}>{endRecord}</span> of{' '}
        <span style={{ color: '#181C32', fontWeight: '700' }}>{totalRecords}</span> entries
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => onPageChange(currentPage - 1)}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid #E4E6EF',
            backgroundColor: canGoPrev ? '#FFFFFF' : '#F5F8FA',
            color: canGoPrev ? '#3F4254' : '#B5B5C3',
            fontSize: '13px',
            fontWeight: '600',
            cursor: canGoPrev ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ◀ Previous
        </button>

        <div
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            backgroundColor: '#F3F6F9',
            color: '#181C32',
            fontSize: '13px',
            fontWeight: '700',
          }}
        >
          Page {currentPage} of {totalPages || 1}
        </div>

        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => onPageChange(currentPage + 1)}
          style={{
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid #E4E6EF',
            backgroundColor: canGoNext ? '#FFFFFF' : '#F5F8FA',
            color: canGoNext ? '#3F4254' : '#B5B5C3',
            fontSize: '13px',
            fontWeight: '600',
            cursor: canGoNext ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          Next ▶
        </button>
      </div>
    </div>
  );
};

export default PaginationBar;
