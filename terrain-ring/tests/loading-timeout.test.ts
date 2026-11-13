import { afterEach, expect, it, vi } from 'vitest';
import { withTimeout } from '../src/lib/withTimeout';
afterEach(()=>vi.useRealTimers());
it('turns a stalled load into a finite failure',async()=>{vi.useFakeTimers();const waiting=withTimeout(new Promise(()=>{}),1000);const failure=expect(waiting).rejects.toThrow('timed out');await vi.advanceTimersByTimeAsync(1000);await failure;expect(vi.getTimerCount()).toBe(0);});
it('clears its timer after success or rejection',async()=>{vi.useFakeTimers();expect(await withTimeout(Promise.resolve('mesh'),1000)).toBe('mesh');await expect(withTimeout(Promise.reject(new Error('offline')),1000)).rejects.toThrow('offline');expect(vi.getTimerCount()).toBe(0);});
