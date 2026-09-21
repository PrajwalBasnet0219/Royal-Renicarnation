/* ROYAL REINCARNATION 3D — story.js
   All content. Appearance specs here drive the procedural 3D models in models.js,
   so a designer can restyle a heroine without touching geometry code. */
'use strict';

/* ---------------------------------------------------------------
   THE PREMISE, AND WHY IT HOLDS TOGETHER

   Avelune's air carries "veil" — a fine resonance that living things
   here are born tuned to. An outsider's body is not. That single rule
   supplies the game's early gating honestly:
      · you arrive weak and short of breath, and low tuning dulls your stride
     · you cannot pass the castle wards until you are tuned enough to survive outside
     · tuning rises by resting, eating, and — mostly — by talking to people,
       because language is how the veil learns the shape of you
    So Act 0 is a castle, a sickbed, and seven conversations. Nobody hands you a
    sword in the first minute, and the gate guard is not being arbitrary.
    You can walk and run freely — sickness only dulls you a little.
   --------------------------------------------------------------- */

const LORE = {
  title: 'Royal Reincarnation',
  sub: 'Arc One — The Eighth Loop',
  premise: 'A summoning circle drawn for seven loops was given eight. You are what the eighth loop caught.',
  veil: 'Veil: the resonance in Avelune\'s air. Natives are tuned to it from birth. Outsiders acclimatise or die.',
  secrets: [
    'Who drew the eighth loop, and why it was drawn in a hand nobody at court recognises.',
    'Why the seventh figure was chiselled out of the Whisperwood mural.',
    'Why Morvanna grieves a death you have not had yet.',
    'What is sealed under Veilmoon Tarn, and who has been watching the road for eleven years.',
    'Why the Choir only sings where a farewell was never finished.'
  ]
};

/* ---------------------------------------------------------------
   HEROINES — seven, matching the reference sheet left to right.
   `look` is consumed by models.js. Every hair spec includes a scalp
   cap plus volume pieces, so no model can render bald.
   --------------------------------------------------------------- */
