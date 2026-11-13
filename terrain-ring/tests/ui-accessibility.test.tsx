// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { Choice } from '../src/components/Choice';
import { StepRing } from '../src/components/StepRing';
import { StepReview } from '../src/components/StepReview';
import { useRingStore } from '../src/state/ringStore';
import { useState } from 'react';
afterEach(cleanup);
function Fixture() { const [value,setValue]=useState('bar');return <Choice label="Head shape" value={value} options={[{value:'bar',label:'Bar',note:'Elongated face'},{value:'cushion',label:'Cushion',note:'Broader face'}]} onChange={setValue} />; }
describe('accessible customer choices',()=>{
 it('names its group, describes options, and supports native keyboard changes',async()=>{
  render(<Fixture/>); const user=userEvent.setup();
  expect(screen.getByRole('group',{name:'Head shape'})).toBeTruthy();
  await user.tab(); expect(document.activeElement).toBe(screen.getByRole('radio',{name:'Bar'}));
  await user.keyboard('{ArrowRight}'); expect((screen.getByRole('radio',{name:'Cushion'}) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole('radio',{name:'Cushion'}).getAttribute('aria-describedby')).toBeTruthy();
 });
 it('provides labelled native groups and no detected structural accessibility violations',async()=>{
  const {container}=render(<StepRing/>);
  for(const name of ['Head shape','Face size','Shoulders','Finish','Band profile'])expect(screen.getByRole('group',{name})).toBeTruthy();
  const result=await axe.run(container,{rules:{'color-contrast':{enabled:false}}});
  expect(result.violations.map(v=>v.id)).toEqual([]);
 });
 it('keeps ring options when moving to review and links back to editable steps',async()=>{
  useRingStore.setState({headShape:'cushion',weight:'bold',ringSize:null});let edited=-1;
  render(<StepReview stats={null} showCartMessage={true} onEdit={step=>{edited=step}}/>);
  expect(screen.getByText(/Nothing has been sent/)).toBeTruthy();
  expect(screen.getByText(/bold cushion head/i)).toBeTruthy();
  await userEvent.click(screen.getByRole('button',{name:'Edit landscape'}));expect(edited).toBe(1);
  expect(useRingStore.getState().weight).toBe('bold');
  await userEvent.click(screen.getByRole('radio',{name:'I know my size'}));expect(screen.getByRole('combobox',{name:'UK size'})).toBeTruthy();
 });
});
