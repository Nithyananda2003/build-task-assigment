// Answer keys stay on the server. Each row is word, meaning, example, choices, answer.
const WORDS = [
  ['Reliable', 'Someone or something you can depend on.', 'A reliable bus arrives on time.', ['Easy to depend on', 'Very expensive', 'Hard to find'], 0],
  ['Brief', 'Short and clear.', 'Please send a brief message.', ['A long story', 'Short and clear', 'Very loud'], 1],
  ['Improve', 'To make something better.', 'Daily practice can improve your English.', ['Forget something', 'Make something worse', 'Make something better'], 2],
  ['Patient', 'Able to wait calmly.', 'Be patient while the page loads.', ['Wait calmly', 'Move quickly', 'Speak loudly'], 0],
  ['Notice', 'To see or become aware of something.', 'Did you notice the new sign?', ['Hide something', 'Become aware of something', 'Borrow something'], 1],
  ['Choose', 'To pick one thing from a few options.', 'Choose a seat near the window.', ['Lose a thing', 'Give a thing away', 'Pick one option'], 2],
  ['Prepare', 'To get ready.', 'I prepare my bag before work.', ['Get ready', 'Go to sleep', 'Start again'], 0],
  ['Honest', 'Truthful and fair.', 'An honest person tells the truth.', ['Always busy', 'Truthful and fair', 'Very quiet'], 1],
  ['Enough', 'As much as you need.', 'We have enough water for the trip.', ['Too little', 'Too much', 'As much as needed'], 2],
  ['Discover', 'To find or learn something new.', 'I discover a new word every day.', ['Find something new', 'Forget something', 'Break something'], 0],
  ['Simple', 'Easy to understand or do.', 'The app has simple instructions.', ['Difficult to use', 'Easy to understand', 'Very old'], 1],
  ['Share', 'To let someone use or have part of something.', 'We share our lunch.', ['Keep everything', 'Throw it away', 'Let others have a part'], 2],
  ['Curious', 'Wanting to learn or know more.', 'A curious learner asks questions.', ['Wanting to learn', 'Feeling sleepy', 'Feeling angry'], 0],
  ['Arrive', 'To reach a place.', 'We arrive at the station at nine.', ['Leave a place', 'Reach a place', 'Forget a place'], 1],
  ['Useful', 'Able to help you do something.', 'A map is useful in a new city.', ['Hard to carry', 'Very colourful', 'Able to help'], 2],
  ['Polite', 'Showing respect and good manners.', 'It is polite to say thank you.', ['Showing good manners', 'Talking very fast', 'Being afraid'], 0],
  ['Effort', 'The work you put into doing something.', 'Learning a language takes effort.', ['A long holiday', 'Work you put in', 'A lucky guess'], 1],
  ['Remember', 'To keep something in your mind.', 'Remember to bring your keys.', ['Throw it away', 'Change your plan', 'Keep it in your mind'], 2],
  ['Confident', 'Feeling sure about your ability.', 'Practice helps me feel confident.', ['Sure of your ability', 'Always right', 'Very wealthy'], 0],
  ['Support', 'To help someone.', 'Friends support each other.', ['Avoid someone', 'Help someone', 'Copy someone'], 1],
  ['Progress', 'Movement towards getting better.', 'Small steps help you make progress.', ['Staying in one place', 'Going backwards', 'Getting closer to a goal'], 2],
  ['Regular', 'Happening again at similar times.', 'Regular practice helps us learn.', ['Happening repeatedly', 'Happening once', 'Happening by chance'], 0],
  ['Explain', 'To help someone understand something.', 'Please explain the new rule.', ['Keep it secret', 'Make something clear', 'Write it backwards'], 1],
  ['Careful', 'Giving attention to avoid mistakes.', 'Be careful when you cross the road.', ['Very quick', 'Very lucky', 'Paying attention'], 2],
  ['Complete', 'To finish something.', 'I complete my task before lunch.', ['Finish something', 'Start something', 'Lose something'], 0],
  ['Calm', 'Peaceful and not worried.', 'Take a breath and stay calm.', ['Very noisy', 'Peaceful and not worried', 'Very hungry'], 1],
  ['Connect', 'To join or link things.', 'This road connects two towns.', ['Separate things', 'Hide things', 'Join things together'], 2],
  ['Common', 'Happening often or found in many places.', 'Rain is common here in June.', ['Found often', 'Very rare', 'Never seen'], 0],
  ['Reduce', 'To make something smaller or less.', 'Walking can reduce how much fuel we use.', ['Make it bigger', 'Make it less', 'Keep it the same'], 1],
  ['Flexible', 'Able to change when needed.', 'A flexible plan can change.', ['Impossible to change', 'Always expensive', 'Able to change'], 2],
  ['Purpose', 'The reason for doing something.', 'The purpose of this sign is to help visitors.', ['The reason for something', 'The cost of something', 'The size of something'], 0],
  ['Encourage', 'To give someone hope or confidence.', 'A teacher can encourage a learner.', ['Make someone afraid', 'Give someone confidence', 'Stop someone learning'], 1],
  ['Practice', 'Doing something often to get better.', 'I practice English each morning.', ['Avoiding a task', 'Waiting for luck', 'Repeating to get better'], 2]
];

