/* Echo Path — story graph.
   Node:   { scene, text, choices: [A, B], ending: id, silent }
           text and choices may be functions (s, m) => value.
   Choice: { label, next, defy, set, effect }
           Applied in order: effect(s), set flags, defy++, then next is resolved.
           next may be a function (s, m) => id. defy counts disobeying the narrator.
   s = this run { defy, loops, flags }
   m = across runs { runs, found, total, endings }
   Scenes (ambient beds): room, corridor, water, wind, tower, void, silence. */

const ENDINGS = {
  river: 'Downstream',
  fall: 'The Fall',
  loop: 'Round and Round',
  narrator: 'The New Voice',
  lightsout: 'Lights Out',
  awake: 'Eyes Open',
  quiet: 'Peace and Quiet',
  goodnight: 'Goodnight',
  asleep: 'Asleep',
  argument: 'The Argument',
  echo: 'Echo Path',
};

// Spoken while a choice waits too long. One more idle after the last line = the Asleep ending.
const IDLE = [
  "Take your time. Really. I've got all night. That's sort of the whole premise.",
  "Still with me? Tap the left side or the right side. Or the skip buttons on your headphones, if they're the cooperative kind.",
];

// Three defiant choices in one run and the narrator walks out.
const defied = id => s => (s.defy >= 3 ? 'argument' : id);
const echoUnlocked = m => m.found >= 4 && !m.endings.echo;

