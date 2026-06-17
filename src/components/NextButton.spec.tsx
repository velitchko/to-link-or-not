import React from 'react';
import { MantineProvider } from '@mantine/core';
import {
  render, screen, act,
} from '@testing-library/react';
import {
  describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import { NextButton } from './NextButton';

const navigate = vi.fn();
const goToNextStep = vi.fn();
let studyConfig = {
  uiConfig: {
    nextButtonDisableTime: 1000,
    timeoutReject: true,
  },
};

vi.mock('react-router', () => ({
  useNavigate: () => navigate,
}));

vi.mock('../store/hooks/useNextStep', () => ({
  useNextStep: () => ({ isNextDisabled: false, goToNextStep }),
}));

vi.mock('../store/hooks/useStudyConfig', () => ({
  useStudyConfig: () => studyConfig,
}));

vi.mock('./PreviousButton', () => ({
  PreviousButton: () => null,
}));

function renderNextButton() {
  return render(
    <MantineProvider>
      <NextButton checkAnswer={null} />
    </MantineProvider>,
  );
}

describe('NextButton visibility-aware timeout', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.useFakeTimers();
    navigate.mockClear();
    goToNextStep.mockClear();
    studyConfig = { uiConfig: { nextButtonDisableTime: 1000, timeoutReject: true } };
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not count hidden/minimized time toward timeout rejection', () => {
    renderNextButton();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(5000);
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(900);
    });
    expect(navigate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(navigate).toHaveBeenCalledWith(`./../__timedOut${window.location.search}`);
  });
});
