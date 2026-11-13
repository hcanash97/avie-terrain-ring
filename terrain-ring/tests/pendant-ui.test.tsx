// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks=vi.hoisted(()=>({build:vi.fn(),load:vi.fn()}));
vi.mock('../src/geometry/pendant-preview',()=>({buildPendantPreview:mocks.build,pendantDisplayMesh:vi.fn(),presetFor:()=> 'pendant-tablet-classic',SIZE_TIERS:['petite','classic','statement']}));
vi.mock('../src/three/heightmap-loader',()=>({loadBakedSource:mocks.load}));
vi.mock('../src/three/scene',()=>({createScene:()=>({dispose:vi.fn(),setMaterial:vi.fn(),setClay:vi.fn(),setView:vi.fn()})}));
import { PendantPreview } from '../src/components/PendantPreview';
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('replaces failed builds with an honest fallback and retains selected settings for retry',async()=>{
 mocks.load.mockResolvedValue({radiusM:20000,elevationAt:()=>0});mocks.build.mockRejectedValue(new Error('wasm unavailable'));
 render(<PendantPreview/>);
 await screen.findByRole('heading',{name:'Preview unavailable'});
 expect(screen.getByText(/Style illustration shown/)).toBeTruthy();
 expect(screen.queryByText('Building…')).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Retry preview'}));
 await waitFor(()=>expect(mocks.build).toHaveBeenCalledTimes(2));
 expect((screen.getByRole('radio',{name:'Tablet Pendant'}) as HTMLInputElement).checked).toBe(true);
});
it('handles missing cached elevation instead of leaving an endless loading state',async()=>{
 mocks.load.mockResolvedValue(null);render(<PendantPreview/>);
 await screen.findByText(/The landscape couldn’t load/);
 expect(screen.queryByText('Preparing pendant preview…')).toBeNull();expect(mocks.build).not.toHaveBeenCalled();
});
