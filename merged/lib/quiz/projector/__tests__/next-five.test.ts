/** Minimal pure-engine regression tests for all five new modes.
 * Full end-to-end room, permission, reward, clock and teaching tests are mandatory before deployment. */
import { createState } from '../session';
import { reduce } from '../engine';
import type { GameKey, PoolQuestion, ProjectorConfig, TeamRef, VerifiedAnswer, GameState } from '../types';
const NAMES: GameKey[] = ['auction_house','territory_war','lucky_factory','pirate_voyage','final_showdown'];
const teams: TeamRef[] = [{id:'alpha',name:'Alpha',order:0},{id:'beta',name:'Beta',order:1}];
const bank: PoolQuestion[] = Array.from({length:60},(_,i)=>({id:`q${i}`,position:i+1,kind:'multiple_choice',topic:null,difficulty:1 as const,difficultySource:'author',hasExplanation:true,repeatOf:null}));
const cfg=(game:GameKey):ProjectorConfig=>({v:1,game,focus:'balanced',minutes:15,seed:'test-seed',settings:{}});
function question(s:GameState){
  const first=reduce(s,{action:'ask'},{pool:bank});
  expect(first.ok).toBe(true);
  if(!first.ok)throw Error('Could not request a question');
  expect(first.need?.type).toBe('ask');
  const q=reduce(s,{action:'ask'},{pool:bank,question:{position:1,roomQuestionId:'rq-1',topic:null,difficulty:1,kind:'multiple_choice',topicFallback:false,repeat:false}});
  if(!q.ok)throw Error('Could not open a question');
  return q.state;
}
function grade(s:GameState, grade:'correct'|'wrong'='correct') {
  const team=s.core.ask?.teamIds[0]; if(!team)throw Error('No team was asked');
  const answer:VerifiedAnswer={submissionId:'sub-1',teamId:team,roomQuestionId:'rq-1',position:1,grade,fraction:grade==='correct'?1:0,kind:'multiple_choice',topic:null,difficulty:1,teacherOverride:false};
  const r=reduce(s,{action:'grade',payload:{teamId:team}},{pool:bank,answer});
  if(!r.ok)throw Error('Could not grade the answer');
  return r.state;
}
describe('Next five projector games',()=>{
  test.each(NAMES)('%s creates a legal scoreable session',(game)=>{
    const {state,plan}=createState(cfg(game),teams,bank,{synchronized:false});
    expect(state.core.game).toBe(game);
    expect(state.core.teams).toHaveLength(2);
    expect(plan.turnBudget).toBeGreaterThan(0);
    const first=reduce(state,{action:'grade',payload:{teamId:'alpha'}},{pool:bank});
    expect(first.ok).toBe(false); // never award points without an open question
  });
  test.each(NAMES)('%s uses verified grade to transition into a playable phase',(game)=>{
    let {state}=createState(cfg(game),teams,bank);
    if(game==='final_showdown'){
      const r=reduce(state,{action:'choose_action',payload:{team:'alpha',choice:'steady'}},{pool:bank});
      if(!r.ok)throw Error('Could not choose a showdown action');
      state=r.state;
    }
    state=grade(question(state));
    expect(['planning','resolution','review']).toContain(state.core.phase);
    expect(state.core.evidence).toHaveLength(1);
  });
  test('Factory production does not grant points before earning a verified answer',()=>{
    const {state}=createState(cfg('lucky_factory'),teams,bank);
    const r=reduce(state,{action:'build',payload:{team:'alpha',kind:'printer'}},{pool:bank});
    expect(r.ok).toBe(false);
  });
  test('Pirate sailing rejects impossible map jumps',()=>{
    let {state}=createState(cfg('pirate_voyage'),teams,bank);
    state=grade(question(state));
    const r=reduce(state,{action:'sail',payload:{team:'alpha',to:8}},{pool:bank});
    expect(r.ok).toBe(false);
  });
  test('Bids cannot exceed earned points',()=>{
    let {state}=createState(cfg('auction_house'),teams,bank);
    state=grade(question(state));
    expect(reduce(state,{action:'bid',payload:{team:'alpha',amount:999999}},{pool:bank}).ok).toBe(false);
  });
});