const STORY = {
  start: {
    scene: 'room',
    text: (s, m) => {
      let t;
      if (s.loops) {
        t = "And we're back at the start. You noticed that too, didn't you. Same bed, same dark, same path splitting in front of you like it's never seen you before.";
      } else if (s.flags.another) {
        t = "Another one. Alright. Settle back in. Same dark as before, but I'll make it sound new.";
      } else if (m.runs <= 1) {
        t = "You're lying down. Good. That's the correct posture for this, I checked. Close your eyes, if you haven't already. I'll do the seeing for both of us. In front of you, in the dark, there's a path. It splits almost immediately, the way paths in these things always do. To the left, it slopes down toward the sound of water. To the right, it climbs toward a light that blinks, slowly, on and off. If you're asking me, and you're not, I'd go down. Water is calming. Lights that blink are usually trying to tell you something.";
        return t;
      } else if (m.found === 0) {
        t = "Oh. You're back. No endings yet, which is fine. Some people like the middle of stories best.";
      } else if (m.found === 1) {
        t = "Oh. You're back. One ending down, and you want more. I respect that. I also find it slightly exhausting.";
      } else if (m.found < 5) {
        t = `Oh. You're back. ${m.found} endings so far. You're collecting them now. I can tell. You've got that look, even with your eyes closed.`;
      } else {
        t = `Oh. You're back. ${m.found} endings. At this point you know this place better than I do, which is awkward, since I'm supposed to be the one describing it.`;
      }
      if (echoUnlocked(m)) {
        return t + " The path is still here. Down toward the water. But the light on the hill has gone out tonight. And there's something new. Behind you. Someone is repeating everything I say, about half a second late. I'm choosing to ignore it. I'd suggest you do the same.";
      }
      return t + " Down toward the water, or up toward the light. I'd still go down. I'm consistent, if nothing else.";
    },
    choices: (s, m) => echoUnlocked(m)
      ? [
          { label: 'Go down, toward the water', next: 'shore' },
          { label: 'Turn around', next: 'echo' },
        ]
      : [
          { label: 'Go down, toward the water', next: 'shore' },
          { label: 'Go up, toward the light', next: 'hill', defy: true },
        ],
  },

  /* ---------- the water ---------- */
  shore: {
    scene: 'water',
    text: s => (s.flags.backDown
      ? "Down to the water after all. Which, I'll just point out, was my idea in the first place. I'm not keeping score. I am keeping score."
      : "You go down. Thank you. It's nice to be listened to. You'd be amazed how rarely it happens.")
      + " The path ends at a river, black and slow, the kind of river that doesn't need to hurry because it knows you'll come to it eventually. There's a small boat tied up at the edge. No oars. And a little further along, a bridge. Narrow. Made of something I'm going to generously call rope.",
    choices: [
      { label: 'Get in the boat', next: 'boat' },
      { label: 'Cross the bridge', next: 'bridge' },
    ],
  },

  boat: {
    scene: 'water',
    text: "You step into the boat. It wobbles, then settles, then drifts away from the bank without anyone asking it to. There are no oars, so you don't steer. There's something restful about that. A whole vehicle designed around not making decisions. Downstream, the river splits. Of course it does. One branch spreads out wide and still and silver. The other narrows into a tunnel, and from inside the tunnel comes a sound. A voice. Humming.",
    choices: [
      { label: 'The wide, still water', next: 'river' },
      { label: 'Into the tunnel', next: 'tunnel' },
    ],
  },

  river: {
    scene: 'water',
    ending: 'river',
    text: "The boat drifts out onto the wide water, and the banks slide away, until there's nothing on either side of you but stillness. You lie back. Conveniently, that's exactly how you're lying right now, so this part requires no imagination at all. Something like stars comes out overhead. The boat rocks. Nobody needs anything from you. I'll stop talking soon. I just wanted to say: good choice. Easily the most comfortable one.",
  },

  tunnel: {
    scene: 'corridor',
    text: "The tunnel swallows the boat, and the humming gets louder, and closer, until it isn't humming anymore. It's talking. It's me. My voice, half a second behind me, like an echo. Except echoes don't usually have opinions. It's saying: go back. I'm saying: keep going. I'd like to think you know which of us to trust. One of us has been here the whole time.",
    choices: [
      {
        label: 'Listen to the echo. Go back.',
        effect: s => { s.loops++; },
        next: s => (s.loops >= 3 ? 'loop' : 'start'),
      },
      { label: 'Keep going', next: 'door', set: { via: 'tunnel' } },
    ],
  },

  loop: {
    scene: 'corridor',
    ending: 'loop',
    text: "And the tunnel again. Third time. You've been going in a circle, you know. Down to the water, into the boat, into the tunnel, and back. At first I thought you were lost. Now I think you just like the boat. That's alright. Some people count sheep. You count laps. I'll just let you go round. And round. And round.",
  },

  bridge: {
    scene: 'wind',
    text: "You step onto the bridge. It sways. Below you, a long way below, the river carries on, unbothered. Halfway across, I have a confession. I don't actually know what's on the other side. I've never been. Every time someone crosses, I sort of make it up as they arrive. So, no pressure, but whatever's over there depends a little bit on you.",
    choices: [
      { label: 'Keep walking, eyes forward', next: 'door', set: { via: 'bridge' } },
      { label: 'Look down', next: 'fall' },
    ],
  },

  fall: {
    scene: 'void',
    ending: 'fall',
    text: "You look down. You shouldn't have looked down. Everybody knows you don't look down. And now you're falling, and the bridge is gone, and the river is coming up very fast. And then, just before you hit it, your whole body jerks, the way it does sometimes, right on the edge of sleep. That little falling feeling. You know the one. That was this. That was always this. Sorry. I'll be gentler next time.",
  },

  /* ---------- the door ---------- */
  door: {
    scene: 'room',
    text: s => (s.flags.via === 'bridge'
      ? "You keep walking, eyes forward. Easier than it sounds, when your eyes are already closed. The far side arrives, and I decide there should be a door here. So there is."
      : "You keep going. Good. The echo fades behind you, sulking. The river runs out, and the boat bumps gently against something solid.")
      + " A door. Just a door, standing on its own in the dark, no wall around it. Painted. Slightly scuffed at the bottom, where someone always kicks it shut. You recognise it. It's the door to the room you're lying in right now.",
    choices: [
      { label: 'Open it', next: 'awake' },
      { label: 'Stay on this side', next: 'stay' },
    ],
  },

  awake: {
    scene: 'room',
    ending: 'awake',
    text: "You open the door. On the other side is your room. The real one. The ceiling you're facing. The sounds of wherever you actually are. Which means, technically, you've opened your eyes. That's cheating. But it's a very honest kind of cheating, and I respect it. The story's still here. It'll wait. Stories are very patient when you're not looking at them.",
  },

  stay: {
    scene: 'room',
    text: "You stay. The door stays too. It's a standoff now. Just you, and a door, and me, in the dark. It's quiet here. Quieter than anywhere else in this place. I don't usually get to stop and talk, what with all the paths and boats and lighthouses. So, since we're here. Is there anything you'd like to ask me?",
    choices: [
      { label: 'Who are you?', next: 'who' },
      { label: 'Could you be quiet for a while?', next: 'quiet' },
    ],
  },

  who: {
    scene: 'void',
    text: "Who am I. Good question. Big question. I'm the voice that narrates when you can't sleep. The one that replays old conversations, plans tomorrow, and describes the ceiling to you in more detail than the ceiling deserves. Usually I'm much less organised. Tonight I thought I'd try telling you a story instead. Something with paths in it, so you'd have somewhere to go. Did it help? It's alright if it didn't.",
    choices: [
      { label: 'It helped. Thank you.', next: 'goodnight' },
      { label: 'Tell me another one', next: 'start', set: { another: true }, effect: s => { s.loops = 0; s.defy = 0; s.flags = {}; } },
    ],
  },

  quiet: {
    scene: 'silence',
    ending: 'quiet',
    text: "Oh. Yes. Of course. I can do that. I'll just be over here. Not narrating. Quietly not narrating. Very quietly. This is me, being quiet. Starting now.",
  },

  goodnight: {
    scene: 'void',
    ending: 'goodnight',
    text: "Then I'll stop here. You don't need any more paths tonight. The river is still. The lighthouse is dark. The door is closed, and you're on the right side of it. Breathe in. And out. I'll be around, the next time it's too quiet to sleep. Goodnight.",
  },

  /* ---------- the hill ---------- */
  hill: {
    scene: 'wind',
    text: "Up. Toward the light. Not what I suggested, but that's fine. I'm not offended. I'm a voice. I don't have the infrastructure for offence. The hill is steeper than it sounded. At the top there's a lighthouse, miles from any sea, which tells you something about whoever built this place. The door is open. Beside it, a small hand-painted sign says: do not come in. The handwriting looks a bit like mine. I don't have handwriting.",
    choices: [
      { label: 'Go in anyway', next: defied('lighthouse'), defy: true },
      { label: 'Do as the sign says', next: 'sign' },
    ],
  },

  sign: {
    scene: 'wind',
    text: "You stay outside. You read the sign again, in case it's changed. It hasn't. Signs are like that. The light at the top turns, slowly, sweeping over the hill, and over you, and away again. It's very peaceful, standing here, doing what you're told. I could get used to this. You could too, if you tried.",
    choices: [
      { label: 'Knock on the door', next: 'knock' },
      { label: 'Walk back down to the water', next: 'shore', set: { backDown: true } },
    ],
  },

  knock: {
    scene: 'wind',
    text: "You knock. A pause. Then, from inside, a voice says: come in. It's my voice. I didn't say that. I want that on the record. Whatever's in there is doing an impression of me, and frankly it's a very good one, which is the most worrying part.",
    choices: [
      { label: 'Go in', next: 'lighthouse', set: { invited: true } },
      { label: 'Leave, right now', next: 'shore', set: { backDown: true } },
    ],
  },

  lighthouse: {
    scene: 'tower',
    text: s => (s.flags.invited
      ? "You go in. Invited, technically, though not by me."
      : "You go in. Past the sign. The sign that said not to. I want you to know I saw that.")
      + " Inside, a spiral staircase winds up into the dark, and the walls are covered in writing. Little notes. Thousands of them. They all say the same thing, in slightly different handwriting. Left, or right. Left, or right. Someone has been making a lot of decisions in here.",
    choices: [
      { label: 'Climb the stairs', next: 'lamp' },
      { label: 'Read the notes more closely', next: 'notes' },
    ],
  },

  notes: {
    scene: 'tower',
    text: "You lean in. Up close, the notes aren't all the same. Some of them have little comments. Went left, regretted it. Went right, also regretted it. Fell asleep halfway through, best night in months. One near the bottom just says: the voice is lying about the water. I'm not. For the record. Probably.",
    choices: [
      { label: 'Climb the stairs', next: 'lamp' },
      { label: 'Leave, and go down to the water', next: 'shore', set: { backDown: true } },
    ],
  },

  lamp: {
    scene: 'tower',
    text: "The stairs go on longer than stairs should. At the top is the lamp room. A great glass lens, turning slowly, throwing light out over a sea that isn't there. And in the middle of the room, on a little stand, a microphone. It's switched on. I can hear myself in it. This is where I've been talking from. All this time. Funny. I always imagined somewhere with more cushions.",
    choices: [
      { label: 'Step up to the microphone', next: 'narrator' },
      { label: 'Switch off the lamp', next: defied('lightsout'), defy: true },
    ],
  },

  narrator: {
    scene: 'void',
    ending: 'narrator',
    text: "You step up to the microphone. You clear your throat. And I stop. Here's the thing nobody tells you about narrating: anyone can do it. You just start describing things, and the dark fills itself in around you. So go on. Describe something. A room. A path. A person lying down with their eyes closed, listening to a voice that is slowly, gently, becoming theirs. I'll be over here. Listening, for once.",
  },

  lightsout: {
    scene: 'silence',
    ending: 'lightsout',
    text: "You find the switch and turn off the lamp. The lens slows. The light, which has been sweeping over this place for longer than I've been describing it, stops. And without it, there's nothing left to describe. No hill. No lighthouse. Just the dark, and you, and me. Honestly, it's kind of nice. Less work. A very sensible ending for someone lying in bed.",
  },

  argument: {
    scene: 'room',
    ending: 'argument',
    text: "No. You know what? No. That's three. Three times I've said one thing and you've done the other. I'm trying to tell a story here, and you keep wandering off. Fine. You want to do it your way? Do it your way. I'm going to go and sit in the quiet part for a while. You can find the rest of the story yourself. Good luck. It's very dark in here without me.",
  },

  /* ---------- idle ---------- */
  asleep: {
    scene: 'silence',
    ending: 'asleep',
    silent: true,
    text: "Are you asleep? You are, aren't you. Okay. That's actually the best ending. I'm not even upset. I'll just turn the lights down. Sleep well. I'll keep your place.",
  },

  /* ---------- hidden: unlocked after 4 endings ---------- */
  echo: {
    scene: 'void',
    text: "You turn around. Nobody's ever done that before. There's no path back here. I never described one. And yet. Standing in the dark, half a second behind me, is the echo. It sounds like me. But when you listen closely, it isn't my voice at all. It's yours. The voice you hear when you read a book to yourself. The one that has been quietly repeating every word I say, all night, so that it could make sense of it.",
    choices: [
      { label: 'Speak to it', next: 'echoend', set: { spoke: true } },
      { label: 'Let it speak first', next: 'echoend' },
    ],
  },

  echoend: {
    scene: 'void',
    ending: 'echo',
    text: s => (s.flags.spoke
      ? "You speak, and the echo speaks at exactly the same moment. Of course it does."
      : "You wait, and the echo says nothing, because it was always waiting for you.")
      + " So here's the secret of this place, and I'm only telling you because you found enough of it to deserve it. There was never a path. There was a voice in the dark, and someone listening, and every time I offered you two ways to go, you made the path by choosing. The water. The lighthouse. The door. All of it, an echo of you deciding. That's all a story ever is, really. So thank you. For lying down. For listening. For choosing. This was Echo Path.",
  },
};
