import type { User } from '@supabase/supabase-js';
import { act,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { AuthProvider,useAuth } from '../src/app/context/AuthContext';
const mocks=vi.hoisted(() => ({ session:vi.fn(),signOut:vi.fn(),profile:vi.fn(),callback:null as null | ((event:string, session:{user:User} | null)=>void),reset:vi.fn() }));
vi.mock('@/lib/supabase',()=>({supabase:{auth:{getSession:mocks.session, signOut:mocks.signOut, onAuthStateChange:(cb:typeof mocks.callback)=>{mocks.callback=cb;return {data:{subscription:{unsubscribe:vi.fn()}}};}},from:()=>({select:()=>({eq:(_key:string,id:string)=>({maybeSingle:()=>mocks.profile(id)})})})}}));
vi.mock('@/lib/candidate',()=>({resetCandidateCaches:mocks.reset}));
function user(id:string) { return {id,email:id+'@example.invalid',app_metadata:{},user_metadata:{},aud:'authenticated',created_at:'2026-01-01'} as User; }
function deferred<T>() { let resolve!: (value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve}; }
function Consumer(){const value=useAuth();return <p>{value.loading?'loading':`${value.user?.id ?? 'none'}:${value.role ?? 'none'}`}</p>;}
beforeEach(()=>{mocks.session.mockReset();mocks.profile.mockReset();mocks.signOut.mockReset();mocks.reset.mockReset();mocks.profile.mockResolvedValue({data:{role:'candidate'},error:null});mocks.signOut.mockResolvedValue({error:null});});
afterEach(()=>vi.useRealTimers());
it('restarts inactivity timers when the user chooses to stay signed in',async()=>{
  vi.useFakeTimers();mocks.session.mockResolvedValue({data:{session:{user:user('active')}}});
  render(<AuthProvider><Consumer/></AuthProvider>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(0);});
  await act(async()=>{await vi.advanceTimersByTimeAsync(9*60*1000);});
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Session expiring soon');
  fireEvent.click(screen.getByRole('button',{name:'Stay Signed In'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await act(async()=>{await vi.advanceTimersByTimeAsync(9*60*1000);});
  expect(mocks.signOut).not.toHaveBeenCalled();
  await act(async()=>{await vi.advanceTimersByTimeAsync(60*1000);});
  expect(mocks.signOut).toHaveBeenCalledTimes(1);
});
it('ignores stale initial hydration after an auth event',async()=>{
  const initial=deferred<{data:{session:{user:User}}}>();mocks.session.mockReturnValue(initial.promise);
  render(<AuthProvider><Consumer/></AuthProvider>);
  act(()=>mocks.callback?.('SIGNED_IN',{user:user('new')}));
  await waitFor(()=>expect(screen.getByText('new:candidate')).toBeInTheDocument());
  await act(async()=>initial.resolve({data:{session:{user:user('old')}}}));
  expect(screen.getByText('new:candidate')).toBeInTheDocument();expect(mocks.profile).not.toHaveBeenCalledWith('old');
});
it('ignores stale role lookup when accounts switch',async()=>{
  mocks.session.mockResolvedValue({data:{session:null}});const old=deferred<{data:{role:string},error:null}>();
  mocks.profile.mockImplementation((id:string)=>id==='old'?old.promise:Promise.resolve({data:{role:'employer'},error:null}));
  render(<AuthProvider><Consumer/></AuthProvider>);await screen.findByText('none:none');
  act(()=>mocks.callback?.('SIGNED_IN',{user:user('old')}));await waitFor(()=>expect(mocks.profile).toHaveBeenCalledWith('old'));
  act(()=>mocks.callback?.('SIGNED_IN',{user:user('new')}));await screen.findByText('new:employer');
  await act(async()=>old.resolve({data:{role:'candidate'},error:null}));expect(screen.getByText('new:employer')).toBeInTheDocument();expect(mocks.reset).toHaveBeenCalled();
});