const HEROINES = [
  {
    id: 'elvia', name: 'Elvia Rosehart', title: 'Knight of the Rose Ward',
    race: 'Human', age: 22, arche: 'Tsundere', combat: 'sword',
    home: 'castle', metAt: 'castle',
    look: {
      hair: 0xe9e9f2, hair2: 0xc6c6d6, eye: 0xc0182c, skin: 0xf6ddc8,
      style: 'hime', length: 1.0, accent: 'rose-crimson', lip: 0xb83a4a, bust: 0.95, waist: 0.88, hip: 1.0,
      dressA: 0x1b1218, dressB: 0xf4f1ea, trim: 0xb8112a, metal: 0xd8c188,
      silhouette: 'battledress', cape: 'half', capeColor: 0x8e0f22, height: 1.0
    },
    blurb: 'Silver hair, red eyes, a rose pinned where a helmet crest should be. Beats you in three seconds and then, quietly, shows you why.',
    likes: 'straight answers', dislikes: 'being thanked in public',
    cold: 'Do not look at me like that yet. Earn it first — run the drills with me, remember what I tell you, and then look at me however you like.',
    lines: {
      greet: [
        'You are upright. That is more than yesterday.',
        'Stand straighter. The court reads posture before it reads people.',
        'If you are going to follow me, keep pace.',
        'I checked on you twice last night. For security reasons.',
        'Boots laced? Good. The hall floor is slick and I am not carrying you.',
        'You look less pale. Do not let it go to your head.'
      ],
      warm: [
        'There you are. The day improves, marginally.',
        'I saved you the seat with the good light. Do not make a thing of it.',
        'Walk with me. The patrol is dull and you are less dull than the patrol.'
      ],
      kind: [
        'Do not say things like that where the guards can hear.',
        '…Noted. Move along before I have to respond to it.',
        'You are impossible. Keep the compliment. I have no use for it.',
        'I am not blushing. It is the torchlight. It is always the torchlight.',
        'Careful. If you keep talking like that I will start believing you.',
        'Hmph. Say it again when we are off duty. I want to hear how it sounds then.'
      ],
      joke: [
        'That was not funny. Say it again.',
        'The wall behind you laughed. I did not.',
        'If you die of that joke I am not writing the report.',
        'Terrible. I am smiling because you tried, not because it worked.',
        'Save that one for the princess. She needs treason to laugh at.'
      ],
      chat: [
        'Drills at dawn, same as always. Your footwork is improving — your guard still drops when you grin.',
        'Bess burnt the bread again. I took your share before it went. You owe me nothing. Eat it.',
        'The rose on my pin is from the ward garden. They bloom late this year. Everything here blooms late except gossip.',
        'I polished my sword twice today. That means I was thinking. Do not ask about what.',
        'Rain tomorrow, the stones say. Good weather for the training yard — bad weather for everyone in it.',
        'Holt snores on gate watch. I have proof. If he gives you trouble, tell me and the proof appears.'
      ],
      romance: [
        'My oath says protect the crown. It never said anything about wanting to walk beside you after duty. I checked. Twice.',
        'You stand behind me in drills and I feel steadier. A knight should not say that. I am saying it anyway.',
        'If I pin a rose on you, the whole court will talk. …Hold still. Let them talk.',
        'Whatever the eighth loop caught, I am glad it was you. There. Arrest me if you must.'
      ],
      combat: ['Behind me.', 'Guard up!', 'Down. Next.'],
      deep: [
        'My oath says protect the crown. It said nothing about wanting to.',
        'Everyone I have guarded, I have outlived. Do not make that a pattern.',
        'The rose crest means I take the blow first. It does not mean I am not afraid. It means I decided anyway.'
      ],
      part: [
        'Go on. And come back in one piece — that is an order, not a wish.',
        'Duty calls. Yours is to rest; mine is to make sure you do.'
      ]
    }
  },
  {
    id: 'seraphine', name: 'Seraphine Auverne', title: 'Crown Princess of Avelune',
    race: 'Human', age: 21, arche: 'Regal deredere', combat: 'light',
    home: 'castle', metAt: 'castle',
    look: {
      hair: 0xf0d98a, hair2: 0xc9ac57, eye: 0x4b8fe0, skin: 0xfae3d0,
      style: 'wave', length: 1.1, accent: 'crown-sapphire', lip: 0xc07890, bust: 1.08, waist: 0.9, hip: 1.1,
      dressA: 0xfbf7ee, dressB: 0xdce9fb, trim: 0x3f6fc4, metal: 0xe6cf92,
      silhouette: 'ballgown', cape: 'none', capeColor: 0xcfe0f6, height: 1.0
    },
    blurb: 'Blonde, blue-eyed, wearing the only crown in the room that nobody argues with. She signs your gate writ, and she is the reason you can leave at all.',
    likes: 'being spoken to plainly', dislikes: 'flattery with a request attached',
    cold: 'You are sweet, and you are early. Ask me again when I seek out your company on purpose — you will know, because the whole court will know.',
    lines: {
      greet: [
        'The court calls you the Eighth Loop. I have decided to call you by your name.',
        'You are walking without the cane. I am told that took four days less than expected.',
        'Sit. Nobody sits in this room and it makes the room unbearable.',
        'You may speak freely. That is an order, which rather ruins the point.',
        'I moved the audience to the small room. Fewer chairs, better tea, no audience.',
        'You look well. I had them put honey in the tea. Do not tell the steward.'
      ],
      warm: [
        'Oh, good — it is you. The day has been all petitions. Rescue me with ordinary talk.',
        'I kept the window seat for you. The view is mine by birth; the company is my choice.',
        'Come. Walk the gallery with me. The portraits are boring and you are not.'
      ],
      kind: [
        'Thank you. I do not hear that sentence without a petition attached to it.',
        'Oh. You meant it. Give me a moment to be a person about it.',
        'Careful. Kindness is the only currency I cannot audit.',
        'You say that as if I were simply a woman. No one has afforded me that in years.',
        'Then I shall be worthy of the compliment. That is what crowns are for, I am told.',
        'Keep talking. The council can wait. For once, let them.'
      ],
      joke: [
        'That is treason, technically. Continue.',
        'I laughed. If anyone asks, I coughed.',
        'You are going to get me removed from a very tall balcony.',
        'Stop — the guards are staring. …Say it again, quieter.',
        'I shall have that carved on my tomb. Anonymously, of course.'
      ],
      chat: [
        'The council argued about grain tariffs for two hours. I thought of your face and survived.',
        'Do you miss your world? You never say. I ask because I would miss mine, and mine is mostly paperwork.',
        'The garden roses are early. I cut one for my desk and thought of pinning one on you instead.',
        'I read late — histories, mostly. They all lie the same way. You, at least, lie entertainingly.',
        'The cook asks after you every morning. Twice, yesterday. I pretend not to notice the pattern.',
        'If you could go anywhere past the gate, where first? I want to hear somewhere that is not a map.'
      ],
      romance: [
        'Everyone kneels. You sit beside me and ask if I am tired. That is the whole of it. That is everything.',
        'I have been engaged three times to maps and treaties. You are the first thing here that chose to arrive — stay, and choose to stay.',
        'Take my hand where the court can see. Let them write their letters. I am done being careful with this.',
        'When this is over — the loops, the seals, all of it — I want one ordinary evening. You, tea, no crown. Promise me that.'
      ],
      combat: ['Hold the line!', 'For the Rose Ward!', 'You are not taking him.'],
      deep: [
        'Father signed the summoning order. He did not draw the eighth loop. Somebody in this castle did.',
        'I have been engaged three times to maps. You are the first thing here that chose to arrive.',
        'A crown is a promise to grieve in public. Smile with me here, where no one is watching, and I can bear it.'
      ],
      part: [
        'Go gently. The castle is safer with you in it, and I am allowed to say so.',
        'Until later. That is a royal appointment — do not be late.'
      ]
    }
  },
  {
    id: 'ignia', name: 'Ignia Vance', title: 'The Cinder Duelist',
    race: 'Human', age: 24, arche: 'Bad-girl rival', combat: 'greatsword',
    home: 'emberfall', metAt: 'emberfall',
    look: {
      hair: 0xc2172c, hair2: 0x7d0a19, eye: 0xf09a1e, skin: 0xf3d6bd,
      style: 'wild', length: 1.05, accent: 'ember-horn', lip: 0xa8342a, bust: 1.0, waist: 0.9, hip: 1.02,
      dressA: 0x141016, dressB: 0x5a0d18, trim: 0xd83a2a, metal: 0xc9a05a,
      silhouette: 'duelist', cape: 'half', capeColor: 0x6e0d1a, height: 1.02
    },
    blurb: 'Crimson hair, amber eyes, a sword longer than her patience. Calls every win of yours luck, then waits outside to spar again.',
    likes: 'a rematch', dislikes: 'being handled gently',
    cold: 'Ha! Bold. Wrong, but bold. Beat me properly first — then say pretty things and I might even hear them.',
    lines: {
      greet: [
        'Still breathing. Disappointing. I had a bet.',
        'Outsider. Draw or move.',
        'You walk like someone who has been told they are important. Fix that.',
        'I saved you a fight. Do not thank me, just lose properly.',
        'You are late. I warmed up twice. The second one was for fun.',
        'Good, you showed. I was starting to miss insulting you.'
      ],
      warm: [
        'Well, well. My favourite almost-winner.',
        'Sit. Water first, sparring second, and I will go easy. Mostly lies, all three.',
        'You have that look. The one before you surprise me. I like that look.'
      ],
      kind: [
        'Do not get soft on me. I liked you better rude.',
        'Hah. Save the pretty words for the princess.',
        '…Say that one more time and I will have to be nice back. Do not.',
        'Tch. Fine. You fight dirty and talk sweet. It is extremely annoying. Keep doing it.',
        'You mean that. Huh. Nobody means things at me. …Do not repeat this.',
        'Careful, outsider. I collect rematches, and now I am collecting something else.'
      ],
      joke: [
        'That was terrible. I am stealing it.',
        'Funny. You are still losing.',
        'Ha! Right, now put your guard up, comedian.',
        'I laughed so hard I dropped my stance. You owe me a bout for that.',
        'Okay, that one earned you a head start. Ten seconds. Run.'
      ],
      chat: [
        'New edge on the greatsword. Try not to chip it with your face this time.',
        'Emberfall nights smell of coal and rain. You will see. I will show you the good sparring pits.',
        'I ate half a pie before training. Coach would kill me. Worth it. Want the other half?',
        'Scar report: the shoulder one itches before rain. The hand one is from you. Favourite one, that.',
        'The festival duels are coming. Enter. Lose to me in public — it builds character. Yours.',
        'You sleep badly before fights. I can tell. Breathe with me — in, out — like footwork.'
      ],
      romance: [
        'I wanted a rival. The loop gave me you instead, and I am done pretending those are different things.',
        'Everyone else fights me careful. You fight me honest. That is why I wait outside your door, idiot.',
        'Win or lose the next bout — afterwards, walk with me. No swords. Just us, and the coal-smell night.',
        'Mine. That is what duelists say when something matters. You matter. Rematch me forever.'
      ],
      combat: ['Mine!', 'Try and keep up!', 'That all?'],
      deep: [
        'My house burned with my name still on the door. I kept the name.',
        'I am not chasing you. I am chasing whatever cracked the sky. You just happen to be standing in it.',
        'I laugh loud so nobody hears the quiet part. You hear it anyway. That is the problem with you.'
      ],
      part: [
        'Go. Train, eat, sleep — in that order. I will check. I always check.',
        'Later. And stretch. I refuse to duel a pulled muscle.'
      ]
    }
  },
  {
    id: 'yorune', name: 'Yorune Ashglass', title: 'Court Mage of the Violet Hall',
    race: 'Human', age: 23, arche: 'Kuudere', combat: 'mage',
    home: 'castle', metAt: 'castle',
    look: {
      hair: 0x8f9a9e, hair2: 0x39444a, eye: 0x1fa89a, skin: 0xf7e0cd,
      style: 'straight', length: 1.15, accent: 'frost-lily', lip: 0xa86a76, bust: 0.9, waist: 0.86, hip: 0.95,
      dressA: 0x0e2028, dressB: 0x2a6f78, trim: 0x7ad8c8, metal: 0xc8d4d8,
      silhouette: 'mage-robe', cape: 'full', capeColor: 0x12333b, height: 1.0
    },
    blurb: 'Ash-silver hair, teal eyes, the only person at court who wrote down what the circle actually did. She files you as an anomaly and then keeps checking the file.',
    likes: 'precision', dislikes: 'being told to relax',
    cold: 'That input is premature. Collect more data — walk with me, talk with me — and resubmit the hypothesis later.',
    lines: {
      greet: [
        'Your resonance is up four points. Hold still, I am not staring.',
        'The circle had eight loops. Eight. I have redrawn it nine times to be certain.',
        'You are interrupting. Continue interrupting, it is going badly anyway.',
        'I labelled a jar with your name. It is for readings. Mostly.',
        'Sit exactly there. The ward-light is better and I can see your breathing.',
        'You are early. Unusual. I have logged it.'
      ],
      warm: [
        'Hypothesis: your company improves my work. Evidence: mounting. Conclusion: stay.',
        'I made tea. I never make tea. Do not extrapolate. …Extrapolate.',
        'The readings can wait. You cannot. That sentence troubles me. Sit anyway.'
      ],
      kind: [
        'Recorded. Filed. Not in the archive — in the other place.',
        'That was warm. I am not equipped. Give me a moment.',
        'You should not say true things so casually. They stay.',
        'Noted, with unusual ink. The archive gets black. This gets violet.',
        'My pulse elevated 11 percent. Irrelevant. Continue.',
        'You are kind the way theorems are true — without effort, and impossible to argue with.'
      ],
      joke: [
        'Humour noted. Result: unexpected. I will run it again.',
        'I have laughed twice this year. You have both of them.',
        'That is objectively poor. I am smiling for unrelated reasons.',
        'Ha. Short, involuntary, statistically significant.',
        'I will cite you in my notes. Under “anomalous joy”.'
      ],
      chat: [
        'The moths in the Violet Hall navigate by resonance. Like you, they arrived confused and adapted beautifully.',
        'I reorganised the reagents by volatility. It took six hours. It was worth it. Do not touch anything.',
        'Sleep is a tuning process. Eight hours. I prescribe it the way physicians prescribe tonic — and ignore it the same way.',
        'The ribbon you gave me — it marks the page on veil harmonics. It has never left that page. It never will.',
        'Rain interferes with readings. I like rain anyway. Contradiction noted, preference retained.',
        'Describe your sky to me. Mine has two moons on clear nights. I want to know what yours had.'
      ],
      romance: [
        'I can measure everything about you except why the measurements make me nervous. I would like to keep measuring. Forever.',
        'Eight loops means intent. My intent, right now, is this: stay past the readings. Stay for tea. Stay.',
        'You are my favourite anomaly. I have never had one before. I do not want another.',
        'Hold my hand. Pulse data needed. …The data is excellent. Do not let go.'
      ],
      combat: ['Stand clear.', 'Calculating — down!', 'Resolved.'],
      deep: [
        'Eight loops means intent. Someone wanted a door, not a hero.',
        'I can measure everything about you except why the measurements make me nervous.',
        'I file everything. You are the only file I keep on my desk instead of the shelf.'
      ],
      part: [
        'Go. Hydrate. The readings say you forget. I keep the readings.',
        'Return within the hour. The experiment requires you. …I require you.'
      ]
    }
  },
  {
    id: 'rurika', name: 'Rurika Moonwell', title: 'Archivist of Prismere',
    race: 'Elf', age: 22, arche: 'Gentle scholar', combat: 'healer',
    home: 'prismere', metAt: 'prismere',
    look: {
      hair: 0xe8c86a, hair2: 0xa87830, eye: 0x5f8fd8, skin: 0xfbe6d6,
      style: 'braid', length: 1.12, accent: 'frost-lily', lip: 0xd08a90, bust: 1.06, waist: 0.94, hip: 1.09,
      dressA: 0xf7fbff, dressB: 0xbcd6f5, trim: 0x2f6bc0, metal: 0xe0d2a4,
      silhouette: 'a-line', cape: 'none', capeColor: 0xd6e6fa, ears: 'elf', height: 0.99
    },
    blurb: 'Honey-blonde hair, long ears, an archive she is not supposed to open. Proves the summoning was aimed rather than accidental.',
    likes: 'questions asked properly', dislikes: 'loud rooms',
    cold: 'Oh — oh. Give me a little longer, please? I want to be brave on purpose, not by accident, when you say things like that.',
    lines: {
      greet: [
        'You came. The index said you would, which is unsettling, because I wrote the index.',
        'Mind the third shelf. It bites, in the legal sense.',
        'I have your file. I have had your file for eleven years. That is the problem.',
        'Speak quietly. Not for the books — for me.',
        'I saved you the chair by the lamp. It is the warm one. I tested all of them.',
        'You are right on time. The archive likes you. It told me. (It did not. I like you.)'
      ],
      warm: [
        'You are here. The whole archive feels brighter. That is not a metaphor — the lanterns lean toward you.',
        'I pressed a flower for you. It is on page forty. Everything important is on page forty.',
        'Read with me. Separate books, shared blanket. It is my favourite arrangement.'
      ],
      kind: [
        'That is a kind thing said carelessly, which is the best kind.',
        'I will remember that longer than is reasonable.',
        'Oh. Thank you. I am going to reshelve something now.',
        'You say that and my ears go warm. Do not look at them. Everyone looks at them.',
        'I catalogue kindnesses. Yours has its own shelf. It is getting crowded.',
        'Then I am glad — glad to be found, glad it was you who found me.'
      ],
      joke: [
        'Ha — sorry. Library voice. Ha.',
        'I am writing that down under "evidence of character".',
        'That was awful and I would like another.',
        'Shh — the books are laughing. …It is me. I am the books.',
        'That joke is now banned from the reading room. Come to the back and tell it again.'
      ],
      chat: [
        'The frost lilies bloomed early. I pressed one for every year I waited. Eleven. Would you like to see?',
        'Third shelf bit a novice today. I patched him up and fined him. Both are tradition.',
        'I am translating a drowned logbook. The ink runs, but the love letters in the margins survived. Funny, that.',
        'Do you like rain? The archive roof sings in it. I saved you the listening corner.',
        'I made tea with honey, the way you like it. I noticed the way you like it. I notice everything about you.',
        'Tell me a small thing about your world. A food, a song. I will shelve it with the important things.'
      ],
      romance: [
        'I did not want to be the one who found you. I wanted to be the one you found. So find me — every day, the way you did today.',
        'Eleven years I kept your file. Now I would rather keep your hand. Is that — may I?',
        'You read over my shoulder and the words go soft. Stay there. The book can wait.',
        'Whatever page comes next, I want your name written in the margin of all of them.'
      ],
      combat: ['Hold on — mending!', 'Stay up, I have you.', 'Don\'t you dare fall.'],
      deep: [
        'Eleven years ago someone filed a request for an outsider. The signature was burned out of the page.',
        'I did not want to be the one who found you. I wanted to be the one you found.',
        'The archive remembers everything except why it kept your file warm. I think I know why now.'
      ],
      part: [
        'Go carefully. And come back — the lamp chair stays yours.',
        'I will be here, shelving. You will be out there, shining. Both of us working.'
      ]
    }
  },
  {
    id: 'morvanna', name: 'Morvanna Nightveil', title: 'The Veiled Mourner',
    race: 'Demon-kin', age: 23, arche: 'Yandere soulmate', combat: 'claw',
    home: 'ashmire', metAt: 'ashmire',
    look: {
      hair: 0xd8dbe6, hair2: 0x8b90a3, eye: 0xf0a020, skin: 0xf2dcc8,
      style: 'veil', length: 1.2, accent: 'gold-thorn', lip: 0x6e2438, bust: 1.07, waist: 0.88, hip: 1.09,
      dressA: 0x0f0c14, dressB: 0x231a2c, trim: 0xc8a24a, metal: 0xd8b566,
      silhouette: 'shroud', cape: 'full', capeColor: 0x0c0a11, hood: true, horns: true, height: 1.01
    },
    blurb: 'Hooded, gold-threaded, grieving in advance. She knew your face before you had one here, and she will not explain how.',
    likes: 'being chosen out loud', dislikes: 'goodbyes of any length',
    cold: 'Not yet. Love me slowly, or not at all — I have already mourned you once, and I will not survive loving a stranger.',
    lines: {
      greet: [
        'You are late by eleven years and a death. I am not counting. I am.',
        'Stay where I can see you. That is not a request, it is a preference stated firmly.',
        'You smell of the other side of the door. I have missed that.',
        'Do not say farewell to me. Say "later". Farewells are what the Choir eats.',
        'You came back. You always come back. I hated waiting and I would wait again.',
        'Sit with me a while. The marsh is quiet today and so am I, for once.'
      ],
      warm: [
        'There you are. The day was grey and now it is not. That is all the poetry I have.',
        'I brought roses. One for the grave, one for you. Guess which is which. (Both are for you.)',
        'Later, not farewell — but stay a little first. The light is kind on you today.'
      ],
      kind: [
        'Say it again. Slower. I want it kept properly.',
        'You did not say that, the first time. You never got the chance.',
        'I am keeping this. You gave it to me; that is how keeping works.',
        'You speak and something unclenches in my chest. Eleven years it has been clenched.',
        'No one says kind things at graves. Say them to me instead. I am listening. I am always listening.',
        'Then I am yours to keep, the way I keep everything you give me — fiercely, and forever.'
      ],
      joke: [
        'You laughed like that before. It is the only part that survived.',
        'Terrible. Do it forever.',
        'Ha. There you are.',
        'I almost smiled. The mourning veil slipped. Do it again, I dare you.',
        'Even the bog-shades laughed at that. I heard them. Do not tell them I smiled.'
      ],
      chat: [
        'I put fresh roses out today. White ones. They mean remembrance, and also — you.',
        'The marsh fog comes in by evening. Walk with me before it does. I know the dry path.',
        'I hum while I work. Old songs. You knew one of them, once. Hum with me and see.',
        'Do you dream? I dream of a road and running. Last night the running stopped. You were there.',
        'Eat. You go pale and it frightens me more than the Choir ever did. Here — honey loaf.',
        'Tell me about ordinary days where you are from. I collect them. They are all I ever wanted.'
      ],
      romance: [
        'I am not asking you to love me. I am asking you not to disappear mid-sentence again. Stay. Choose “later” with me, always.',
        'You died on a road I was three hours from. Let me walk every road with you now. Every single one.',
        'Take off my veil. No one has seen — no one living. I want you to be the one who knows my face.',
        'Whatever loop this is, eighth or eightieth, I find you in all of them. This time, I keep you.'
      ],
      combat: ['Do not touch him.', 'Mine to protect.', 'Stay dead this time.'],
      deep: [
        'You died on a road I was three hours from. I have walked it every year since.',
        'I am not asking you to love me. I am asking you not to disappear mid-sentence again.',
        'Grief is love with nowhere to go. Mine finally has somewhere. It has you.'
      ],
      part: [
        'Later. Say it. …Good. The Choir cannot eat “later”.',
        'Go. I will be here, keeping. It is what I do. It is what I am for.'
      ]
    }
  },
  {
    id: 'liora', name: '???', realName: 'Liora Vaine', title: 'The Sealed Watcher',
    race: 'Unknown', age: 22, arche: 'Devoted', combat: 'ward', sealed: true,
    home: 'tarn', metAt: 'tarn-depths',
    look: {
      hair: 0x23202e, hair2: 0x4a3a5e, eye: 0x6fa0e8, skin: 0xfbe8da,
      style: 'veil', length: 1.18, accent: 'moth-bloom', lip: 0xc98a94, bust: 1.0, waist: 0.9, hip: 1.04,
      dressA: 0x2a1a3e, dressB: 0x5a3a8a, trim: 0x9a5fe0, metal: 0xe4d6a8,
      silhouette: 'mermaid', cape: 'none', capeColor: 0x2a1a3a, height: 0.99
    },
    blurb: 'Behind the last seal under Veilmoon Tarn, a girl stands with violet blooms in her black hair and her eyes open. She has watched the road you would arrive on for eleven years.',
    likes: 'being finally looked at', dislikes: 'the word "wait"',
    cold: 'You are kind, and I am still learning how to be a person instead of a vigil. Walk with me a while longer first.',
    lines: {
      greet: [
        'Hello. I have practised this sentence for eleven years and it was that one.',
        'You are taller in daylight.',
        'I know your walk. I have known it longer than you have had it.',
        'Do not apologise for being late. You could not have been earlier.',
        'The water is still today. That means I am calm. I am calm because you are here.',
        'I saved you a story for today. I save one every day. Today you are here to hear it.'
      ],
      warm: [
        'You came back. The pedestals are still lit, but you are the light I watch for.',
        'Sit by the water with me. Eleven years I watched it alone. Never again.',
        'I picked a bloom for you. They never wilted in the seal. Neither did I, quite.'
      ],
      kind: [
        'I am going to remember exactly how you said that.',
        'You are kind out loud. Nobody warned me.',
        'That is the first thing anyone has said to me and not through stone.',
        'Say it again — the water carries sound beautifully here, and I want it to carry that.',
        'Eleven years of silence, and then your voice. It was worth every quiet year.',
        'You look at me like I am a person, not a seal. Keep looking. I am becoming one.'
      ],
      joke: [
        'Oh — I do that! I laugh! I had forgotten the sound.',
        'Terrible. Wonderful. Again.',
        'You are funny. I watched you be funny to nobody for years.',
        'I have eleven years of jokes saved up. None of them are good. Here is the least bad one.',
        'The Tarn echoed that back. It agrees. The Tarn is very wise.'
      ],
      chat: [
        'The blooms in my hair never faded, even sealed. I think they were waiting too. Everything was waiting.',
        'Teach me something small. A game, a song. I missed eleven years of small things.',
        'The water holds its breath the way I did. Breathe with me — in, out — we are both free now.',
        'I watched snow fall on the Tarn once through the seal-light. Will you watch the next snow with me? Outside?',
        'Do you like the quiet? I had so much of it. Yours is different — yours has birds in it.',
        'I am learning names for things again. Yours was the first one I kept. Say mine once more.'
      ],
      romance: [
        'I drew the eighth loop. I was nineteen and I wanted one person to arrive. It was always you. It is you.',
        'They sealed me for wanting you, and they were right to, and I would do it again. I would do it a hundred times.',
        'Hold my hand. I held my breath eleven years. I do not want to hold anything alone ever again.',
        'Stay. The Tarn is still, the seal is broken, and the girl who waited is finally, finally found.'
      ],
      combat: ['The seal taught me patience. Not mercy.', 'Step back, love.', 'It ends here.'],
      deep: [
        'I drew the eighth loop. I was nineteen and I wanted one person to arrive.',
        'They sealed me for it, and they were right to, and I would do it again.',
        'Eleven years I watched your road. I would watch eleven more. But I would rather walk it with you.'
      ],
      part: [
        'Go — and come back. The water stays still for you now. So do I.',
        'Later, love. The Tarn keeps. So do I.'
      ]
    }
  }
];

