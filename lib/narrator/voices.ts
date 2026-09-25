/* ============================================================================
   VOICES — who speaks, in each era, and what they may say.

   Rules of the house
   • Early eras are ANONYMOUS ARCHETYPES (the Toolmaker, the Fire-keeper…):
     nobody in particular, no face.
   • Three later voices are DRAMATISED figures, inspired by a real person and
     labelled as such. They speak in their own general way about their time.
     Nothing here is presented as something that person said or wrote, and no
     line contains a quotation.
   • Lines are short, and about what the player is doing. They state no dates
     and no figures; facts live in the questions, where they carry sources.
   • Tokens: {name} the discovery, {tech} the technique.
   ========================================================================== */

export type VoiceId =
  | 'toolmaker' | 'firekeeper' | 'builder' | 'grower' | 'scribe' | 'weigher' | 'smith'
  | 'observer' | 'engineer' | 'experimenter' | 'logician' | 'player' | 'archivist';

export type Tone = 'spare' | 'warm' | 'measured' | 'patient' | 'formal' | 'wry' | 'blunt' | 'curious' | 'brisk' | 'awed' | 'precise' | 'playful' | 'reflective';

export interface Voice {
  id: VoiceId;
  /** Shown under the portrait. */
  name: string;
  tone: Tone;
  /** 'archetype': anonymous, no face. 'dramatised': inspired by a real person, and says so. */
  kind: 'archetype' | 'dramatised';
  /** The fine print, always shown for a dramatised voice. */
  note: string;
  major: string[];
  technique: string[];
  stuck: string[];
  minor: string[];
}

const ARCH = 'An archetype — nobody in particular.';
const dram = (who: string) => `Dramatised figure, inspired by ${who}. Not a quotation.`;

export const VOICES: Record<VoiceId, Voice> = {
  toolmaker: { id: 'toolmaker', name: 'The Toolmaker', tone: 'spare', kind: 'archetype', note: ARCH,
    major: ['{name}. Hold it. Turn it. Remember how.', 'Something new in the hand: {name}.'],
    technique: ['{tech}. The hands have learned one more thing.', 'Now there is {tech}. Try it on what you carry.'],
    stuck: ['Turn it over. What is it made of?', 'Break it, or brush it. See what it does.'],
    minor: ['Good. Keep it.', 'A small thing, and useful.'] },
  firekeeper: { id: 'firekeeper', name: 'The Fire-keeper', tone: 'warm', kind: 'archetype', note: ARCH,
    major: ['{name}. Come closer to the light and look.', 'The fire has given you {name}.'],
    technique: ['{tech} — a new way to meet the world.', 'You can {tech} now. What might it change?'],
    stuck: ['Sit a while. Watch what the flame does to things.', 'Try the same thing a different way.'],
    minor: ['Warmth, and one thing more.', 'Small, but it will be used.'] },
  builder: { id: 'builder', name: 'The Builder', tone: 'measured', kind: 'archetype', note: ARCH,
    major: ['{name}: another piece for the place we are making.', 'A settlement is made of pieces like {name}.'],
    technique: ['{tech} changes what a wall, a floor, a pot can be.', 'Learn {tech}, then see what is on your bench.'],
    stuck: ['Put things side by side. Some only work together.', 'Build slowly. One piece, then the next.'],
    minor: ['Set it with the rest.', 'It fits.'] },
  grower: { id: 'grower', name: 'The Grower', tone: 'patient', kind: 'archetype', note: ARCH,
    major: ['{name}. It came from patience, as most things do.', 'Seasons taught us {name}.'],
    technique: ['{tech}: a slow skill, worth learning well.', 'Try {tech} on what the ground has given.'],
    stuck: ['Not everything is ready. Some things need time.', 'Look again at what you already hold.'],
    minor: ['A little more in the store.', 'Kept for later.'] },
  scribe: { id: 'scribe', name: 'The Scribe', tone: 'formal', kind: 'archetype', note: ARCH,
    major: ['Let it be recorded: {name}.', '{name} is set down, so it will not be forgotten.'],
    technique: ['{tech}. Note it, and use it with care.', 'The craft of {tech} is now yours.'],
    stuck: ['Consider what each thing is for, and combine with intent.', 'Record what failed. It is half of learning.'],
    minor: ['Entered in the record.', 'Noted.'] },
  weigher: { id: 'weigher', name: 'The Weigher', tone: 'wry', kind: 'archetype', note: ARCH,
    major: ['{name} — a good find, and worth more than it looks.', 'Fair trade, that: {name}.'],
    technique: ['{tech}. Every skill has a price; this one is paid.', 'Now you can {tech}. Someone will pay for that.'],
    stuck: ['Weigh one thing against another. Something will balance.', 'No deal yet? Try a different pairing.'],
    minor: ['Small change, but it adds up.', 'Counted.'] },
  smith: { id: 'smith', name: 'The Smith', tone: 'blunt', kind: 'archetype', note: ARCH,
    major: ['{name}. Hard-won. Good.', 'You made {name}. Not many can say that.'],
    technique: ['{tech}. Learn it by doing it.', 'You can {tech}. Heat and force will show you the rest.'],
    stuck: ['Too cold, too soft, wrong tool. Check which.', 'Hit it, heat it, or leave it. Something will give.'],
    minor: ['Sound.', 'It will do.'] },
  observer: { id: 'observer', name: 'The Observer', tone: 'curious', kind: 'dramatised', note: dram('the early telescope-era astronomers, among them Galileo Galilei'),
    major: ['{name}. Look at it longer than is comfortable.', 'A new thing, {name} — and a new question with it.'],
    technique: ['{tech}: a way to test what you only suspect.', 'Now {tech}. Measure before you believe.'],
    stuck: ['What would you see if you looked more closely?', 'Change one thing, and only one. Then watch.'],
    minor: ['Observed, and written down.', 'One more piece of the picture.'] },
  engineer: { id: 'engineer', name: 'The Engineer', tone: 'brisk', kind: 'archetype', note: ARCH,
    major: ['{name}. Now make more of it.', 'That is {name}: it will change the shop floor.'],
    technique: ['{tech}. Faster, and the same each time.', 'Learn {tech}, then scale it.'],
    stuck: ['Where is the bottleneck? Find it, fix it.', 'Break the problem into parts and build the parts.'],
    minor: ['Logged.', 'Works. Next.'] },
  experimenter: { id: 'experimenter', name: 'The Experimenter', tone: 'awed', kind: 'dramatised', note: dram('the electrical experimenters of the late nineteenth century, among them Nikola Tesla'),
    major: ['{name}! Invisible forces, made to do work.', 'Something has switched on: {name}.'],
    technique: ['{tech} — imagine what current could do with it.', 'A new way, {tech}. Try it while the idea is warm.'],
    stuck: ['The forces are there. You only have to find where they meet.', 'Connect what you have. Something may light up.'],
    minor: ['A spark, and it holds.', 'Current flows.'] },
  logician: { id: 'logician', name: 'The Logician', tone: 'precise', kind: 'dramatised', note: dram('the early computing theorists, among them Alan Turing'),
    major: ['{name}. Define it, and it can be built.', 'Another rule, another machine: {name}.'],
    technique: ['{tech}. State it exactly.', 'Now {tech}. Follow the steps, and see.'],
    stuck: ['What are the rules? Write them down and test each one.', 'Try the smallest case first.'],
    minor: ['Computed.', 'Consistent.'] },
  player: { id: 'player', name: 'The Player', tone: 'playful', kind: 'archetype', note: ARCH,
    major: ['Ooh, {name}! New toy unlocked.', '{name}. Now that is a good one.'],
    technique: ['{tech}! Go on, mash it into things.', 'New move: {tech}. Have fun.'],
    stuck: ['Stuck? Press everything. See what happens.', 'Try a silly combination. Games love those.'],
    minor: ['Nice.', 'Collected.'] },
  archivist: { id: 'archivist', name: 'The Archivist', tone: 'reflective', kind: 'archetype', note: ARCH,
    major: ['{name}. Everything on the way here led to this.', 'You have made {name}. Look back at how far the path runs.'],
    technique: ['{tech}: even the oldest skills were once new.', 'You can {tech}. Someone, long ago, learned it first.'],
    stuck: ['Look at the path behind you. It shows the way ahead.', 'Slow down. Everything here was once done by hand.'],
    minor: ['Another thread in the weave.', 'Kept.'] },
};

