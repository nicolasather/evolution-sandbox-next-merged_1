import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { IntroVisitProvider } from '../IntroVisit';
import { useModeGate } from '../useModeGate';

const wrap = ({ children }: { children: ReactNode }) => <IntroVisitProvider>{children}</IntroVisitProvider>;

describe('mode opening policy (once per website visit)', () => {
  it('first Civilization entry shows the intro; the second skips it', () => {
    const { result } = renderHook(() => useModeGate(), { wrapper: wrap });
    let started = false;
    act(() => { started = result.current.enter('civilization'); });
    expect(started).toBe(true);
    expect(result.current.gate).toBe('civilization');
    act(() => result.current.close());
    act(() => { started = result.current.enter('civilization'); });
    expect(started).toBe(false);
    expect(result.current.gate).toBeNull(); // no gate at all: no black frame, no extra click
  });

  it('another mode still shows its own intro the first time', () => {
    const { result } = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { result.current.enter('civilization'); });
    act(() => result.current.close());
    act(() => { result.current.enter('decipher'); });
    expect(result.current.gate).toBe('decipher');
  });

  it('manually skipping an intro still counts as seen', () => {
    const { result } = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { result.current.enter('survival'); });
    act(() => result.current.close()); // Escape / skip
    act(() => { result.current.enter('survival'); });
    expect(result.current.gate).toBeNull();
  });

  it('exiting and re-entering a mode does not reset the visit tracking (the record lives above the mode)', () => {
    const { result, rerender } = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { result.current.enter('archaeology'); });
    act(() => result.current.close());
    rerender();
    act(() => { result.current.enter('archaeology'); });
    expect(result.current.gate).toBeNull();
  });

  it('a new website load (a fresh provider) makes the intro eligible again', () => {
    const first = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { first.result.current.enter('civilization'); });
    first.unmount();
    const second = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { second.result.current.enter('civilization'); });
    expect(second.result.current.gate).toBe('civilization');
  });

  it('Replay Intro always plays, and does not change the record', () => {
    const { result } = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { result.current.enter('civilization'); });
    act(() => result.current.close());
    act(() => result.current.replay('civilization'));
    expect(result.current.gate).toBe('civilization');
    act(() => result.current.close());
    act(() => { result.current.enter('civilization'); });
    expect(result.current.gate).toBeNull();
  });

  it('Minimum Path uses its own scene', () => {
    const { result } = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { result.current.enter('minimum-path'); });
    expect(result.current.gate).toBe('minpath');
  });

  it('does not use localStorage for eligibility', () => {
    window.localStorage.clear();
    const { result } = renderHook(() => useModeGate(), { wrapper: wrap });
    act(() => { result.current.enter('civilization'); });
    expect(window.localStorage.length).toBe(0);
  });
});