/* ---------------------------------------------------------------
   BIOMES — each with its own mobs, palette and ambient mood.
   --------------------------------------------------------------- */
const BIOMES = {
  meadow:  { name: 'The Rose Marches', ground: 0x4a6b44, ground2: 0x5d7d52, fog: 0xbcc8d6, mood: 'calm' },
  forest:  { name: 'Whisperwood',      ground: 0x2c4a33, ground2: 0x37583c, fog: 0x8fa79a, mood: 'wonder' },
  mountain:{ name: 'The Gravespine',   ground: 0x6b6b74, ground2: 0x8a8a92, fog: 0xc4c8d2, mood: 'tense' },
  volcano: { name: 'Emberfall Caldera',ground: 0x3a2320, ground2: 0x582c22, fog: 0xa8776a, mood: 'tense' },
  marsh:   { name: 'Ashmire',          ground: 0x3d4234, ground2: 0x4a4f3c, fog: 0x9a9d8e, mood: 'tense' },
  shore:   { name: 'Veilmoon Shore',   ground: 0xbdae88, ground2: 0xcabd98, fog: 0xb8c6d4, mood: 'wonder' },
  snow:    { name: 'Prismere Reach',   ground: 0xd6dde8, ground2: 0xe6ecf4, fog: 0xdde5ef, mood: 'wonder' }
};