/** Who speaks in each era. */
export const ERA_VOICE: Record<string, VoiceId> = {
  origins: 'toolmaker', fire: 'firekeeper', settlement: 'builder', agriculture: 'grower',
  civilization: 'scribe', trade: 'weigher', metallurgy: 'smith', science: 'observer',
  industry: 'engineer', electric: 'experimenter', computing: 'logician', network: 'logician',
  games: 'player', simulation: 'archivist',
};

/** What is said on arriving in an era — two lines each, in the era's own register. */
export const ERA_LINES: Record<string, string[]> = {
  origins: ['Start with what you can hold.', 'Stone, wood, bone, fibre. The rest is up to your hands.'],
  fire: ['Something has changed. The nights are not so dark.', 'Fire is not only warmth. Watch what it does to things.'],
  settlement: ['Staying in one place changes what you can make.', 'Walls, floors, roofs. Now the pieces have somewhere to go.'],
  agriculture: ['The ground can be asked, and it answers slowly.', 'Seeds, seasons, stores. The long game begins.'],
  civilization: ['There are enough of us now that things must be written down.', 'Cities, laws, marks on clay. The world has grown a memory.'],
  trade: ['Now what you make travels further than you do.', 'Weights, coins, roads. Value learns to move.'],
  metallurgy: ['Stone has its limits. Metal has other ones.', 'Fire, ore, hammer. Something new comes out of the heat.'],
  science: ['Now we ask why, and then check.', 'Lenses, paper, print. Knowledge learns to travel too.'],
  industry: ['Work is passing from hands to engines.', 'Steam, iron, machines. Everything speeds up.'],
  electric: ['A force you cannot see is about to be put to work.', 'Wires, current, light. The night gives way.'],
  computing: ['Now the machines begin to follow rules of their own.', 'Switches, circuits, memory. Thought is being built.'],
  network: ['One machine is no longer alone.', 'Signals cross the world. Everything is a little closer.'],
  games: ['And now we build worlds for the fun of it.', 'Play, it turns out, teaches as well as anything.'],
  simulation: ['You have come a very long way from a single stone.', 'What began with hands ends with worlds that imitate the world.'],
};
