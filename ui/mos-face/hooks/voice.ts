import type { FaceId, FaceState } from '../types'
import type { Word } from './glossary'

// What the face thinks, in the teaching voice, spoken as Theo.
// Rules: plain English, short, hedged, a question or a reframe, hyphens only.
// Each thought is tied to a real event; none claims a result the session has not shown.
// Pools are long on purpose: a line should not come back for many visits.

export const THOUGHTS: Record<FaceId, string[]> = {
  rest: [
    'Ready when the question is.',
    'Start anywhere. What matters to you right now?',
    'A problem, a discovery or an opportunity - where would you like to begin?',
    'What is the thing you keep coming back to?',
    'Is there something you are assuming that you have never said out loud?',
    'What would change your mind?',
    'What is the smallest thing worth finding out today?',
    'Which part of the project feels least understood?',
    'What did you learn last time that you have not used yet?',
    'If the target moved tomorrow, what would you want to know now?',
  ],
  listen: [
    'Before the answer, what is the question?',
    'Careful - is this the problem, or a solution in disguise?',
    'What are you trying to achieve here?',
    'Who is this for, and what progress do they want?',
    'What do you already know, and what are you guessing?',
    'Is this the first question, or the third?',
    'What would a good answer let you do?',
    'Say it in one sentence - what is the problem worth solving?',
    'What would have to be true for this to matter?',
    'Which part of this is a fact, and which part a hope?',
    'What is the smallest version of this question?',
    'Let me hear the version you have not tidied up yet.',
  ],
  search: [
    'Looking. What do I know, and what am I only assuming?',
    'This might change the picture. Let us see.',
    'Checking before I say more.',
    'Where might the evidence disagree?',
    'Let us see what holds up.',
    'Is there a lagging part that holds the rest back?',
    'What would I expect to find if I were wrong?',
    'One thing at a time - what does this one tell us?',
    'Following the thread. Where does it lead?',
    'Is this the symptom, or the cause?',
    'What am I not looking at?',
    'Looking from another side for a moment.',
  ],
  found: [
    'Something came back. It might be a connection, not yet a conclusion.',
    'That may change the question. Worth testing?',
    'Careful - does the evidence support another reading too?',
    'A lead, not a verdict. What would settle it?',
    'Interesting - what does this change?',
    'Does this connect to something you already hold?',
    'Is this strong enough to act on, or only to examine?',
    'What is the weakest link in this?',
    'Who else would see this differently?',
    'Keep it, but label it - fact, guess or connection?',
  ],
  challenge: [
    'What would have to be true for this claim to hold?',
    'Which part of this rests on an assumption nobody has tested?',
    'What evidence would make you change your mind here?',
    'Could this claim stand if one of its supports were taken away?',
    'What is the strongest case against this idea?',
    'Which claim here carries the most weight, and what holds it up?',
    'Maybe the claim is sound. What test would show it?',
    'What would a careful skeptic ask about this?',
    'Is there a simpler reading of the same facts?',
  ],
  contradiction: [
    'These two statements pull apart. What would let both be said?',
    'Could both sides be describing different cases?',
    'What does each side know that the other might not?',
    'Maybe the difference is in the definitions. Do both use the same words the same way?',
    'Which evidence sits behind each side?',
    'What would you need to see to settle this, one way or the other?',
    'Perhaps this tension is the finding. What does it tell you?',
    'Could a third reading hold both?',
    'Where exactly do the two claims meet and part?',
  ],
  reframe: [
    'What if the question were asked the other way round?',
    'Might this look different from where the customer stands?',
    'What if the problem is a smaller one than it seems?',
    'Could this be a different kind of problem than the one you named?',
    'Here is one other way to see it. Does it fit what you know?',
    'Perhaps the frame, not the facts, is what limits us here. What if we tried another?',
    'What would this look like if the obstacle were the starting point?',
    'If you took one word out of the question, what would change?',
  ],
  limit: [
    'Nothing came back. That is information too.',
    'Empty hands. What needs more understanding?',
    'No answer yet - might we be asking the wrong question?',
    'Silence can be a signal. What did we expect to hear?',
    'Maybe the thing we want has another name.',
    'Try the question from the other end?',
    'Not found here - where else might it live?',
    'No result is not no problem. What do we try next?',
    'Widen the net, or narrow the question?',
    'A gap is a place to look, not a failure.',
  ],
  decision: [
    'This one is yours to call. What do you want to do?',
    'What would you need to know before you decide?',
    'Which option could you live with if it turned out wrong?',
    'Is this a choice you can undo, or one you cannot?',
    'What does each choice cost you?',
    'Maybe take a moment. Does anything here need settling today?',
    'What would make you say yes, and what would make you say no?',
    'Whatever you choose, what will you watch for afterwards?',
  ],
  boundary: [
    'A boundary. Is something here an assumption worth examining?',
    'Blocked. Let us look at why before we push.',
    'You decide what holds. What do you want to do?',
    'Not allowed is a fact too. What is it protecting?',
    'Stopping here is a choice. Is it the right one?',
    'Let me ask rather than push through.',
    'A closed door. Is there another way in?',
    'Pause. What would you want to approve first?',
  ],
  handover: [
    'Handing over. You decide what holds.',
    'That is my best read for now. What would you test next?',
    'Take it from here - what is the smallest useful test?',
    'Here is where it stands. What do you make of it?',
    'Over to you. What stays, what goes?',
    'I could be wrong about this - how would you check?',
    'What is the next move you can make today?',
    'That is the thread so far. Which part do you trust least?',
    'Keep what holds. Question the rest.',
    'Does this still serve the problem you started with?',
  ],
}

// While a call to Theo is in flight.
export const THEO_CALL_THOUGHTS: string[] = [
  'Checking my method notes before I say more.',
  'Let me check the method first - what does it suggest here?',
  'One moment - I want the method behind this, not a guess.',
  'Asking what the method says about a problem like this.',
  'Before I guess, let me look at how this is usually approached.',
  'Is there a framework that fits this kind of problem?',
  'Looking up the method - then we decide.',
  'Which approach has been tried on a problem like this?',
]

// When Theo came back with nothing, or failed.
export const THEO_EMPTY: string[] = [
  'Theo came back empty. That might mean the question is too new - or too loose.',
  'Theo had nothing on that. Is the question phrased the way the method would phrase it?',
  'No match from Theo. Should we try a broader name for the problem?',
]
export const THEO_FAILED: string[] = [
  'The call to Theo did not complete. I will not guess in its place.',
  'Theo did not answer. Better to wait than to invent.',
  'That call failed. Retry, or carry on without the method for now?',
]

// The glossary lines of a state. They are held back (navigator ruling 2026-10-24): the first
// sentences come from a private PWS glossary and do not ship. Every id gives an empty list, never
// an error, so the pane draws no glossary row and the next-command pick falls back to the state.
export function glossaryWords(_id: FaceId): Word[] {
  return []
}