const MOBS = {
  huskhound:  { name: 'Husk Hound',    biome: 'meadow',  hp: 34,  atk: 6,  spd: 5.2, xp: 16, r: 0.8, color: 0x6b5a4a, shape: 'quad' },
  brierling:  { name: 'Brierling',     biome: 'meadow',  hp: 24,  atk: 4,  spd: 3.4, xp: 12, r: 0.7, color: 0x5d7a46, shape: 'blob' },
  gloomfly:    { name: 'Gloomfly',      biome: 'meadow',  hp: 30,  atk: 7,  spd: 6.4, xp: 22, r: 0.7, color: 0x9ae86a, shape: 'wraith', fly: true, ranged: true },
  brassbeetle: { name: 'Brassbeetle',   biome: 'meadow',  hp: 85,  atk: 12, spd: 2.6, xp: 40, r: 1.1, color: 0xb08a3a, shape: 'quad' },
  duskhare:    { name: 'Duskhare',      biome: 'meadow',  hp: 8,   atk: 0,  spd: 6.2, xp: 6,  r: 0.35, color: 0x8a7a8a, shape: 'quad', passive: true, critter: true },
  honeymole:   { name: 'Honeymole',     biome: 'meadow',  hp: 14,  atk: 0,  spd: 3.8, xp: 8,  r: 0.4, color: 0xc8a05a, shape: 'quad', passive: true, critter: true },
  skyswift:    { name: 'Skyswift',      biome: 'meadow',  hp: 26,  atk: 6,  spd: 7.4, xp: 18, r: 0.55, color: 0x7ab8d8, shape: 'bird', fly: true },
  barkstalker:{ name: 'Bark Stalker',  biome: 'forest',  hp: 58,  atk: 10, spd: 4.4, xp: 30, r: 1.1, color: 0x4a3a28, shape: 'tall' },
  mothwraith: { name: 'Moth Wraith',   biome: 'forest',  hp: 40,  atk: 8,  spd: 6.0, xp: 26, r: 0.9, color: 0x8a7ea8, shape: 'wraith', fly: true },
  sporepuff:   { name: 'Sporepuff',     biome: 'forest',  hp: 55,  atk: 11, spd: 2.6, xp: 34, r: 1.0, color: 0x7ac86a, shape: 'blob', ranged: true },
  canopylurker:{ name: 'Canopy Lurker', biome: 'forest',  hp: 75,  atk: 14, spd: 5.0, xp: 44, r: 1.0, color: 0x3a5a3a, shape: 'tall' },
  fernfox:     { name: 'Fernfox',       biome: 'forest',  hp: 16,  atk: 0,  spd: 5.8, xp: 9,  r: 0.5, color: 0xb06a3a, shape: 'quad', passive: true, critter: true },
  mistdoe:     { name: 'Mistdoe',       biome: 'forest',  hp: 22,  atk: 0,  spd: 5.2, xp: 11, r: 0.65, color: 0xc8d0d8, shape: 'quad', passive: true, critter: true },
  owlet:       { name: 'Owlet',         biome: 'forest',  hp: 12,  atk: 0,  spd: 5.5, xp: 8,  r: 0.45, color: 0x9a8a6a, shape: 'bird', fly: true, passive: true, critter: true },
  thornspirit:{ name: 'Thorn Spirit',  biome: 'forest',  hp: 60,  atk: 13, spd: 4.2, xp: 42, r: 1.0, color: 0x4a8a3a, shape: 'wraith', eye: 0x6ae86a },
  aureatestag:{ name: 'Aureate Stag',  biome: 'forest',  hp: 30,  atk: 0,  spd: 6.0, xp: 25, r: 0.8, color: 0xe8d8a8, shape: 'quad', passive: true, critter: true, eye: 0x8a5a1a },
  thicketboar:{ name: 'Thicket Boar',  biome: 'forest',  hp: 70,  atk: 12, spd: 5.6, xp: 34, r: 1.0, color: 0x53412e, shape: 'quad' },
  stonegnaw:  { name: 'Stone Gnaw',    biome: 'mountain',hp: 88,  atk: 14, spd: 3.2, xp: 44, r: 1.2, color: 0x77777f, shape: 'blob' },
  frostkite:  { name: 'Frost Kite',    biome: 'mountain',hp: 46,  atk: 11, spd: 7.0, xp: 38, r: 0.9, color: 0xa8c4d8, shape: 'wraith', fly: true },
  emberdrake: { name: 'Ember Drake',   biome: 'volcano', hp: 130, atk: 20, spd: 5.0, xp: 80, r: 1.5, color: 0xa8352a, shape: 'drake', ranged: true },
  cinderimp:  { name: 'Cinder Imp',    biome: 'volcano', hp: 52,  atk: 13, spd: 6.4, xp: 40, r: 0.8, color: 0xd2562e, shape: 'tall' },
  magmacrawl: { name: 'Magma Crawler', biome: 'volcano', hp: 110, atk: 17, spd: 2.8, xp: 62, r: 1.3, color: 0x7a2a18, shape: 'blob' },
  slagfiend:   { name: 'Slagfiend',     biome: 'volcano', hp: 100, atk: 16, spd: 4.2, xp: 58, r: 1.2, color: 0x5a2a1a, shape: 'tall' },
  cinderwisp:  { name: 'Cinderwisp',    biome: 'volcano', hp: 42,  atk: 12, spd: 6.8, xp: 36, r: 0.7, color: 0xff8a3a, shape: 'wraith', fly: true, ranged: true },
  ashmole:     { name: 'Ashmole',       biome: 'volcano', hp: 12,  atk: 0,  spd: 3.6, xp: 7,  r: 0.35, color: 0x5a5550, shape: 'quad', passive: true, critter: true },
  cindernewt: { name: 'Cindernewt',    biome: 'volcano', hp: 10,  atk: 0,  spd: 4.2, xp: 7,  r: 0.4, color: 0xd86a2a, shape: 'blob', passive: true, critter: true },
  emberspirit:{ name: 'Ember Spirit',  biome: 'volcano', hp: 62,  atk: 15, spd: 5.4, xp: 46, r: 1.0, color: 0xe85a1a, shape: 'wraith', fly: true, ranged: true, eye: 0xffd27a },
  mireleech:  { name: 'Mire Leech',    biome: 'marsh',   hp: 64,  atk: 12, spd: 4.0, xp: 36, r: 1.0, color: 0x46523c, shape: 'blob' },
  bogshade:   { name: 'Bog Shade',     biome: 'marsh',   hp: 56,  atk: 14, spd: 5.4, xp: 42, r: 0.9, color: 0x2e3830, shape: 'wraith' },
  lanternhulk:{ name: 'Lantern Hulk',  biome: 'marsh',   hp: 95,  atk: 15, spd: 3.0, xp: 52, r: 1.3, color: 0x4a6a5a, shape: 'tall', ranged: true },
  mudlark:     { name: 'Mudlark',       biome: 'marsh',   hp: 34,  atk: 8,  spd: 6.8, xp: 24, r: 0.7, color: 0x6a5a3a, shape: 'bird', fly: true },
  reedfrog:    { name: 'Reedfrog',      biome: 'marsh',   hp: 10,  atk: 0,  spd: 4.6, xp: 6,  r: 0.45, color: 0x5a8a3a, shape: 'blob', passive: true, critter: true },
  mudhopper:  { name: 'Mudhopper',     biome: 'marsh',   hp: 12,  atk: 0,  spd: 5.2, xp: 7,  r: 0.35, color: 0x7a6a4a, shape: 'quad', passive: true, critter: true },
  miredrake:  { name: 'Mire Drake',    biome: 'marsh',   hp: 150, atk: 20, spd: 4.4, xp: 95, r: 1.7, color: 0x5a4a22, shape: 'drake', eye: 0xe8a83a },
  gullwraith: { name: 'Gull Wraith',   biome: 'shore',   hp: 38,  atk: 9,  spd: 6.6, xp: 28, r: 0.8, color: 0xc8cdd8, shape: 'wraith', fly: true },
  tidehusk:   { name: 'Tide Husk',     biome: 'shore',   hp: 60,  atk: 11, spd: 4.2, xp: 32, r: 1.0, color: 0x6a7f8a, shape: 'tall' },
  brineknight:{ name: 'Brine Knight',  biome: 'shore',   hp: 80,  atk: 14, spd: 4.0, xp: 46, r: 1.1, color: 0x3a7a8a, shape: 'tall' },
  foamcaller:  { name: 'Foamcaller',    biome: 'shore',   hp: 50,  atk: 12, spd: 5.8, xp: 38, r: 0.9, color: 0xbfe8f0, shape: 'wraith', fly: true, ranged: true },
  sandpiper:   { name: 'Sandpiper',     biome: 'shore',   hp: 10,  atk: 0,  spd: 6.0, xp: 7,  r: 0.45, color: 0xd8c8a8, shape: 'bird', fly: true, passive: true, critter: true },
  tidecrab:    { name: 'Tidecrab',      biome: 'shore',   hp: 16,  atk: 0,  spd: 3.2, xp: 8,  r: 0.5, color: 0xd86a4a, shape: 'crab', passive: true, critter: true },
  sungull:    { name: 'Sungull',       biome: 'shore',   hp: 30,  atk: 8,  spd: 7.0, xp: 22, r: 0.65, color: 0xf0ead8, shape: 'bird', fly: true, ranged: true },
  tidespirit: { name: 'Tide Spirit',   biome: 'shore',   hp: 60,  atk: 14, spd: 5.4, xp: 44, r: 1.0, color: 0x3aa8c8, shape: 'wraith', ranged: true, eye: 0xbff0ff },
  reefserpent:{ name: 'Reef Serpent',  biome: 'shore',   hp: 120, atk: 16, spd: 4.8, xp: 70, r: 1.6, color: 0x2a6a5a, shape: 'drake', ranged: true, swim: true, eye: 0x7ae8c8 },
  pearlray:   { name: 'Pearl Ray',     biome: 'shore',   hp: 55,  atk: 12, spd: 5.2, xp: 40, r: 1.0, color: 0xe8d8f0, shape: 'wraith', swim: true, eye: 0x4a8ac8 },
  tidefoal:   { name: 'Tide Foal',     biome: 'shore',   hp: 18,  atk: 0,  spd: 4.5, xp: 9,  r: 0.6, color: 0x8ac8d8, shape: 'quad', passive: true, critter: true, swim: true },
  rimewalker: { name: 'Rime Walker',   biome: 'snow',    hp: 96,  atk: 16, spd: 4.6, xp: 54, r: 1.2, color: 0xb6c6d6, shape: 'tall' },
  glassfang:  { name: 'Glass Fang',    biome: 'snow',    hp: 72,  atk: 15, spd: 6.2, xp: 48, r: 0.9, color: 0xdce8f4, shape: 'quad' },
  auroraibex:  { name: 'Aurora Ibex',   biome: 'snow',    hp: 80,  atk: 14, spd: 6.8, xp: 50, r: 1.0, color: 0x8ab8e8, shape: 'quad' },
  snowbell:    { name: 'Snowbell',      biome: 'snow',    hp: 44,  atk: 10, spd: 5.2, xp: 34, r: 0.8, color: 0xe8f0ff, shape: 'wraith', fly: true },
  snowhare:    { name: 'Snowhare',      biome: 'snow',    hp: 9,   atk: 0,  spd: 6.4, xp: 6,  r: 0.35, color: 0xf0f4fa, shape: 'quad', passive: true, critter: true },
  frostfox:    { name: 'Frostfox',      biome: 'snow',    hp: 15,  atk: 0,  spd: 6.0, xp: 9,  r: 0.5, color: 0xc8d8e8, shape: 'quad', passive: true, critter: true },
  frostspirit:{ name: 'Frost Spirit',  biome: 'snow',    hp: 58,  atk: 14, spd: 5.0, xp: 42, r: 1.0, color: 0xa8c8e8, shape: 'wraith', ranged: true, eye: 0xe8f4ff },
  frostphoenix:{ name: 'Frostphoenix', biome: 'snow',    hp: 120, atk: 17, spd: 6.8, xp: 95, r: 1.0, color: 0xbfe0f8, shape: 'bird', fly: true, ranged: true, crest: true, eye: 0xff6a8a },
  palewyrm:   { name: 'Pale Wyrm',     biome: 'snow',    hp: 1750, atk: 42, spd: 5.4, xp: 1200, r: 2.8, color: 0xe8ecf4, shape: 'drake', fly: true, boss: true, ranged: true, eye: 0xff2a3a, worldBoss: true },
  /* birds — fast, flying, hate the ground and your face */
  phoenix:    { name: 'Phoenix',       biome: 'volcano', hp: 150, atk: 18, spd: 6.5, xp: 110, r: 1.0, color: 0xe86a2a, shape: 'bird', fly: true, ranged: true, crest: true },
  stormrook:  { name: 'Storm Rook',    biome: 'mountain',hp: 70,  atk: 12, spd: 7.0, xp: 45, r: 0.8, color: 0x5a6a8a, shape: 'bird', fly: true },
  galebinder: { name: 'Galebinder',    biome: 'mountain',hp: 55,  atk: 13, spd: 7.2, xp: 42, r: 0.8, color: 0x7a9ac8, shape: 'bird', fly: true, ranged: true },
  craggoat:    { name: 'Craggoat',      biome: 'mountain',hp: 18,  atk: 0,  spd: 4.8, xp: 9,  r: 0.6, color: 0x9a8a7a, shape: 'quad', passive: true, critter: true },
  cliffmouse:  { name: 'Cliffmouse',    biome: 'mountain',hp: 8,   atk: 0,  spd: 5.0, xp: 5,  r: 0.3, color: 0x7a756a, shape: 'quad', passive: true, critter: true },
  cliffdarter:{ name: 'Cliffdarter',   biome: 'mountain',hp: 32,  atk: 8,  spd: 7.6, xp: 24, r: 0.6, color: 0x8a9ab8, shape: 'bird', fly: true },
  galespirit: { name: 'Gale Spirit',   biome: 'mountain',hp: 58,  atk: 14, spd: 6.2, xp: 44, r: 1.0, color: 0xa8d8f0, shape: 'wraith', fly: true, ranged: true, eye: 0xe8f8ff },
  craggryphon:{ name: 'Crag Gryphon',  biome: 'mountain',hp: 140, atk: 22, spd: 6.0, xp: 120, r: 1.6, color: 0x8a6a3a, shape: 'drake', fly: true, eye: 0xe8a83a },
  rocmother:  { name: 'Roc Mother',    biome: 'mountain',hp: 1200, atk: 32, spd: 6.8, xp: 850, r: 2.6, color: 0x6a5a48, shape: 'bird', fly: true, boss: true, eye: 0xffd27a, worldBoss: true },
  duskmaw:    { name: 'Dusk Maw',      biome: 'mountain',hp: 1900, atk: 44, spd: 5.6, xp: 1250, r: 3.0, color: 0x14141c, shape: 'drake', fly: true, boss: true, ranged: true, eye: 0x3a7ae8, worldBoss: true },
  ashcrow:    { name: 'Ash Crow',      biome: 'forest',  hp: 30,  atk: 6,  spd: 6.0, xp: 15, r: 0.6, color: 0x3a3a44, shape: 'bird', fly: true },
  /* wild animals — harmless grazers that flee. Hunting them is allowed. */
  moonrabbit: { name: 'Moonrabbit',    biome: 'meadow',  hp: 10,  atk: 0,  spd: 5.0, xp: 6,  r: 0.4, color: 0xd8d0e8, shape: 'quad', passive: true, critter: true },
  veilstag:   { name: 'Veilstag',      biome: 'forest',  hp: 20,  atk: 0,  spd: 5.5, xp: 10, r: 0.7, color: 0x8a7a5a, shape: 'quad', passive: true, critter: true },
  /* bosses — fixed guardians, never wander the wilds */
  gloammother:{ name: 'Gloam Mother',  biome: 'mountain',hp: 230, atk: 13, spd: 3.0, xp: 130, r: 1.8, color: 0x5a2a4a, shape: 'blob', boss: true },
  wardeneffigy:{ name: 'Warden Effigy',biome: 'mountain',hp: 270, atk: 15, spd: 3.4, xp: 160, r: 1.4, color: 0x8a7a4a, shape: 'tall', boss: true, ranged: true },
  choirherald:{ name: 'Choir Herald',  biome: 'shore',   hp: 430, atk: 19, spd: 4.2, xp: 320, r: 1.6, color: 0xb89ae8, shape: 'wraith', fly: true, boss: true, ranged: true },
  /* optional guardians — side dungeons, side glory */
  cindermatriarch:{ name: 'Cinder Matriarch', biome: 'volcano', hp: 300, atk: 15, spd: 4.6, xp: 220, r: 2.2, color: 0x8a1a12, shape: 'drake', boss: true, ranged: true, crest: true },
  rimetype:  { name: 'Rime Tyrant',   biome: 'mountain',hp: 280, atk: 14, spd: 4.0, xp: 200, r: 1.8, color: 0xcfe0f8, shape: 'tall', boss: true },
  thornregent:{ name: 'Thorn Regent', biome: 'forest',  hp: 260, atk: 13, spd: 3.6, xp: 190, r: 2.0, color: 0x2a5a2a, shape: 'blob', boss: true },
  /* roaming terrors — deep wilds only, never near towns */
  magmawyrm:  { name: 'Magma Wyrm',   biome: 'volcano', hp: 350, atk: 17, spd: 5.0, xp: 260, r: 2.2, color: 0x7a1408, shape: 'drake', boss: true, ranged: true, crest: true },
  frostmaw:   { name: 'Frost Maw',    biome: 'mountain',hp: 330, atk: 16, spd: 4.4, xp: 240, r: 1.8, color: 0xe8f0fc, shape: 'quad', boss: true },
  briarancient:{ name: 'Briar Ancient', biome: 'forest', hp: 300, atk: 15, spd: 3.4, xp: 220, r: 2.1, color: 0x1e4a1e, shape: 'blob', boss: true },
  drownedchoir:{ name: 'Drowned Choir', biome: 'shore',  hp: 310, atk: 16, spd: 4.6, xp: 230, r: 1.6, color: 0x5a7a8a, shape: 'wraith', fly: true, boss: true, ranged: true },
  /* OP open-world side bosses — post-story terrors, huge HP, heavy hits.
     They live far from roads; the compass never points at them. */
  stormsovereign:{ name: 'Storm Sovereign', biome: 'mountain', hp: 1400, atk: 34, spd: 6.2, xp: 900, r: 2.4, color: 0x3a4a7a, shape: 'bird', fly: true, boss: true, ranged: true, worldBoss: true },
  abysscantor:{ name: 'Abyss Cantor', biome: 'shore', hp: 1600, atk: 38, spd: 4.8, xp: 1000, r: 2.6, color: 0x2a1a4a, shape: 'wraith', fly: true, boss: true, ranged: true, worldBoss: true },
  gloomtitan: { name: 'Gloom Titan', biome: 'forest', hp: 1800, atk: 42, spd: 3.8, xp: 1100, r: 3.0, color: 0x1a2a1a, shape: 'tall', boss: true, worldBoss: true },
  cinderqueen:{ name: 'Cinder Queen', biome: 'volcano', hp: 2000, atk: 45, spd: 5.2, xp: 1300, r: 3.2, color: 0xa01008, shape: 'drake', boss: true, ranged: true, crest: true, worldBoss: true },
  embersaint:{ name: 'Ember Saint', biome: 'volcano', hp: 1700, atk: 40, spd: 4.2, xp: 1150, r: 2.6, color: 0xe8b44a, shape: 'tall', boss: true, worldBoss: true, regen: 8 },
  rimechoir:  { name: 'Rimebound Choir', biome: 'snow', hp: 1500, atk: 36, spd: 5.0, xp: 1000, r: 2.4, color: 0xcfe8ff, shape: 'wraith', fly: true, boss: true, ranged: true, worldBoss: true, regen: 6 },
  thornwretch:{ name: 'Thornwretch', biome: 'forest', hp: 1650, atk: 38, spd: 3.2, xp: 1050, r: 2.8, color: 0x4a7a1a, shape: 'blob', boss: true, worldBoss: true, regen: 10 },
  brinetyrant:{ name: 'Brine Tyrant', biome: 'shore', hp: 1550, atk: 37, spd: 4.0, xp: 1020, r: 2.6, color: 0x2a6a7a, shape: 'quad', boss: true, ranged: true, worldBoss: true },
  /* the living whetstone: ~10M HP, hits for NOTHING. Exists so steel
     and spells can be measured honestly. Waddles, never wounds. */
  trialcrab:  { name: 'Trial Crab', biome: 'meadow', hp: 10000000, atk: 0, spd: 3.0, xp: 0, r: 2.6, color: 0xc05038, shape: 'crab', boss: true, worldBoss: true },
  /* Aurelia the gold — the tame dragon. Biome 'sky' never matches ground,
     so she only ever exists at her roost, waiting for a rider. */
  aurelia:    { name: 'Aurelia', biome: 'sky', hp: 5000, atk: 0, spd: 14, xp: 0, r: 2.2, color: 0xd8b46e, shape: 'drake', fly: true, eye: 0x4ae8c8 }
};

