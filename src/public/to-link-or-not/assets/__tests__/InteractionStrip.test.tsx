import React from 'react';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { InteractionStrip } from '../InteractionStrip';

const defaultProps = {
  mode: 'select' as const,
  onModeChange: vi.fn(),
  onResetZoom: vi.fn(),
  onResetSelection: vi.fn(),
  ctrlEnabled: true,
};

describe('InteractionStrip', () => {
  it('renders all three mode buttons', () => {
    render(<InteractionStrip {...defaultProps} />);
    expect(screen.getByRole('button', { name: /^select$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^lasso$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^pan$/i })).toBeInTheDocument();
  });

  it('marks the active mode button as pressed', () => {
    render(<InteractionStrip {...defaultProps} mode="lasso" />);
    expect(screen.getByRole('button', { name: /^lasso$/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^select$/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onModeChange with the clicked mode', () => {
    const onModeChange = vi.fn();
    render(<InteractionStrip {...defaultProps} onModeChange={onModeChange} />);
    fireEvent.click(screen.getByRole('button', { name: /^lasso$/i }));
    expect(onModeChange).toHaveBeenCalledWith('lasso');
  });

  it('calls onResetZoom when Reset Zoom is clicked', () => {
    const onResetZoom = vi.fn();
    render(<InteractionStrip {...defaultProps} onResetZoom={onResetZoom} />);
    fireEvent.click(screen.getByRole('button', { name: /reset zoom/i }));
    expect(onResetZoom).toHaveBeenCalledOnce();
  });

  it('calls onResetSelection when Reset Selection is clicked', () => {
    const onResetSelection = vi.fn();
    render(<InteractionStrip {...defaultProps} onResetSelection={onResetSelection} />);
    fireEvent.click(screen.getByRole('button', { name: /reset selection/i }));
    expect(onResetSelection).toHaveBeenCalledOnce();
  });

  it('shows both Ctrl hint badges', () => {
    render(<InteractionStrip {...defaultProps} />);
    expect(screen.getByText(/ctrl \+ click/i)).toBeInTheDocument();
    expect(screen.getByText(/ctrl \+ lasso/i)).toBeInTheDocument();
  });

  it('Ctrl+click badge is fully visible in select mode', () => {
    render(<InteractionStrip {...defaultProps} mode="select" />);
    const badge = screen.getByText(/ctrl \+ click/i).closest('div')!;
    expect(badge.style.opacity).toBe('1');
  });

  it('Ctrl+click badge is dimmed in lasso mode', () => {
    render(<InteractionStrip {...defaultProps} mode="lasso" />);
    const badge = screen.getByText(/ctrl \+ click/i).closest('div')!;
    expect(badge.style.opacity).toBe('0.4');
  });

  it('Ctrl+click badge is dimmed when ctrlEnabled is false', () => {
    render(<InteractionStrip {...defaultProps} ctrlEnabled={false} />);
    const badge = screen.getByText(/ctrl \+ click/i).closest('div')!;
    expect(badge.style.opacity).toBe('0.4');
  });
});
