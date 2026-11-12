const icons = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  spark: '<path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2Z"/>',
  chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8C5 9 4 3 7.5 3 10 3 12 8 12 8Zm0 0c7 1 8-5 4.5-5C14 3 12 8 12 8Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5c0-3 5-3 5 0 0 2-2.5 2-2.5 4M12 16h.01"/>',
  flame: '<path d="M13 2c2 5-1 5 1 9 2-1 3-3 3-3s4 4 3 8a8 8 0 0 1-16 0c-1-5 3-7 3-7s-1 4 2 5C7 8 12 8 13 2Z"/><path d="M12 14c-3 3-3 6 0 6s3-3 0-6Z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="m12 6 1.7 4.3L18 12l-4.3 1.7L12 18l-1.7-4.3L6 12l4.3-1.7L12 6Z"/>',
  level: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m8 12 4-4 4 4M12 8v9"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  book: '<path d="M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2V4Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-12 5h.01M12 15h.01M16 15h.01"/>',
  heart: '<path d="M20.5 4.5C17 1 12 5 12 5S7 1 3.5 4.5C-1 9 5 15 12 21c7-6 13-12 8.5-16.5Z"/>',
  wifi: '<path d="m2 8 20 14M4 5a17 17 0 0 1 18 3M2 8l1.5-1M5 12a11 11 0 0 1 4-2m5 0a11 11 0 0 1 5 2M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"/>'
};
function icon(name, cls = '') { return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.spark}</svg>`; }
const main = document.querySelector('#main');
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
let data = null, quiz = null, screen = 'today', busy = false, serverOffset = 0, loading = false;
const routes = ['today','progress','rewards','about'];
const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = (date, options) => new Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata',...options}).format(new Date(date + 'T12:00:00+05:30'));
const dayLabel = day => fmtDate(day, {day:'numeric',month:'short'});
function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.hidden = true, 4500); }
async function api(path, options = {}) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(path, {credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal});
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Please try again.'); error.code = result.code; throw error; }
    return result;
  } catch (error) { if (error.name === 'AbortError') throw new Error('The connection is taking a while. Please try again.'); if (error instanceof TypeError) throw new Error('You appear to be offline. Connect to the internet, then try again.'); throw error; }
  finally { clearTimeout(timer); }
}
function setData(result) { data = result; serverOffset = Date.parse(data.serverNow) - Date.now(); }
function expired() { return data && Date.now() + serverOffset >= Date.parse(data.resetsAt); }
function remaining() {
  if (!data) return '';
  const minutes = Math.max(0, Math.ceil((Date.parse(data.resetsAt) - Date.now() - serverOffset)/60000));
  return `${Math.floor(minutes/60)}h ${minutes%60}m`;
}
function header(title, description, eyebrow = 'A FRESH LITTLE START') {
  return `<div class="heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${description}</p></div><div class="date-pill">${icon('calendar')}${fmtDate(data.today,{weekday:'short',month:'short',day:'numeric'})}</div></div>`;
}
function stats() {
  return `<section class="stats" aria-label="Your learning progress">
  <div class="stat"><div class="stat-icon">${icon('flame')}</div><div><div class="stat-number">${data.streak}<small>${data.streak === 1 ? 'day' : 'days'}</small></div><div class="stat-label">Current streak</div></div><span class="stat-tail">${data.streak ? 'Keep it going' : 'Ready, set, grow'}</span></div>
  <div class="stat"><div class="stat-icon gold">${icon('coin')}</div><div><div class="stat-number">${data.points}<small>pts</small></div><div class="stat-label">Total points</div></div><span class="stat-tail">Your little wins</span></div>
  <div class="stat"><div class="stat-icon green">${icon('level')}</div><div><div class="stat-number">${data.level}<small>level</small></div><div class="stat-label">${data.level === 1 ? 'Curious beginner' : data.level < 5 ? 'Growing learner' : 'Everyday explorer'}</div></div><span class="stat-tail">One step at a time</span></div></section>`;
}
function badges(full = false) {
  return `<div class="badges ${full ? 'full-badges' : ''}">${data.badges.map(b => `<div class="badge-card ${b.earned ? 'earned' : ''}" title="${safe(b.detail)}"><span class="badge-icon">${icon(b.icon)}</span><div class="badge-name">${b.name}</div><span class="badge-status">${full ? safe(b.detail) : b.earned ? 'Unlocked' : 'To discover'}</span>${!b.earned ? `<span class="lock-tiny">${icon('lock')}<span class="sr-only">Locked</span></span>` : '<span class="sr-only">Earned</span>'}</div>`).join('')}</div>`;
}
function week(wide = false) {
  const today = new Date(data.today + 'T12:00:00Z');
  const monday = new Date(today); monday.setUTCDate(today.getUTCDate() - (today.getUTCDay() + 6) % 7);
  const days = new Set(data.history.map(r => r.day));
  const letters = ['M','T','W','T','F','S','S'];
  const weekDone = Array.from({length: 7},(_,i) => {const d = new Date(monday); d.setUTCDate(d.getUTCDate()+i); return {day:d.toISOString().slice(0,10),label:letters[i]};});
  return `<section class="panel ${wide ? 'week-wide' : ''}"><div class="panel-title"><h2>Your week, in little wins</h2>${icon('calendar')}</div><p class="panel-subtitle">A little practice. A lasting habit.</p><div class="week">${weekDone.map(({day,label})=>`<div class="week-day" aria-label="${fmtDate(day,{weekday:'long',day:'numeric',month:'long'})}: ${days.has(day) ? 'completed' : day===data.today ? 'today' : 'not completed'}">${label}<span class="day-circle ${day === data.today ? 'today' : ''} ${days.has(day) ? 'done' : ''}">${days.has(day) ? icon('check') : new Date(day+'T00:00:00Z').getUTCDate()}</span></div>`).join('')}</div><div class="week-note">${icon(data.completion ? 'check' : 'flame')}${data.completion ? 'Today is a little win. See you tomorrow!' : data.streak ? 'Your next little win is waiting.' : 'Your first streak starts with today.'}</div><hr class="divider"><div class="level-row"><strong>Level ${data.level}</strong><span>${data.levelProgress} / 100 pts</span></div><progress class="progress-track" value="${data.levelProgress}" max="100" aria-label="Progress to level ${data.level+1}"></progress><p class="level-caption">${data.toNextLevel} more points to Level ${data.level+1}. You’ve got this.</p></section>`;
}
function art() {
  return `<div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="flower"><svg viewBox="0 0 140 140"><g fill="#c8b2e8"><ellipse cx="70" cy="70" rx="25" ry="64"/><ellipse cx="70" cy="70" rx="25" ry="64" transform="rotate(45 70 70)"/><ellipse cx="70" cy="70" rx="25" ry="64" transform="rotate(90 70 70)"/><ellipse cx="70" cy="70" rx="25" ry="64" transform="rotate(135 70 70)"/></g><circle cx="70" cy="70" r="32" fill="#f9e7a9"/><path d="M60 67v3m20-3v3" stroke="#92704e" stroke-width="4" stroke-linecap="round"/><path d="M62 79q8 7 16 0" fill="none" stroke="#92704e" stroke-width="2.5" stroke-linecap="round"/></svg></div><span class="word-bubble first">hello, brighter you!</span><span class="word-bubble second">a little better. ✧</span><span class="art-star">✧</span><span class="art-star small">✦</span></div>`;
}
function todayView() {
  const earned = data.badges.filter(b => b.earned).length;
  return header('Your daily dose of better.', 'A few minutes for you. A little progress to be proud of.', fmtDate(data.today,{weekday:'long',month:'long',day:'numeric'}).toUpperCase()) + stats() + `<div class="content-grid"><div><section class="hero"><div class="hero-top"><span class="challenge-label">${icon(data.completion ? 'check' : 'spark')}${data.completion ? 'TODAY, WELL DONE' : 'TODAY’S CHALLENGE'}</span><span class="edition">Daily English</span></div>${art()}<div class="hero-copy"><h2>${data.completion ? 'You showed up.<br>That’s a win.' : 'Small words.<br>Big possibilities.'}</h2><p>${data.completion ? 'Three words learned. One step forward.<br>Your next spark is waiting tomorrow.' : 'Learn 3 useful English words.<br>A little practice goes a long way.'}</p></div><div class="challenge-meta"><span>${icon('clock')}2 minutes</span><span>${icon('book')}3 words</span><span>${icon('coin')}${data.completion ? `+${data.completion.points} points earned` : 'Up to 25 points'}</span></div><div class="hero-action"><button class="button primary" data-action="${data.completion ? 'review' : 'start'}">${data.completion ? 'See your little win' : 'Let’s do this'} ${icon('arrow')}</button></div><div class="hero-bottom">${icon(data.completion ? 'calendar' : 'heart')}<span>${data.completion ? 'New challenge in <span data-countdown>'+remaining()+'</span> · Midnight India time' : 'No timer. No pressure. Just a little progress.'}</span></div></section><div class="section-heading"><h2>Small wins. Well earned.</h2><a href="#progress" class="text-button">${earned} of 4 unlocked ${icon('arrow')}</a></div>${badges()}</div><aside class="side-stack">${week()}<section class="tip-card"><div class="tip-eyebrow">${icon('spark')}A FRIENDLY REMINDER</div><h3>One word at a time.<br>One day at a time.</h3><p>You don’t have to be perfect.<br>You just have to begin.</p><span class="tip-bottom">${icon('heart')}We’re cheering for you.</span></section></aside></div>`;
}
function progressView() {
  return header('Look how far you’re going.', 'Every day you show up counts. These little wins are yours.', 'YOUR JOURNEY') + stats() + `<div class="progress-layout">${week(true)}<section class="panel"><div class="panel-title"><h2>A habit worth keeping</h2>${icon('flame')}</div><div class="result-points">${data.completedDays}<span> ${data.completedDays === 1 ? 'day completed' : 'days completed'}</span></div><p class="panel-subtitle">${data.streak ? `You’re on a ${data.streak}-day streak. A fresh challenge is ready every day.` : 'Your next chapter starts with one little challenge.'}</p><hr class="divider"><p class="panel-subtitle">Finish once a day to build your streak. Missing a day resets the streak, but your points and badges stay yours.</p><a class="text-button" href="#today">Back to today ${icon('arrow')}</a></section></div><div class="section-heading"><h2>Your badge collection</h2><span class="badge-count">${data.badges.filter(b=>b.earned).length} of 4 unlocked</span></div>${badges(true)}<div class="note-box">${icon('calendar')} A new day starts at midnight India time (IST). Today’s challenge resets in <span data-countdown>${remaining()}</span>. Your streak stays active until you miss a full day.</div>`;
}
function rewardsView() {
  return header('Your effort adds up.', 'A clear record of every point you’ve earned.', 'LITTLE WINS, ALL YOURS') + `<section class="reward-banner"><div><div class="balance-caption">YOUR TOTAL REWARDS</div><div class="balance-value">${data.points}<span> points</span></div><p>Earned through ${data.completedDays} completed daily ${data.completedDays === 1 ? 'challenge' : 'challenges'}.</p></div><span class="demo-pill">Demo points · No cash value</span></section><section class="panel large-panel"><div class="ledger-head"><h2>Your reward history</h2><span>Saved on the server ${icon('lock')}</span></div>${data.history.length ? data.history.map(r=>`<div class="ledger-row"><div class="ledger-icon">${icon('check')}</div><div><h3>Daily English challenge</h3><p>${dayLabel(r.day)} · ${r.correct} of 3 correct · Completion + answers</p></div><div class="ledger-points">+${r.points}<small>confirmed</small></div></div>`).join('') : `<div class="empty-state">${icon('gift')}<h3>Your first reward is waiting.</h3><p>Finish today’s challenge to earn your first 10–25 points. Every point will appear here.</p><a href="#today" class="button primary">Find your daily spark ${icon('arrow')}</a></div>`}</section><div class="note-box"><strong>Simple rewards. Clear rules.</strong><br>10 points for finishing + 5 for each correct answer = up to 25 points a day. Points are added once, after the server checks your answers. This is a learning demo: points cannot be bought, spent, withdrawn, or exchanged for money.</div>`;
}
function aboutView() {
  return header('A small habit. A brighter day.', 'Two minutes for yourself can be the start of something good.', 'HELLO, DAILY SPARK') + `<div class="how-grid"><section class="panel how-step"><span class="step-number">01</span><div><h2>Find your spark.</h2><p>Open the app each day for three useful English words. Choose the meaning that feels right. There is no timer.</p></div></section><section class="panel how-step"><span class="step-number">02</span><div><h2>Learn a little.</h2><p>Finish all three words. Then see the answers and a simple example for each word. Mistakes are part of learning.</p></div></section><section class="panel how-step"><span class="step-number">03</span><div><h2>Watch it add up.</h2><p>Earn 10 points for finishing and 5 for each right answer. Come back daily to grow a streak and unlock badges.</p></div></section></div><section class="panel large-panel faq"><h2>A few things to know</h2><details open><summary>When is the next challenge?</summary><p>A new challenge opens at midnight India time (IST). Everyone gets the same three words that day. Your device clock does not decide the date or your rewards.</p></details><details><summary>How do points, levels and streaks work?</summary><p>Earn 10–25 points once a day. Each 100 points adds one level. Complete challenges on consecutive days to grow your streak. Miss a full day and your current streak restarts. Your points and earned badges remain.</p></details><details><summary>Are these rewards worth money?</summary><p>No. This is a demo with learning points. They have no cash value and cannot be withdrawn or exchanged for anything. You will never need to pay to use this demo.</p></details><details><summary>How is my progress saved?</summary><p>Your completed days and points are saved on our server. A private cookie identifies this browser. Use the same browser to keep your progress; clearing cookies or using another device starts a new profile. This demo has no sign-up or account recovery.</p></details><details><summary>Can I use it on mobile data or offline?</summary><p>The app has no external fonts, photos, analytics, or large libraries. After your first visit, the app shell is cached on this device. Loading your progress and confirming points need an internet connection. We do not show unconfirmed rewards.</p></details><details><summary>Can I try the challenge again?</summary><p>Your first completed attempt is the one that earns points. You can review the three words as often as you like afterwards. Tapping twice, refreshing, or sending the answers again cannot add points twice.</p></details></section><div class="result-actions"><a class="button primary" href="#today">Find your daily spark ${icon('arrow')}</a></div>`;
}
function loadDraft() {
  try {const saved = JSON.parse(sessionStorage.getItem('spark-draft') || 'null'); if(saved?.day === data.today && Array.isArray(saved.answers) && saved.answers.length === 3 && saved.answers.every(n=>n===null || Number.isInteger(n) && n>=0 && n<3)) return saved; } catch {}
  return {day:data.today,answers:[null,null,null],index:0};
}
function saveDraft() { try {sessionStorage.setItem('spark-draft',JSON.stringify(quiz));} catch {} }
function clearDraft() { try {sessionStorage.removeItem('spark-draft');} catch {} }
function quizView() {
  const q = data.challenge[quiz.index];
  return `<div class="quiz-shell"><div class="quiz-top"><button class="text-button" data-action="exit">${icon('back')} Back to today</button><span>YOUR DAILY ENGLISH SPARK</span></div><progress class="progress-track quiz-progress" value="${quiz.index+1}" max="3" aria-label="Word ${quiz.index+1} of 3"></progress><section class="panel quiz-panel"><span class="eyebrow">WORD ${quiz.index+1} OF 3</span><h1 class="quiz-word" id="quiz-word">${safe(q.word)}</h1><p class="quiz-prompt">What does “${safe(q.word.toLowerCase())}” mean?</p><fieldset class="answers"><legend class="sr-only">Choose the meaning of ${safe(q.word)}</legend>${q.choices.map((choice,i)=>`<label class="answer"><input type="radio" name="answer" value="${i}" ${quiz.answers[quiz.index]===i?'checked':''}><span>${safe(choice)}</span></label>`).join('')}</fieldset><div id="quiz-error" class="inline-error" role="alert" hidden></div><div class="quiz-actions"><button class="button secondary" data-action="previous" ${quiz.index===0?'hidden':''}>${icon('back')} Previous</button><span ${quiz.index!==0?'hidden':''} class="badge-count">Take your time.</span><button class="button primary" data-action="next" ${quiz.answers[quiz.index]===null?'disabled':''}>${quiz.index===2?'Finish & earn points':'Next word'} ${icon(quiz.index===2?'spark':'arrow')}</button></div></section><p class="quiz-hint">${icon('lock')}Your points are confirmed when you finish. Up to 25 points today.</p></div>`;
}
function reviewView() {
  const done = data.completion;
  if (!done) return todayView();
  return `<div class="quiz-shell"><div class="quiz-top"><a class="text-button" href="#today">${icon('back')} Back to today</a><span>${dayLabel(data.today)} · DAILY ENGLISH</span></div><section class="result-top"><div class="result-spark">${icon('spark')}</div><span class="eyebrow">A LITTLE EFFORT. A REAL LITTLE WIN.</span><h1>You made today count.</h1><p>${done.correct===3?'Three out of three. Look at you go!':'You showed up and learned something new. That counts.'}</p><div class="result-points">+${done.points}<span> points earned</span></div><div class="result-meta"><span>${done.correct} of 3 correct</span><span>10 for finishing + ${done.correct*5} for answers</span></div><div class="earned-notice">${data.completedDays===1?'First spark unlocked! Your first daily challenge is in the books.':`${data.streak}-day streak · Your progress is saved.`}</div></section><div class="review-title"><h2>Three words to take with you</h2><span>Keep these little lessons.</span></div>${done.review.map((q,i)=>`<section class="review-card"><div class="review-heading"><h3>${safe(q.word)}</h3><span class="${done.answers[i]===q.answer?'correct-tag':'learn-tag'}">${icon(done.answers[i]===q.answer?'check':'book')}${done.answers[i]===q.answer?'You got it':'A new little lesson'}</span></div><p>${safe(q.meaning)}</p>${done.answers[i]!==q.answer?`<p>You chose: ${safe(q.choices[done.answers[i]])}<br>Correct meaning: <strong>${safe(q.choices[q.answer])}</strong></p>`:''}<div class="review-example">“${safe(q.example)}”</div></section>`).join('')}<div class="result-actions"><a class="button primary" href="#progress">See your progress ${icon('arrow')}</a><a class="button secondary" href="#rewards">Your rewards ${icon('gift')}</a></div><p class="quiz-hint">Next challenge in <span data-countdown>${remaining()}</span> · Midnight India time</p></div>`;
}
function render(focus = false) {
  if (!data) return;
  const active = screen==='quiz'||screen==='review'?'today':screen;
  document.querySelectorAll('[data-route]').forEach(el=> { if(el.dataset.route===active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current'); });
  const views = {today:todayView,progress:progressView,rewards:rewardsView,about:aboutView,quiz:quizView,review:reviewView};
  main.innerHTML = (views[screen] || todayView)();
  document.title = `${{today:'Your daily dose of better',progress:'My progress',rewards:'Rewards',about:'How it works',quiz:'Daily challenge',review:'Your little win'}[screen]} · Daily Spark`;
  if (focus) {main.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});}
}
function route(focus = true) {
  const next = location.hash.slice(1) || 'today';
  if (screen==='quiz' && quiz) saveDraft();
  screen = next==='review' && data?.completion ? 'review' : routes.includes(next)?next:'today';
  render(focus);
}
async function load(focus = false) {
  if (loading) return; loading = true;
  try { const oldDay=data?.today; setData(await api('/api/state')); if (oldDay && oldDay!==data.today) {quiz=null;screen='today';toast('A fresh day, a fresh spark. Your new challenge is ready.');} else if (screen!=='quiz') route(false); render(focus); }
  catch(error) { if(data) toast(error.message); else main.innerHTML=`<section class="panel error-card"><div class="stat-icon">${icon('wifi')}</div><h1>Your spark is still here.</h1><p>${safe(error.message)}</p><button class="button primary" data-action="retry">Try again ${icon('arrow')}</button><p class="quiz-hint">Your saved points will be here when you reconnect.</p></section>`; }
  finally { loading=false; }
}
async function submit() {
  if (busy) return;
  busy = true;
  const btn = main.querySelector('[data-action=next]');
  btn.disabled=true;btn.textContent='Confirming your points…';
  const errorEl=main.querySelector('#quiz-error');errorEl.hidden=true;
  try {
    const result = await api('/api/complete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({day:quiz.day,answers:quiz.answers})});
    setData(result); clearDraft(); quiz=null; screen='review'; location.hash='review'; render(true);
    toast(result.alreadyClaimed?'Today’s points were already saved. Here’s your original result.':`Your ${data.completion.points} points are confirmed. A little win, all yours.`);
  } catch(error) {
    if(error.code==='DAY_CHANGED') {quiz=null;await load(true);screen='today';render(true);toast(error.message);}
    else {errorEl.textContent=error.message;errorEl.hidden=false;btn.disabled=false;btn.innerHTML=`Try again ${icon('arrow')}`;}
  } finally {busy=false;}
}
main.addEventListener('change',e=> { if(screen==='quiz' && e.target.matches('input[name=answer]') && !busy) {quiz.answers[quiz.index]=Number(e.target.value);saveDraft();main.querySelector('[data-action=next]').disabled=false;} });
main.addEventListener('click',async e=> {
  const action=e.target.closest('[data-action]')?.dataset.action;
  if(!action || busy) return;
  if(action==='retry') return load(true);
  if(action==='start') {if(expired()) return load(true);quiz=loadDraft();quiz.index=Number.isInteger(quiz.index)&&quiz.index>=0&&quiz.index<3?quiz.index:0;screen='quiz';render(true);}
  if(action==='review') {screen='review';location.hash='review';render(true);}
  if(action==='exit') {saveDraft();screen='today';render(true);}
  if(action==='previous') {quiz.index=Math.max(0,quiz.index-1);saveDraft();render(true);}
  if(action==='next') {if(quiz.answers[quiz.index]===null) return;if(quiz.index<2){quiz.index++;saveDraft();render(true);}else await submit();}
});
const dialog=document.querySelector('#info-dialog');
document.querySelector('#profile').addEventListener('click',()=>dialog.showModal());
dialog.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>dialog.close()));
dialog.addEventListener('click',e=> {if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
window.addEventListener('hashchange',()=>{if(!busy)route();});
window.addEventListener('online',()=>{connection();if(!data)load();else if(screen!=='quiz')load();});
window.addEventListener('offline',()=>{connection();toast('You’re offline. Reconnect to load progress or confirm points.');});
function connection(){const el=document.querySelector('#connection');el.innerHTML=navigator.onLine?'<span class="status-dot"></span> Lightweight by design':icon('wifi')+' You’re offline';}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible' && data && (expired() || screen!=='quiz'))load();});
setInterval(()=>{if(!data)return;if(expired()){if(!busy)load();return;}document.querySelectorAll('[data-countdown]').forEach(el=>el.textContent=remaining());},60000);
if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
connection();load();