/* Settlement layout. World spans ±6000 units; a walk across is ~30 minutes.
   spec = town specialization (drives unique buildings + shops in world.js):
   capital / guild (strong adventurers) / academy / forge / port+trade /
   trade (merchant hub) / herbs / farm / shrine / ruin / chapel */
const SITES = [
  { id: 'castle',    name: 'Auverne Castle',    kind: 'castle',  x: 0,     z: 400,   r: 210, spec: 'capital' },
  { id: 'rosegate',  name: 'Rosegate Town',     kind: 'town',    x: -260,  z: 1150,  r: 170, spec: 'guild' },
  { id: 'prismere',  name: 'Prismere Arcanum',  kind: 'academy', x: -2400, z: -1900, r: 190, spec: 'academy' },
  { id: 'emberfall', name: 'Emberfall Hold',    kind: 'forge',   x: 3100,  z: 2400,  r: 175, spec: 'forge' },
  { id: 'lullwater', name: 'Lullwater Port',    kind: 'port',    x: 2200,  z: -2600, r: 170, spec: 'port', ferry: true },
  { id: 'ashmire',   name: 'Ashmire Village',   kind: 'village', x: -3300, z: 2700,  r: 150, spec: 'herbs' },
  { id: 'greyhollow',name: 'Greyhollow',        kind: 'village', x: 1200,  z: -600,  r: 140, spec: 'farm', ferry: true },
  { id: 'tarn',      name: 'Veilmoon Tarn',     kind: 'shrine',  x: -1100, z: -3900, r: 160, spec: 'shrine', ferry: true },
  { id: 'whisper',   name: 'Whisperwood Ruin',  kind: 'ruin',    x: -1900, z: 900,   r: 130, spec: 'ruin' },
  { id: 'chapel',    name: 'Cinder Chapel',     kind: 'chapel',  x: 2400,  z: 1400,  r: 130, spec: 'temple' },
  { id: 'crossroads',name: 'Crossroads Market', kind: 'market',  x: 419,   z: 295,   r: 150, spec: 'trade' }
];