export const DAY_MS = 86400000;
export function dayAt(time = Date.now()) { return new Date(time + 19800000).toISOString().slice(0, 10); }
export function previousDay(day) { return new Date(Date.parse(day + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10); }
export function nextReset(time = Date.now()) { return new Date(Date.parse(dayAt(time) + 'T00:00:00+05:30') + DAY_MS).toISOString(); }
export function quizFor(day) {
  const n = Math.floor(Date.parse(day + 'T00:00:00Z') / DAY_MS);
  return Array.from({length: 3}, (_, i) => {
    const [word, meaning, example, choices, original] = WORDS[((n % WORDS.length) + WORDS.length + i * 7) % WORDS.length];
    const offset = ((n + i) % 3 + 3) % 3;
    return {word, meaning, example, choices: choices.map((_, j) => choices[(j + offset) % 3]), answer: (original - offset + 3) % 3};
  });
}
export function publicQuiz(day) { return quizFor(day).map(({word, choices}) => ({word, choices})); }
export function grade(day, answers) {
  if (!Array.isArray(answers) || answers.length !== 3 || !answers.every(n => Number.isInteger(n) && n >= 0 && n <= 2)) throw new Error('Choose one answer for each of the three words.');
  const questions = quizFor(day);
  const correct = questions.filter((q, i) => q.answer === answers[i]).length;
  return {correct, points: 10 + correct * 5, answers, review: questions};
}
export function progress(rows, today) {
  const days = new Set(rows.map(r => r.day));
  let cursor = days.has(today) ? today : previousDay(today), streak = 0;
  while (days.has(cursor)) { streak++; cursor = previousDay(cursor); }
  const points = rows.reduce((sum, r) => sum + r.points, 0);
  const level = Math.floor(points / 100) + 1;
  const badges = [
    {id: 'first', name: 'First spark', detail: 'Finish your first challenge', earned: rows.length >= 1, icon: 'spark'},
    {id: 'perfect', name: 'Word wise', detail: 'Get all 3 answers right', earned: rows.some(r => r.correct === 3), icon: 'target'},
    {id: 'three', name: 'On a roll', detail: 'Build a 3-day streak', earned: hasStreak(days, 3), icon: 'flame'},
    {id: 'seven', name: 'A little every day', detail: 'Build a 7-day streak', earned: hasStreak(days, 7), icon: 'sun'}
  ];
  return {points, level, toNextLevel: 100 - points % 100, levelProgress: points % 100, streak, completedDays: rows.length, badges};
}
function hasStreak(days, count) {
  for (const day of days) { let cursor = day, n = 0; while (days.has(cursor) && n < count) { n++; cursor = previousDay(cursor); } if (n >= count) return true; }
  return false;
}
