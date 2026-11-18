// dialogue.js
// Komodo Street. Pak Bimo talks like a warm older mentor from the coast:
// short lines, a little teasing, a little wisdom, always in English with
// Indonesian flavor. Every line stays under 140 characters so it fits the
// dialogue box. The HUD reads state.dialogue; the player presses E to
// dismiss a line.

export const DIALOGUE = {
  greetings: [
    'Evening, kid. The city is waking up, and so is the work.',
    'You came at the right time. Sunset is the best hour in Vellora.',
    'Park the car, drink some teh manis, then we talk business.',
  ],
  briefings: {
    'first-shift': [
      'First shift, kid. Take this package to Pasar Ikan, and do not drop it.',
      'The fish sellers pay on time. Be polite, and they will remember you.',
    ],
    'hot-package': [
      'This one is hot, and the buyer will not wait. Drive like the wind.',
      'Pelabuhan, fast. If the clock beats you, the money walks away.',
    ],
    'night-run': [
      'Three checkpoints across the city. No shortcuts, no excuses.',
      'Night driving teaches you the streets better than any map.',
    ],
    'pelabuhan-gelap': [
      'A crate waits at the dark end of the harbor. Ask no questions.',
      'No headlights near the docks, and if the police come, you never saw me.',
    ],
    'balap-senja': [
      'Sunset race, Tanjung Senja. Three rivals think they own the loop.',
      'Win it, and the whole street will know your name by morning.',
    ],
    'paket-terakhir': [
      'Last package of the day, and the most important one.',
      'Tanjung Senja is waiting. Finish strong, kid.',
    ],
    'jalan-pulang': [
      'The sun is down and the work is done. Time to come home.',
      'Dinner is getting cold, and your bed is warmer than this street.',
    ],
  },
  after: [
    'Good. The market sellers already ask for you by name.',
    'Fast, clean, no trouble. That is how you build a name.',
    'Three checkpoints, one night. You drive like you were born here.',
    'Quiet work, quiet pay. The harbor will call again.',
    'The street is yours tonight, champion. Enjoy it.',
    'Last package delivered. You carried this whole day, kid.',
    'Welcome home. Tomorrow the city waits again, but tonight you rest.',
  ],
  tips: [
    'The police lose you if you break line of sight for a while.',
    'Coins hide near shops and along the beach. Keep your eyes open.',
    'A becak ride pays quick money when the missions are quiet.',
    'The workshop at Tanjung Senja can make your car much faster.',
    'Rain makes the roads slick. Brake early, turn gentle.',
  ],
  jokes: [
    'I once raced a becak down Pantai Biru. The becak won. Do not tell anyone.',
    'The sea is the only thing in this city that never asks for money.',
    'My first car had three wheels and a dream. You have four wheels, use them.',
  ],
};

export function showDialogue(state, speaker, text) {
  state.dialogue = { speaker, text, visible: true };
}

export function dismissDialogue(state) {
  if (state.dialogue) state.dialogue.visible = false;
}