/* Ferries: scheduled ships between coastal / lakeside towns.
   Walk to the dock bell (E) to board; the ship sails itself. */
const FERRIES = [
  { id: 'ferry_sun',  name: 'Sunscale Ferry', from: 'lullwater',  to: 'greyhollow', fare: 10 },
  { id: 'ferry_moon', name: 'Moonlit Ferry',  from: 'lullwater',  to: 'emberfall',  fare: 15 },
  { id: 'ferry_tarn', name: 'Tarn Skiff',     from: 'tarn',       to: 'prismere',   fare: 8 }
];

/* Town specializations (fantasy-anime pattern: trade / guild / academy /
   forge / port / farm-herb). Drives World specialty buildings + NPC jobs. */
const TOWN_SPECS = {
  capital: { title: 'Royal Capital',   blurb: 'Knights, wards and courts. Elvia drills here.' },
  guild:   { title: 'Adventurer Town', blurb: 'Strong guild, training yard, writ board. Best companions for hire.' },
  academy: { title: 'Grand Academy',   blurb: 'Lecture halls, library, alchemy tower and dorms. Yorune and Rurika read here.' },
  forge:   { title: 'Forge Hold',      blurb: 'Master smiths, smelters. Ignia spars here. Best weapons.' },
  port:    { title: 'Trade Port',      blurb: 'Docks, warehouses, ferries. Best prices for merchants.' },
  trade:   { title: 'Merchant Hub',    blurb: 'Bazaar, stalls, caravan yard. Everything is a bargain to someone.' },
  herbs:   { title: 'Herb Village',    blurb: 'Alchemists and mourners. Tonics are cheap, grief is free.' },
  farm:    { title: 'Farm Town',       blurb: 'Granaries, mills, militia hall. Food heals more here.' },
  shrine:  { title: 'Holy Shrine',     blurb: 'Still water, seven pedestals, one sealed girl.' },
  ruin:    { title: 'Old Ruin',        blurb: 'Mural, drift-gate, things that hum.' },
  temple:  { title: 'Chapel',          blurb: 'The Choir hums and never finishes.' }
};

/* Roads that bind the realm. Drawn as dirt on the land, signposted at towns. */
const ROUTES = [
  ['castle', 'rosegate'], ['castle', 'crossroads'], ['crossroads', 'rosegate'],
  ['crossroads', 'greyhollow'], ['greyhollow', 'lullwater'], ['rosegate', 'whisper'],
  ['emberfall', 'chapel'], ['chapel', 'greyhollow'], ['crossroads', 'chapel'],
  ['prismere', 'tarn'], ['ashmire', 'whisper'], ['lullwater', 'greyhollow']
];

/* Factions. Standing is earned, never bought — see Game.rep. */
const FACTIONS = [
  { id: 'rose', name: 'Rose Ward', type: 'knights of the crown', symbol: 'a crimson rose on white',
    about: 'The crown\'s sword-arm. They take blows first and write reports later. Elvia is theirs.' },
  { id: 'wardens', name: 'Veil Wardens', type: 'gatekeepers and measurers', symbol: 'a blue arch on grey',
    about: 'They read tuning at every ward in Avelune and decide who may pass. Holt is theirs.' },
  { id: 'archive', name: 'Prismere Archive', type: 'scholars and indexers', symbol: 'an open book over snow',
    about: 'They file everything, including — impossibly — you, eleven years early. Rurika is theirs.' },
  { id: 'choir', name: 'Hollow Choir', type: 'hidden cult (no banner flown)', symbol: 'a mouth, open, with no tongue',
    about: 'They believe farewells feed something under the world, and they collect unfinished ones. The Cinder Chapel hums for them.' }
];

/* Hidden dungeons. Each entrance is invisible until its clue is read. */
const DUNGEONS = [
  {
    id: 'gloam', name: 'Gloam Cavern', x: -1156, z: 802, clue: 'clue_gloam',
    puzzle: 'candles', boss: 'gloammother',
    intro: 'Cold air comes up through the split rock. Someone has cut steps into it, a long time ago, and then cut a warning over the steps.',
    reward: { item: 'emberbell', text: 'The Ember Bell. Warm in cold places, and it rings when the Choir is near.' }
  },
  {
    id: 'spine', name: 'The Gravespine Vault', x: 2650, z: -1500, clue: 'clue_spine',
    puzzle: 'bells', boss: 'wardeneffigy',
    intro: 'A vault door with three bells and no rope. Two of them are split down the side.',
    reward: { item: 'writpass', text: 'A Warden\'s Sigil. The deep wards under the Tarn will open for it.' }
  },
  {
    id: 'tarn-depths', name: 'Veilmoon Depths', x: -1100, z: -4180, clue: 'clue_tarn',
    needs: 'writpass', puzzle: 'seals', boss: 'choirherald',
    intro: 'Below the water, a hall of seven pedestals. Six carry light. The seventh carries a girl.',
    reward: { hero: 'liora', text: 'The seal answers to breath, not force.' }
  },
  /* Optional descents — no quest sends you; glory is its own writ. */
  {
    id: 'emberdeep', name: 'Emberdeep Vault', x: 2529, z: 1829, clue: 'clue_ember',
    puzzle: 'bells', boss: 'cindermatriarch',
    intro: 'Heat breathes out of the split rock. Something vast is nesting in it, and it has heard you.',
    reward: { item: 'emberbrand', text: 'Emberbrand, quenched in caldera glass. It hums when held.' }
  },
  {
    id: 'frostcrypt', name: 'The Rimed Crypt', x: -300, z: 1800, clue: 'clue_frost',
    puzzle: 'candles', boss: 'rimetype',
    intro: 'A white door in a white col. The cold here has a posture, and it is standing.',
    reward: { item: 'rimecloak', text: 'A cloak of Tyrant-down. The wind gives up on you.' }
  },
  {
    id: 'thornhollow', name: 'Thornhollow', x: -1400, z: 1300, clue: 'clue_thorn',
    puzzle: 'bells', boss: 'thornregent',
    intro: 'The grove grew over something that objected. Roots like bars. Bells like teeth.',
    reward: { item: 'briarcharm', text: 'A briar charm. It only ever pricks the other fellow.' }
  }
];

