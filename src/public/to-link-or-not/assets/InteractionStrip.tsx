import React from 'react';
import { InteractionMode } from './types';

const MODE_CONFIG: Record<InteractionMode, { icon: string; label: string }> = {
  select: { icon: '↖', label: 'Select' },
  lasso: { icon: '⬚', label: 'Lasso' },
  pan: { icon: '✥', label: 'Pan' },
};

interface InteractionStripProps {
  mode: InteractionMode;
  onModeChange: (mode: InteractionMode) => void;
  onResetZoom: () => void;
  onResetSelection: () => void;
  ctrlEnabled: boolean;
}

export function InteractionStrip({
  mode,
  onModeChange,
  onResetZoom,
  onResetSelection,
  ctrlEnabled,
}: InteractionStripProps) {
  const btnBase: React.CSSProperties = {
    alignItems: 'center',
    borderRadius: '5px',
    cursor: 'pointer',
    display: 'flex',
    fontSize: '12px',
    gap: '5px',
    padding: '4px 10px',
  };

  return (
    <div
      style={{
        alignItems: 'center',
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        padding: '6px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '3px',
        }}
      >
        {(['select', 'lasso', 'pan'] as const).map((m) => {
          const { icon, label } = MODE_CONFIG[m];
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => onModeChange(m)}
              style={{
                ...btnBase,
                background: active ? '#ede9fe' : 'white',
                border: `1px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
                color: active ? '#4f46e5' : '#6b7280',
                fontWeight: active ? 600 : 400,
              }}
            >
              <span aria-hidden="true">{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ width: '1px', height: '20px', background: '#e2e8f0' }} />

      <button
        type="button"
        onClick={onResetZoom}
        style={{
          ...btnBase,
          background: 'white',
          border: '1px solid #e2e8f0',
          color: '#6b7280',
        }}
      >
        ⊙ Reset Zoom
      </button>

      <button
        type="button"
        onClick={onResetSelection}
        style={{
          ...btnBase,
          background: 'white',
          border: '1px solid #e2e8f0',
          color: '#6b7280',
        }}
      >
        ✕ Reset Selection
      </button>

      <div
        style={{
          background: '#fefce8',
          border: '1px solid #fde68a',
          borderRadius: '4px',
          color: '#92400e',
          fontSize: '11px',
          marginLeft: 'auto',
          opacity: mode === 'select' && ctrlEnabled ? 1 : 0.4,
          padding: '3px 8px',
        }}
      >
        <strong>Ctrl + click</strong>
        {' adds to selection'}
      </div>
      <div
        style={{
          background: '#fefce8',
          border: '1px solid #fde68a',
          borderRadius: '4px',
          color: '#92400e',
          fontSize: '11px',
          opacity: mode === 'lasso' ? 1 : 0.4,
          padding: '3px 8px',
        }}
      >
        <strong>Ctrl + lasso</strong>
        {' adds to selection'}
      </div>
    </div>
  );
}