const ITEMS = {
  writ:      { name: 'Gate Writ',      desc: 'Signed by the Crown Princess. The ward at the castle gate will let you through.' },
  tonic:     { name: 'Veil Tonic',     desc: 'Bitter. Steadies an outsider\'s breathing for a while.', use: 'heal', power: 45 },
  draught:   { name: 'Moon Draught',   desc: 'Restores focus.', use: 'focus', power: 40 },
  rosebrand: { name: 'Rosebrand',      desc: 'A knight\'s spare sword. +6 strike.', slot: 'weapon', atk: 6 },
  wardcoat:  { name: 'Ward Coat',      desc: 'Stitched with resonance thread. +5 guard.', slot: 'armor', def: 5 },
  emberbell: { name: 'Ember Bell',     desc: 'Rings warm where the Choir has been.', slot: 'charm', def: 3, gift: true },
  emberbrand:{ name: 'Emberbrand',     desc: 'A greatsword quenched in caldera glass. +9 strike. A gift no one refuses.', slot: 'weapon', atk: 9, gift: true },
  rimecloak: { name: 'Rimecloak',      desc: 'Woven from Tyrant-down. Never cold. +7 guard. Soft as a promise.', slot: 'armor', def: 7, gift: true },
  briarcharm:{ name: 'Briar Charm',    desc: 'A thorn that only pricks your enemies. +4 guard. Hers, if you give it.', slot: 'charm', def: 4, gift: true },
  skyshard:  { name: 'Skyshard',       desc: 'A chip of the Drift that never stopped falling. +4 guard.', slot: 'charm', def: 4 },
  writpass:  { name: 'Warden\'s Sigil',desc: 'Opens the deep wards beneath Veilmoon Tarn.' },
  lily:      { name: 'Frost Lily',     desc: 'A gift. Rurika keeps one pressed in every third book.', gift: true },
  ribbon:    { name: 'Violet Ribbon',  desc: 'A gift. Yorune will pretend it is a bookmark.', gift: true },
  honeyloaf: { name: 'Honey Loaf',     desc: 'A gift. Warm, if you hurry.', gift: true },
  rosepin:   { name: 'Rose Pin',       desc: 'A gift. Crimson, slightly bent.', gift: true }
};

/* ---------------------------------------------------------------
   ACTS AND QUESTS
   Act 0 happens entirely inside the castle and teaches the systems
   through story rather than tooltips.
   --------------------------------------------------------------- */
const ACTS = [
  { n: 0, title: 'The Eighth Loop', where: 'Auverne Castle',
    summary: 'You can run, but you cannot leave, and the physician says both facts are normal. Learn to breathe here.' },
  { n: 1, title: 'Tuned Enough to Leave', where: 'Rosegate',
    summary: 'The gate ward will kill an untuned outsider. Get tuned, get signed, get out.' },
  { n: 2, title: 'The Chiselled Seventh', where: 'Whisperwood',
    summary: 'A mural with a figure cut out of it, and a knight who recognises the chisel marks.' },
  { n: 3, title: 'Eleven Years of Filing', where: 'Prismere',
    summary: 'The archive has had a file on you since before you were summoned.' },
  { n: 4, title: 'Ash and Advance Grief', where: 'Ashmire',
    summary: 'Somebody has been mourning you on a schedule.' },
  { n: 5, title: 'The Cinder Court', where: 'Emberfall',
    summary: 'A festival, a duel, and three people arriving at the same dance uninvited.' },
  { n: 6, title: 'Under the Tarn', where: 'Veilmoon Depths',
    summary: 'Six pedestals lit, one sealed, and the answer to who drew the eighth loop.' }
];

const QUESTS = [
  // ---- Act 0: castle, no combat, teaches talk / rest / tuning
  { id: 'q0_wake',    act: 0, title: 'Sit up without falling over', goal: { kind: 'talk', who: 'physician' },
    text: 'The court physician is at the foot of the bed pretending not to watch you.' },
  { id: 'q0_walk',    act: 0, title: 'Walk the ward hall',          goal: { kind: 'reach', at: 'castle_hall' },
    text: 'Twenty paces to the end of the hall. It will feel like two hundred.' },
  { id: 'q0_elvia',   act: 0, title: 'Meet your minder',            goal: { kind: 'talk', who: 'elvia' },
    text: 'Someone has been assigned to you. She is not pleased about it, which she will mention.' },
  { id: 'q0_yorune',  act: 0, title: 'Be measured',                 goal: { kind: 'talk', who: 'yorune' },
    text: 'The court mage wants readings. Talking raises your tuning; she knows this and is using it.' },
  { id: 'q0_tune',    act: 0, title: 'Reach tuning 40',             goal: { kind: 'tune', value: 40 },
    text: 'Talk to people. Rest. Eat. The veil learns you through conversation, so have some.' },
  { id: 'q0_princess',act: 0, title: 'An audience',                 goal: { kind: 'talk', who: 'seraphine' },
    text: 'The Crown Princess has asked for you. Nobody says no to that sentence.' },
  // ---- Act 1: leaving
  { id: 'q1_writ',    act: 1, title: 'Get the gate writ signed',    goal: { kind: 'item', item: 'writ' },
    text: 'Seraphine will sign it once she is satisfied you will survive the far side of the wall.' },
  { id: 'q1_gate',    act: 1, title: 'Walk out of the castle',      goal: { kind: 'reach', at: 'gate' },
    text: 'The ward reads your tuning at the threshold. Below 40 it refuses; it is not being cruel.' },
  { id: 'q1_rosegate',act: 1, title: 'Reach Rosegate Town',         goal: { kind: 'site', site: 'rosegate' },
    text: 'The first town on the road north. Elvia will insist on coming.' },
  { id: 'q1_first',   act: 1, title: 'Survive your first fight',    goal: { kind: 'kill', count: 3 },
    text: 'Order your companion with G. You are not expected to win this alone, and you will not.' },
  // ---- Act 2
  { id: 'q2_mural',   act: 2, title: 'Read the Whisperwood mural',  goal: { kind: 'site', site: 'whisper' },
    text: 'Seven figures. One chiselled out while the stone was still new.' },
  { id: 'q2_clue',    act: 2, title: 'Find the Gloam clue',         goal: { kind: 'flag', flag: 'clue_gloam' },
    text: 'The mural\'s base carries a direction nobody bothered to erase.' },
  { id: 'q2_gloam',   act: 2, title: 'Open Gloam Cavern',           goal: { kind: 'dungeon', id: 'gloam' },
    text: 'Candles on the wall, a question underneath them. The answer is in the room.' },
  // ---- Act 3
  { id: 'q3_prismere',act: 3, title: 'Reach Prismere Arcanum',      goal: { kind: 'site', site: 'prismere' },
    text: 'North-west, past the snowline. Rurika is expecting you and has been for eleven years.' },
  { id: 'q3_file',    act: 3, title: 'Read your own file',          goal: { kind: 'talk', who: 'rurika' },
    text: 'A requisition for an outsider, dated eleven years ago, signature burned out.' },
  // ---- Act 4
  { id: 'q4_ashmire', act: 4, title: 'Reach Ashmire',               goal: { kind: 'site', site: 'ashmire' },
    text: 'South-west marsh. The beasts there are corrupted, not demonic — the difference matters to the people living in it.' },
  { id: 'q4_morv',    act: 4, title: 'Meet the mourner',            goal: { kind: 'talk', who: 'morvanna' },
    text: 'She is standing at a grave with your name on it and no body under it.' },
  // ---- Act 5
  { id: 'q5_ember',   act: 5, title: 'Reach Emberfall Hold',        goal: { kind: 'site', site: 'emberfall' },
    text: 'East, past the caldera. Bring water and a sense of humour.' },
  { id: 'q5_duel',    act: 5, title: 'Accept Ignia\'s challenge',   goal: { kind: 'talk', who: 'ignia' },
    text: 'She has been waiting at the ring since the day she heard about you.' },
  { id: 'q5_spine',   act: 5, title: 'Open the Gravespine Vault',   goal: { kind: 'dungeon', id: 'spine' },
    text: 'Three bells, two cracked. Ring what still sings.' },
  // ---- Act 6
  { id: 'q6_tarn',    act: 6, title: 'Reach Veilmoon Tarn',         goal: { kind: 'site', site: 'tarn' },
    text: 'The lake has not moved in eleven years. Neither has what is under it.' },
  { id: 'q6_depths',  act: 6, title: 'Break the seventh seal',      goal: { kind: 'dungeon', id: 'tarn-depths' },
    text: 'Six pedestals lit. The seventh is a person. Force will not open it.' }
];

/* Ambient NPC chatter — every line is a rumour that is actually true. */
const NPC_LINES = {
  physician: ['Breathe out longer than you breathe in. The veil settles on the out-breath.',
              'Four outsiders before you. Two lived. I am not going to tell you the other statistic.'],
  guard:     ['Ward reads tuning at the arch. Under forty and it closes. It has closed on nobles.',
              'I have stood this gate nine years. It opened for you first. I noticed.'],
  cook:      ['Eat. Tuning likes a full person better than a clever one.',
              'The princess asked what you ate. Twice. I am not paid to interpret that.'],
  scribe:    ['Eight loops. I copied the order myself and it had seven.',
              'The eighth was added in a different ink. Bluer. Steadier hand than mine.'],
  child:     ['Did you really fall out of the sky? Do it again but slower.',
              'The lady in the hood stands at the north road every autumn. Every single one.'],
  merchant:  ['Everything is a bargain to someone with no idea what things cost.',
              'Tonic sells out whenever an outsider is in town. You are ruining my margins, personally.'],
  fisher:    ['Tarn has had no current for eleven years. Water does not just stop.',
              'Something down there is holding its breath. That is the only thing that makes water go still.'],
  smith:     ['Bring ore, get opinion. Bring coin, get steel.',
              'Vance girl has been sharpening for a month. She is waiting for someone specific.'],
  archivist: ['Third shelf bites. Legally.', 'We index arrivals. We have never indexed one in advance before.'],
  mourner:   ['We keep the graves of people who never died here. It is a local custom now.',
               'She brings roses every year on the same date. Nobody knows whose date it is.'],
  warden:    ['Second arch, hold your breath out. The ward reads the out-breath, not the person.',
               'Forty to pass, sixty to patrol, eighty and they offer you my job. Keep walking.'],
  choir:     ['Hush now. The hum keeps the stones warm. You feel it too, outsider. Everyone does.',
               'We do not mourn. Mourning finishes things, and finished things get eaten. We only… continue.'],
  trader:    ['Roads are my home; towns are where I bleed coin. Buy something or walk with me — both help.',
               'I have walked every route on the signposts. Ask me about work if your blade is bored.'],
  driver:    ['Horses know the road better than I do. I just hold the reins and look official.',
               'Four to a wagon, friend. The horses counted. They are strict about it.'],
  keeper:    ['Wings over the ridge mean Aurelia is home. When she is, the sky is safe to borrow.',
               'Brush her neck before you climb. Dragons remember hands.'],
  maid:      ['The princess takes honey, the knight takes everything, and the mage has never once noticed the tea.',
               'I have worked this castle six years. The walls tell me things. The walls are gossips.'],
  barmaid:   ['Welcome in! Boots off by the hearth if they are muddy. Yours are muddy. I can tell.',
               'First cup steadies the hands, second loosens the tongue. I pour both the same way.']
};

/* Natural NPC talk: every job answers work and rumors with lore in them.
   Rumors are all true — this world does not lie to the player. */
const NPC_LORE = {
  physician: { topic: 'the veil-sickness',
    work: 'Veil-sickness is not a disease, it is a disagreement. Your body argues with the air, and the air always wins at first. Breathe out longer than in — the veil settles on the out-breath, the way dust settles when a room goes quiet.',
    rumor: 'Four outsiders came before you, through older, smaller loops. Two lived. Both of them talked constantly, to everyone, about everything. So talk. It is medicine here, whatever the court calls it.' },
  guard: { topic: 'the gate ward',
    work: 'The ward is not a wall, it is a reading. It tastes your tuning the way you taste soup — and under forty it sends the bowl back. It has closed on dukes. It does not care about dukes.',
    rumor: 'The eighth loop was added in bluer ink, the scribe says, in a steadier hand than his. Someone in this castle wanted you specifically. Sleep well.' },
  warden: { topic: 'measuring the veil',
    work: 'Wardens do not guard doors, we guard thresholds. There is a difference, and the difference has killed people. Stand still, breathe out, let the arch decide what you are.',
    rumor: 'Down in the Tarn something has held its breath for eleven years. Every warden Wall-chart shows the same flat line. Water does not go flat by itself.' },
  cook: { topic: 'feeding outsiders',
    work: 'Outsiders eat double and sleep triple and I am told this is science. Tuning likes a full person better than a clever one — food first, philosophy later, that is the whole of my doctrine.',
    rumor: 'The princess asked what you ate. Twice. Then she asked Cook Bess personally, which has never happened, and Bess has told everyone, which happens constantly.' },
  scribe: { topic: 'the eighth loop',
    work: 'I copy orders. The summoning order had seven loops when the King signed it. When it came back from the circle chamber it had eight. Ink does not walk by itself, friend. Ink does not walk.',
    rumor: 'The eighth was drawn in blue ink. Yorune in the Violet Hall has been burning blue candles for a month trying to match it. She has not matched it.' },
  child: { topic: 'court gossip',
    work: 'My work is knowing everything and being believed about nothing. It is perfect. Nobody suspects the small.',
    rumor: 'The hooded lady stands at the north road every autumn with roses. Every single autumn. Pip knows. Pip sees everything.' },
  merchant: { topic: 'prices and people',
    work: 'Tonic,charms, dry socks — an outsider buys all three within a week, every time, without exception. You are my favourite kind of weather.',
    rumor: 'The Hollow Choir pays in old coin for unfinished letters. Farewells, apologies, confessions never sent. Ask me no more about it. Ask the chapel, if you dare.' },
  fisher: { topic: 'the still Tarn',
    work: 'Fish read water better than wardens read people. The Tarn went flat eleven years ago and the fish left that same week. I have fished an empty lake for eleven years. Stubbornness is also a kind of faith.',
    rumor: 'On still nights you can hear humming from under the water. Three notes, over and over. My grandmother hummed those notes. She drowned in the Tarn.' },
  smith: { topic: 'steel and visitors',
    work: 'Outsider steel is soft in the wrong places — your world must forge cold. Bring me local ore and I will put an edge on anything, including, on request, your manners.',
    rumor: 'The Vance girl has been sharpening one greatsword for a month without using it. She is waiting for someone specific to be worth it. That is you. Do stretch first.' },
  archivist: { topic: 'the files',
    work: 'We index arrivals, departures, storms, and once — once — an arrival eleven years before it arrived. The signature was burned out. The burn is old. The want is older.',
    rumor: 'The third shelf bites because it is guarding the burned page. Feed it a ribbon and it lets scholars pass. Do not tell the novices. Actually, do. It is funny.' },
  mourner: { topic: 'the empty graves',
    work: 'We keep graves for people who never died here. It started as hope and hardened into custom. I tend one with your smell on it. Do not ask how I know your smell.',
    rumor: 'Morvanna walks the graves every year on the same date, rain or Choir. Nobody knows whose date it is. She knows. Ask her when she trusts you with grief.' },
  choir: { topic: 'the hum',
    work: 'The hum is not singing, it is holding. A held note keeps the dark fed and sleepy. Finish a farewell near us and something down below will hear the shape of it close. So we hum, and hum, and never stop.',
    rumor: 'Eleven years ago our hum changed key, all at once, in every chapel. Something sealed under the Tarn started listening back. If you go down there — say “later”, never farewell.' },
  trader: { topic: 'the road trade',
    work: 'I walk goods between towns because the roads pay better than walls do. Spices east, wool west, gossip everywhere — gossip is the real currency, friend, and I am rich.',
    rumor: 'Bandits love the Greyhollow bends and the Whisperwood eaves. Walk with a trader sometime and keep your blade loose. We pay in gold and gratitude, in that order.' },
  driver: { topic: 'the wagons',
    work: 'Four to a wagon, driver makes five, horses do not count but think they should. Say the word and we roll — the Crossroads yard keeps the teams ready.',
    rumor: 'Escorted wagons never get touched. Lonely ones sometimes do not arrive at all. If you ride, ride with guards. If you are the guards, even better.' },
  keeper: { topic: 'the tame dragon',
    work: 'I keep the roost and the dragon keeps me. Aurelia carries riders she trusts — grain, patience, and no sudden spears. Ask, and the sky is yours.',
    rumor: 'The black one east hunts at dusk. The pale one sings over the snowfields. Ours hums when she likes you. Listen for it before you climb.' },
  maid: { topic: 'below-stairs',
    work: 'Upstairs they decide things. Downstairs we know things. I make beds, carry trays, and hear every word spoken over soup.',
    rumor: 'The eighth loop? The laundry says a girl\'s ribbon was found inside the circle chalk. Blue ribbon. Nobody at court wears blue ribbon. Nobody admits it.' },
  barmaid: { topic: 'the trade in talk',
    work: 'Ale, stew, and a chair by the fire — that is the whole of my craft, and I am its master. You would not believe what people confess over a second cup. I remember all of it. Professionally.',
    rumor: 'A hooded one pays gold for unfinished letters down Cinder way. And sweetheart — that knight girl asks after you in every town. Every. Town.' }
};

/* The archive of the world. Entries unlock through play; locked ones tease. */
const CODEX = [
  { id: 'veil', title: 'The Veil', text: 'Avelune\'s air carries a fine resonance that living things here are born tuned to. Outsiders arrive arguing with it — short of breath, weak, slow — and acclimatise through talk, food and rest, because language is how the veil learns the shape of a person.' },
  { id: 'eighth', title: 'The Eighth Loop', text: 'The summoning circle was drawn for seven loops and given eight, in bluer ink, by a steadier hand. Seven loops call a hero. The eighth called one specific person: you.' },
  { id: 'choir', title: 'The Hollow Choir', text: 'A hidden cult that believes farewells feed something under the world. They hum without stopping, collect unfinished letters, and pay old coin for goodbyes never said. Their chapels are warm, and that should worry you.' },
  { id: 'sealed', title: 'The Sealed Watcher', text: 'Eleven years ago a girl of nineteen drew the eighth loop wanting one person to arrive. The court sealed her under Veilmoon Tarn for it — six pedestals of light, and a seventh holding her, eyes open, blue blooms unfaded.' },
  { id: 'tarn', title: 'Veilmoon Tarn', text: 'A lake with no current for eleven years. Fishermen say something down there is holding its breath, and the water went still to match it. On quiet nights it hums three notes.' },
  { id: 'gloam', title: 'Gloam Cavern', text: 'A split-rock cavern past Whisperwood. Seven candles, one snuffed on purpose, and a question cut underneath: count only what still burns.' },
  { id: 'ember', title: 'Emberfall and the Caldera', text: 'A forge-hold built on the lip of a bitten-out volcano. The Vance duellists sharpen there, the Cinder Chapel hums nearby, and the rock itself runs warm as blood.' },
  { id: 'prismere', title: 'Prismere Arcanum', text: 'An academy past the snowline that files everything — storms, arrivals, and once, impossibly, an outsider eleven years before the summoning. The signature was burned out of the page.' },
  { id: 'rose', title: 'The Rose Ward', text: 'The crown\'s sword-arm. Their oath says take the blow first; their crest, a crimson rose, means they decided anyway. They do not do paperwork about feelings.' },
  { id: 'wardens', title: 'The Veil Wardens', text: 'Gatekeepers and measurers. They read tuning at every ward in the realm — forty to pass, sixty to patrol — and their charts have shown one flat line for eleven years: the Tarn, holding its breath.' },
  { id: 'drift', title: 'The Drift', text: 'Islands that broke the world\'s edge and never fell, hung over Whisperwood on chains of old weather. The Archive claims they are dimensional ballast. The Choir hums to them. Nobody has landed on one and come back talkative.' },
  { id: 'waystones', title: 'The Waystones', text: 'Older than the wards and kinder: standing stones that remember every town they have touched. Touch one with somewhere in your heart and be gentle with the landing.' },
  { id: 'auverne', title: 'Auverne Keep', text: 'Raised in the second reign, burned in the fourth, rebuilt by unsigned hands. Eight loops are cut above the great door. Count them. One was added later.' },
  { id: 'avelune', title: 'Avelune', text: 'The old tongue names it plainly: aevum for the turning age, lune for the two moons that watch it turn. The land of the looped age, under two moons — a world built, like its story, to come around again.' }
];
