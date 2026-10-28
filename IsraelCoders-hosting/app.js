// ================== מצב ושמירה ==================
const $ = (id) => document.getElementById(id);
const CHECK_ICON = '<svg class="ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

// ההתקדמות נשמרת בשרת, בחשבון של המשתמש — אפשר להמשיך מכל מחשב.
// כל שינוי נשמר אוטומטית כמעט שנייה אחרי שמפסיקים לשנות.
const store = {
  data: {},
  timer: null,
  get(key, fallback) {
    return key in this.data ? this.data[key] : fallback;
  },
  set(key, value) {
    this.data[key] = value;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), 800);
  },
  async save(keepalive = false) {
    clearTimeout(this.timer);
    this.timer = null;
    setSaveState('saving');
    try {
      const r = await fetch('/api/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ progress: this.data }),
        keepalive
      });
      if (r.status === 401) return location.replace('/login.html');
      if (!r.ok) throw new Error(r.status);
      setSaveState('saved');
    } catch {
      setSaveState('offline');
      this.timer = setTimeout(() => this.save(), 5000); // אין חיבור — מנסים שוב
    }
  }
};
function setSaveState(s) {
  const el = document.getElementById('saveState');
  if (!el) return;
  el.textContent = { saving: 'שומר…', saved: 'נשמר', offline: 'אין חיבור — מנסים שוב' }[s];
  el.className = `save-state ${s}`;
}

// סוגרים את הדף לפני שהשמירה יצאה? שולחים אותה מיד
window.addEventListener('pagehide', () => { if (store.timer) store.save(true); });

const state = {
  user: null,                          // { id, name }
  chapterIdx: 0,
  missionIdx: 0,
  done: {},                            // { missionId: true }
  codes: {},                           // { missionId: code }
  seen: {},                            // { missionId: true } — שיעורים שכבר נקראו
  helped: {},                          // { missionId: true } — משימות שבהן ביקשו עזרה מינשוף
  streak: { count: 0, last: '' },      // ימים ברצף שבהם נפתרה משימה
  chats: {},                           // { missionId: [{role, content, sig}] } — נשמר בחשבון
  hintLevel: {},                       // { missionId: n } — לרמזים במצב לא מקוון
  lastRun: null,                       // { output, error }
  lastTests: null,
  lastRules: []                        // דרישות קוד שלא מתקיימות (מהבדיקה האחרונה)
};

// גרסאות קודמות שמרו בדפדפן — מעבירים את זה לחשבון פעם אחת
function takeBrowserProgress() {
  const prefix = `ic:${state.user.id}:`;
  const old = {};
  for (const key of ['chapter', 'mission', 'done', 'codes']) {
    try {
      const v = localStorage.getItem(prefix + key);
      if (v !== null) old[key] = JSON.parse(v);
      localStorage.removeItem(prefix + key);
    } catch {}
  }
  return Object.keys(old).length ? old : null;
}

async function loadProgress() {
  const r = await fetch('/api/progress');
  if (!r.ok) throw new Error('progress');
  const saved = (await r.json()).progress;
  const fromBrowser = takeBrowserProgress();
  store.data = saved || fromBrowser || {};
  if (!saved && fromBrowser) store.save();
  state.chapterIdx = store.get('chapter', 0);
  state.missionIdx = store.get('mission', 0);
  state.done = store.get('done', {});
  state.codes = store.get('codes', {});
  state.seen = store.get('seen', {});
  state.helped = store.get('helped', {});
  state.chats = store.get('chats', {});
  state.flags = store.get('flags', {});
  state.streak = store.get('streak', { count: 0, last: '' });
}

let pyodide = null;

const chapter = () => CHAPTERS[state.chapterIdx];
const mission = () => chapter().missions[state.missionIdx];

// ================== טעינת פייתון ==================
// מסך טעינה: פייתון יורד לדפדפן (כ-10MB בפעם הראשונה, אחר כך מהיר יותר)
const LOADING_STEPS = [
  [4000, 'עוד רגע… בפעם הראשונה ההורדה לוקחת קצת יותר זמן.'],
  [10000, 'כמעט שם! בפעם הבאה זה יהיה הרבה יותר מהיר.'],
  [25000, 'זה לוקח יותר מהרגיל — אולי האינטרנט איטי. ממשיכים לחכות…']
];

async function initPython() {
  setBusy(true);
  const timers = LOADING_STEPS.map(([ms, text]) => setTimeout(() => ($('pyLoadingText').textContent = text), ms));
  try {
    pyodide = await loadPyodide();
    $('pyLoadingText').textContent = 'מכין את העורך…';
    $('pyStatus').textContent = 'פייתון מוכן';
    $('pyStatus').className = 'py-status ready';
    pyodide.runPython(`
def __check_syntax(src):
    try:
        compile(src, '<your code>', 'exec')
        return None
    except SyntaxError as e:
        return [type(e).__name__, e.msg, e.lineno]
`);
    checkSyntax();
    $('pyLoading').hidden = true;
    setBusy(false);
  } catch (e) {
    $('pyStatus').textContent = 'שגיאה בטעינת פייתון';
    $('pyStatus').className = 'py-status error';
    $('pyLoading').classList.add('failed');
    $('pyLoadingText').textContent = 'לא הצלחנו לטעון את פייתון. בדקו את החיבור לאינטרנט ורעננו את הדף.';
    console.error(e);
  }
  timers.forEach(clearTimeout);
}

// מריץ את הקוד של המשתמש עם רשימת קלטים.
// interactive: כשהקלטים נגמרים התוכנית עוצרת ומחזירה needInput, והקלט מוצג בקונסול.
const RUNNER = `
import sys, io, builtins, traceback
__buf = io.StringIO()
__old_out, __old_in = sys.stdout, builtins.input
__err = None
__q = list(__inputs)
__need = False
__steps = [0]
__FN = '<your code>'

class __NeedInput(Exception):
    pass

def __input(prompt=''):
    if __interactive:
        sys.stdout.write(str(prompt))
        if not __q:
            raise __NeedInput()
        v = str(__q.pop(0))
        sys.stdout.write('\\x01' + v + '\\x02\\n')
        return v
    if not __q:
        raise EOFError('הקוד ביקש יותר קלט ממה שהטסט נותן')
    return str(__q.pop(0))

def __local(frame, event, arg):
    __steps[0] += 1
    if __steps[0] > 2_000_000:
        raise TimeoutError('loop')
    return __local

def __trace(frame, event, arg):
    return __local if frame.f_code.co_filename == __FN else None

__ns = {'__name__': '__main__'}
sys.stdout = __buf
builtins.input = __input
sys.settrace(__trace)
try:
    exec(compile(__user_code, __FN, 'exec'), __ns)
except SystemExit:
    pass
except __NeedInput:
    __need = True
except BaseException as e:
    line = None
    if isinstance(e, SyntaxError):
        line = e.lineno
    else:
        for fr in traceback.extract_tb(e.__traceback__):
            if fr.filename == __FN:
                line = fr.lineno
    __err = [type(e).__name__, str(e), line]
finally:
    sys.settrace(None)
    sys.stdout = __old_out
    builtins.input = __old_in
__vars = []
for __k, __v in list(__ns.items()):
    if __k.startswith('__'):
        continue
    if callable(__v) and not isinstance(__v, type):
        __vars.append([__k, 'function', ''])
    elif __v is None or isinstance(__v, (bool, int, float, str, list, dict, tuple)):
        __r = repr(__v)
        __vars.append([__k, type(__v).__name__, __r if len(__r) <= 60 else __r[:57] + '...'])
[__buf.getvalue(), __err, __need, __vars]
`;

async function runPython(code, inputs, interactive = false) {
  if (!pyodide) throw new Error('פייתון עדיין נטען, נסו שוב בעוד רגע');
  pyodide.globals.set('__user_code', code);
  pyodide.globals.set('__inputs', pyodide.toPy(inputs));
  pyodide.globals.set('__interactive', interactive);
  const res = await pyodide.runPythonAsync(RUNNER);
  const [output, err, needInput, vars] = res.toJs();
  res.destroy();
  return { output, needInput, vars, error: err ? { type: err[0], message: err[1], line: err[2] } : null };
}

// ================== הסבר שגיאות בעברית ==================
// מוצא את השם הכי דומה (שגיאת כתיב של אות או שתיים): פקודות פייתון + שמות מהקוד
function closestName(name) {
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // שתי אותיות שהתחלפו (pirnt ← print) נחשבות טעות אחת
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  };
  const known = new Set([...PY_WORDS, ...(codeEl.value.match(/[A-Za-z_]\w*(?=\s*=[^=])/g) || [])]);
  let best = null, bestD = name.length > 4 ? 2 : 1;
  for (const w of known) {
    const dd = dist(name.toLowerCase(), w.toLowerCase());
    if (w !== name && (dd < bestD || (dd === bestD && (!best || w.length === name.length)))) { best = w; bestD = dd; }
  }
  return best;
}

function explainError(err) {
  if (!err) return '';
  const { type, message } = err;
  let m;
  if (type === 'TimeoutError') return 'נראה שהתוכנית רצה יותר מדי זמן — אולי יש לולאה שלא נגמרת אף פעם? בדקו מה משתנה בתוך הלולאה, ומתי התנאי שלה הופך ל-False.';
  if (type === 'NameError' && (m = message.match(/'(.+?)'/))) {
    const name = m[1];
    if (name === 'true' || name === 'false') return `בפייתון כותבים ${name === 'true' ? 'True' : 'False'} עם אות גדולה בהתחלה.`;
    const guess = message.match(/Did you mean: '(.+?)'/)?.[1] || closestName(name);
    return `פייתון לא מכיר את השם "${name}".` + (guess ? ` אולי התכוונתם ל-"${guess}"?` : ' אולי יש שגיאת כתיב, או שעוד לא יצרתם משתנה בשם הזה? ואם זה טקסט — שכחתם מרכאות?');
  }
  if (type === 'IndentationError') {
    if (/expected an indented block/.test(message)) return 'אחרי שורה שנגמרת בנקודתיים (:) — כמו if, for או def — השורה הבאה צריכה להיות מוזזת פנימה (4 רווחים).';
    if (/unexpected indent/.test(message)) return 'השורה הזו מוזזת פנימה בלי סיבה. רק שורות שנמצאות בתוך if, for, while או def מוזזות.';
    return 'בעיה בהזחה (רווחים בתחילת השורה). כל השורות באותו בלוק צריכות להתחיל באותו מקום.';
  }
  if (type === 'SyntaxError') {
    if (/Maybe you meant '==' /.test(message) || /cannot assign to/.test(message)) return 'בתנאי משווים עם == (שני סימני שוויון). סימן = אחד שומר ערך במשתנה.';
    if (/Missing parentheses in call to 'print'/.test(message)) return 'בפייתון 3, print צריך סוגריים: print(...).';
    if (/never closed|was not closed/.test(message)) return 'יש סוגריים או מרכאות שנפתחו ולא נסגרו. ספרו את הסוגריים בשורה.';
    if (/unmatched/.test(message)) return 'יש סוגר שנסגר בלי שנפתח. ספרו את הסוגריים בשורה.';
    if (/expected ':'/.test(message)) return 'חסרות נקודתיים (:) בסוף השורה — למשל אחרי if, else, for, while או def.';
    if (/unterminated string/.test(message)) return 'מחרוזת שלא נסגרה — חסרות מרכאות בסוף הטקסט.';
    if (/invalid character/.test(message)) return 'יש בשורה תו שפייתון לא מכיר — אולי מרכאות "מעוצבות" (“ ”) או אות בעברית בתוך הקוד? השתמשו במרכאות רגילות.';
    if (/Perhaps you forgot a comma/.test(message)) return 'פייתון רואה כמה דברים צמודים בלי סימן ביניהם. אם זה טקסט — הוא צריך מרכאות. אם אלה כמה ערכים — צריך פסיק ביניהם.';
    return 'שגיאת תחביר: פייתון לא הצליח להבין את המבנה של השורה. חפשו סוגריים, מרכאות או נקודתיים חסרים.';
  }
  if (type === 'TypeError') {
    if (/can only concatenate str|unsupported operand type.*'str'.*'int'|'int'.*'str'/.test(message)) return 'ניסיתם לחבר טקסט (str) עם מספר (int). פייתון לא יודע לעשות את זה לבד — חשבו איזה מהם צריך להמיר, ולמה.';
    if (/not supported between instances of 'str' and 'int'|'int' and 'str'/.test(message)) return 'ניסיתם להשוות טקסט למספר. זכרו ש-input תמיד מחזיר טקסט!';
    if (/'str' object cannot be interpreted as an integer/.test(message)) return 'range (או פעולה דומה) קיבלה טקסט במקום מספר. מה ש-input מחזיר הוא טקסט — צריך להמיר אותו.';
    if ((m = message.match(/missing (\d+) required positional argument/))) return `קראתם לפונקציה עם פחות ערכים ממה שהיא צריכה — חסר ${m[1] === '1' ? 'ערך אחד' : m[1] + ' ערכים'}. בדקו כמה פרמטרים יש ב-def.`;
    if (/takes \d+ positional arguments? but \d+ (were|was) given/.test(message)) return 'קראתם לפונקציה עם יותר ערכים ממה שהיא מקבלת. השוו את הקריאה לשורת ה-def.';
    if (/'int' object is not iterable/.test(message)) return 'for צריך לעבור על אוסף (רשימה, מחרוזת, range) — לא על מספר בודד. אולי התכוונתם ל-range(...)?';
    if (/object is not subscriptable/.test(message)) return 'ניסיתם לגשת עם [ ] לערך שאין לו מקומות — למשל מספר. רק לרשימות, מחרוזות ומילונים יש [ ].';
    if (/object is not callable/.test(message)) return 'ניסיתם "להפעיל" עם סוגריים משהו שהוא לא פונקציה. אולי נתתם למשתנה שם של פונקציה, כמו print או input?';
    return 'שגיאת טיפוס: פעולה על ערך מסוג לא מתאים. בדקו בטבלת המשתנים מאיזה סוג כל משתנה.';
  }
  if (type === 'AttributeError' && (m = message.match(/'(\w+)' object has no attribute '(\w+)'/))) return `לערך מסוג ${m[1]} אין פעולה בשם "${m[2]}". בדקו את סוג המשתנה, ושם הפעולה כתוב נכון.`;
  if (type === 'KeyError') return `המפתח ${message} לא קיים במילון. אפשר לבדוק קודם עם in, לפני שניגשים אליו.`;
  if (type === 'ValueError') {
    if (/invalid literal for int/.test(message)) return 'int() קיבל טקסט שאי אפשר להפוך למספר שלם (למשל אותיות, רווח, או מספר עשרוני).';
    if (/not enough values to unpack/.test(message)) return 'ניסיתם לפרק ליותר משתנים ממה שיש. למשל split החזיר פחות חלקים ממה שציפיתם.';
    if (/too many values to unpack/.test(message)) return 'ניסיתם לפרק לפחות משתנים ממה שיש. למשל split החזיר יותר חלקים ממה שציפיתם.';
  }
  if (type === 'ZeroDivisionError') return 'ניסיתם לחלק באפס — אי אפשר!';
  if (type === 'EOFError') return 'הקוד ביקש יותר פעמים קלט (input) ממה שצריך במשימה הזו. כמה פעמים אתם קוראים ל-input?';
  if (type === 'IndexError') return 'ניסיתם לגשת למקום שלא קיים ברשימה או במחרוזת. זכרו שהספירה מתחילה מ-0, והמקום האחרון הוא האורך פחות 1.';
  return 'קרתה שגיאה. קראו את ההודעה באנגלית — היא בדרך כלל מסבירה מה השתבש ובאיזו שורה.';
}

// ================== ממשק: משימות ==================
// ===== תגמולים: נקודות, רצף ימים ותגים =====
const POINTS_PER_MISSION = 10;
const NO_HELP_BONUS = 5;

const missionPoints = (id) => (state.done[id] ? POINTS_PER_MISSION + (state.helped[id] ? 0 : NO_HELP_BONUS) : 0);
const totalPoints = () => PATH.reduce((sum, p) => sum + missionPoints(p.m.id), 0);
const chapterDone = (c) => c.missions.every((m) => state.done[m.id]);

function dayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// הרצף "חי" רק אם פתרתם היום או אתמול
function liveStreak() {
  const { count, last } = state.streak;
  const yesterday = dayKey(new Date(Date.now() - 864e5));
  return last === dayKey() || last === yesterday ? count : 0;
}

function bumpStreak() {
  const today = dayKey();
  if (state.streak.last === today) return;
  state.streak = { count: liveStreak() + 1, last: today };
  store.set('streak', state.streak);
}

// תג לכל אזור ביער: images/badges/badge-01.png ... badge-09.png
const badgeSrc = (c) => `images/badges/badge-${c.id}.png`;

function renderRewards() {
  $('points').textContent = totalPoints();
  const streak = liveStreak();
  $('streak').textContent = streak;
  $('streakChip').classList.toggle('on', streak > 0);
  $('badgeGrid').innerHTML = CHAPTERS.map((c) => {
    const got = chapterDone(c);
    return `<div class="badge-item${got ? ' got' : ''}" title="${esc(c.title)}${got ? ' — הושג!' : ' — מסיימים את האזור כדי לקבל אותו'}"><img src="${badgeSrc(c)}" alt="תג ${c.id}" /><span>${c.id}</span></div>`;
  }).join('');
}

// הינשוף קופץ לחגוג
let celebrateTimer;
// image: תמונה לחגיגה (למשל התג החדש). בלי תמונה — הינשוף
function celebrate(title, text, image = 'images/owl.png') {
  $('celebrateImg').src = image;
  $('celebrate').classList.toggle('with-badge', image !== 'images/owl.png');
  $('celebrateTitle').textContent = title;
  $('celebrateText').textContent = text;
  const el = $('celebrate');
  el.hidden = false;
  el.classList.remove('show');
  void el.offsetWidth; // מאתחל את האנימציה
  el.classList.add('show');
  clearTimeout(celebrateTimer);
  celebrateTimer = setTimeout(() => (el.hidden = true), 3200);
}
$('celebrate').onclick = () => ($('celebrate').hidden = true);

// ===== מסלול: כל משימה נפתחת רק אחרי שפותרים את הקודמת =====
const LOCK_ICON = '<svg class="ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
const PATH = CHAPTERS.flatMap((c, ci) => c.missions.map((m, mi) => ({ m, ci, mi })));
const pathIndex = (ci, mi) => PATH.findIndex((p) => p.ci === ci && p.mi === mi);

function isUnlocked(ci, mi) {
  const i = pathIndex(ci, mi);
  return i === 0 || !!state.done[PATH[i - 1].m.id];
}

function nextStep() {
  return PATH[pathIndex(state.chapterIdx, state.missionIdx) + 1];
}

// המשימה הראשונה שעוד לא נפתרה (או האחרונה, אם הכל נפתר)
function currentStep() {
  return PATH.find((p) => !state.done[p.m.id]) || PATH[PATH.length - 1];
}

function goTo(ci, mi) {
  state.chapterIdx = ci;
  store.set('chapter', ci);
  renderChapters();
  selectMission(mi);
}

function renderChapters() {
  const sel = $('chapterSelect');
  sel.innerHTML = CHAPTERS.map((c, i) => {
    const open = isUnlocked(i, 0);
    return `<option value="${i}"${open ? '' : ' disabled'}>${c.id} | ${c.title}${open ? '' : ' (נעול)'}</option>`;
  }).join('');
  sel.value = state.chapterIdx;
}

function renderMissions() {
  const list = $('missionList');
  list.innerHTML = '';
  chapter().missions.forEach((m, i) => {
    const li = document.createElement('li');
    const locked = !isUnlocked(state.chapterIdx, i);
    li.className = 'mission' + (i === state.missionIdx ? ' active' : '') + (state.done[m.id] ? ' done' : '') + (locked ? ' locked' : '');
    const badge = state.done[m.id] ? CHECK_ICON : locked ? LOCK_ICON : i + 1;
    li.innerHTML = `<span class="tag" dir="auto">${m.concept}</span><span>${m.title}</span><span class="badge">${badge}</span>`;
    li.onclick = () => {
      if (!locked) return selectMission(i);
      const prev = PATH[pathIndex(state.chapterIdx, i) - 1].m;
      showToast(`המשימה נעולה. קודם פותרים את "${prev.title}"`, true);
    };
    list.appendChild(li);
  });
  const total = chapter().missions.length;
  const done = chapter().missions.filter((m) => state.done[m.id]).length;
  $('progressBar').style.width = (done / total) * 100 + '%';
  $('progressText').textContent = `${done} מתוך ${total} משימות הושלמו`;
}

function renderTask() {
  const m = mission();
  $('crumb').textContent = `${chapter().id} | ${chapter().title}`;
  $('missionTitle').textContent = m.title;
  $('missionDesc').textContent = m.description;
  $('exInput').textContent = m.example.input;
  $('exOutput').textContent = m.example.output;
  codeEl.value = state.codes[m.id] ?? STARTER;
  focusLine = null;
  setProblem(null);
  checkSyntax();
  $('console').innerHTML = '<span class="muted">הפלט של התוכנית יופיע כאן…</span>';
  state.lastRun = null;
  state.lastTests = null;
  state.lastRules = [];
  $('runSampleBtn').hidden = !m.tests[0].inputs.length;
  $('runSampleBtn').title = m.tests[0].inputs.length ? `מריץ עם הקלט: ${m.tests[0].inputs.join(', ')}` : '';
  renderTests();
  renderChat();
  renderLesson();
  // משימה חדשה? קודם השיעור. כבר ראיתם או סיימתם? ישר לתרגול.
  switchTab(state.seen[m.id] || state.done[m.id] ? 'practice' : 'lesson');
}

function selectMission(i) {
  state.missionIdx = i;
  store.set('mission', i);
  renderMissions();
  renderTask();
}

$('chapterSelect').onchange = (e) => {
  state.chapterIdx = Number(e.target.value);
  store.set('chapter', state.chapterIdx);
  selectMission(0);
};

// ================== עורך קוד (CodeMirror) ==================
// מילים לשלמות אוטומטית: פקודות פייתון נפוצות + כל שם שכבר כתבתם בקוד
const PY_WORDS = ['print', 'input', 'int', 'str', 'float', 'len', 'range', 'sum', 'max', 'min', 'list', 'dict',
  'append', 'split', 'return', 'def', 'while', 'for', 'in', 'if', 'elif', 'else', 'and', 'or', 'not', 'True',
  'False', 'None', 'break', 'continue', 'abs', 'round', 'sorted', 'type', 'lower', 'upper', 'strip', 'join'];

function pyHint(cm) {
  const cur = cm.getCursor();
  const token = cm.getTokenAt(cur);
  const word = token.string.slice(0, cur.ch - token.start);
  if (!/^[A-Za-z_]\w*$/.test(word)) return null;
  const mine = cm.getValue().match(/[A-Za-z_]\w{2,}/g) || [];
  const list = [...new Set([...PY_WORDS, ...mine])].filter((w) => w.startsWith(word) && w !== word).sort();
  const items = list.map((w) => ({
    text: w,
    render: (el) => {
      el.innerHTML = `<b>${esc(w)}</b>${GLOSSARY[w] ? `<span class="hint-desc">${esc(GLOSSARY[w].short)}</span>` : ''}`;
    }
  }));
  return { list: items, from: CodeMirror.Pos(cur.line, token.start), to: CodeMirror.Pos(cur.line, token.end) };
}

const editor = CodeMirror.fromTextArea($('code'), {
  mode: 'python',
  theme: 'forest',
  lineNumbers: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: false,
  matchBrackets: true,
  autoCloseBrackets: true,
  styleActiveLine: true,
  direction: 'ltr',
  extraKeys: {
    Tab: (cm) => (cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('    ')),
    'Shift-Tab': (cm) => cm.indentSelection('subtract'),
    'Ctrl-Enter': () => runCode(),
    'Cmd-Enter': () => runCode(),
    'Shift-Ctrl-Enter': () => checkCode(),
    'Shift-Cmd-Enter': () => checkCode(),
    'Ctrl-Space': (cm) => cm.showHint({ hint: pyHint, completeSingle: false }),
    // Backspace בתוך הזחה מוחק 4 רווחים בבת אחת
    Backspace: (cm) => {
      const c = cm.getCursor();
      const before = cm.getLine(c.line).slice(0, c.ch);
      if (cm.somethingSelected() || !/^ +$/.test(before)) return CodeMirror.Pass;
      cm.replaceRange('', CodeMirror.Pos(c.line, c.ch - (before.length % 4 || 4)), c);
    }
  }
});

// הצעות מופיעות לבד אחרי שתי אותיות (לא בתוך טקסט או הערה)
// ===== מה אומרת כל מילה? (מילון בעברית) =====
// המילה שנמצאת במקום pos בקוד — אם יש לה הסבר במילון
function glossaryWordAt(cm, pos) {
  for (const ch of [pos.ch + 1, pos.ch]) {
    const tok = cm.getTokenAt(CodeMirror.Pos(pos.line, ch), true);
    if (!tok || tok.type === 'string' || tok.type === 'comment') continue;
    const word = tok.string.trim();
    if (GLOSSARY[word]) return { word, tok };
  }
  return null;
}

const codeTip = $('codeTip');
function hideTip() { codeTip.hidden = true; }

// מעבר עם העכבר על מילה בקוד מציג מה היא עושה
function attachGlossary(cm) {
  const wrap = cm.getWrapperElement();
  wrap.addEventListener('mousemove', (e) => {
    const pos = cm.coordsChar({ left: e.clientX, top: e.clientY }, 'window');
    const hit = glossaryWordAt(cm, pos);
    if (hit) {
      // רק אם העכבר באמת על המילה (ולא בסוף השורה הריק)
      const a = cm.charCoords(CodeMirror.Pos(pos.line, hit.tok.start), 'window');
      const b = cm.charCoords(CodeMirror.Pos(pos.line, hit.tok.end), 'window');
      if (e.clientX < a.left - 2 || e.clientX > b.left + 2 || e.clientY < a.top || e.clientY > a.bottom) return hideTip();
      const g = GLOSSARY[hit.word];
      codeTip.innerHTML = `<div class="tip-head"><b dir="ltr">${esc(hit.word)}</b><span>${esc(g.short)}</span></div><p>${esc(g.text)}</p><pre dir="ltr">${esc(g.example)}</pre>`;
      codeTip.hidden = false;
      const w = codeTip.offsetWidth, h = codeTip.offsetHeight;
      const top = a.bottom + 6 + h < innerHeight ? a.bottom + 6 : a.top - h - 6;
      codeTip.style.top = `${Math.max(8, top)}px`;
      codeTip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, a.left))}px`;
    } else {
      hideTip();
    }
  });
  wrap.addEventListener('mouseleave', hideTip);
  cm.on('keydown', hideTip);
  cm.on('scroll', hideTip);
}
attachGlossary(editor);

// שורת עזרה מתחת לעורך: מסבירה את המילה שהסמן עומד עליה (עובד גם בטלפון)
const WORD_HELP_DEFAULT = 'טיפ: העבירו את העכבר על מילה בקוד, או שימו עליה את הסמן, כדי לראות מה היא עושה.';
function updateWordHelp() {
  const hit = glossaryWordAt(editor, editor.getCursor());
  const el = $('wordHelp');
  if (!hit) {
    el.classList.remove('on');
    el.textContent = WORD_HELP_DEFAULT;
    return;
  }
  const g = GLOSSARY[hit.word];
  el.classList.add('on');
  el.innerHTML = `<b dir="ltr">${esc(hit.word)}</b> — ${esc(g.text)} <code dir="ltr">${esc(g.example.split('\n')[0])}</code>`;
}
editor.on('cursorActivity', updateWordHelp);

editor.on('inputRead', (cm, change) => {
  if (cm.state.completionActive || !/^\w$/.test(change.text[0])) return;
  const tok = cm.getTokenAt(cm.getCursor());
  if (tok.string.length >= 2 && tok.type !== 'string' && tok.type !== 'comment') {
    cm.showHint({ hint: pyHint, completeSingle: false });
  }
});

// codeEl: גישה פשוטה לתוכן העורך משאר האפליקציה
let silentChange = false;
const codeEl = {
  get value() { return editor.getValue(); },
  set value(v) {
    silentChange = true; // החלפת משימה היא לא "הקלדה" — לא שומרים ולא מסמנים
    editor.setValue(v);
    editor.clearHistory();
    silentChange = false;
  },
  focus() { editor.focus(); }
};

let focusLine = null; // שורה שינשוף הצביע עליה
let markedLines = [];

// מסמן בעורך את שורת הבעיה (אדום) ואת השורה שינשוף הצביע עליה (זהב)
function updateGutter() {
  markedLines.forEach(([h, where, cls]) => editor.removeLineClass(h, where, cls));
  markedLines = [];
  const mark = (ln, cls) => {
    if (!ln || ln > editor.lineCount()) return;
    const h = editor.getLineHandle(ln - 1);
    editor.addLineClass(h, 'gutter', cls);
    editor.addLineClass(h, 'background', cls + '-bg');
    markedLines.push([h, 'gutter', cls], [h, 'background', cls + '-bg']);
  };
  mark(focusLine, 'cm-focus-line');
  mark(state.problem?.line, 'cm-bad-line');
}

// ===== בעיות בקוד: בדיקת תחביר בזמן הקלדה + שגיאת הרצה אחרונה =====
// state.problem = { type, message, line, source: 'syntax' | 'run' }
function setProblem(problem) {
  state.problem = problem;
  if (problem) {
    const where = problem.line ? `שורה ${problem.line}: ` : '';
    $('problemText').textContent = where + explainError(problem);
  }
  $('problems').hidden = !problem;
  updateGutter();
}

function checkSyntax() {
  if (!pyodide) return;
  try {
    const res = pyodide.globals.get('__check_syntax')(codeEl.value);
    if (res) {
      const [type, message, line] = res.toJs();
      res.destroy();
      setProblem({ type, message, line, source: 'syntax' });
    } else if (state.problem?.source === 'syntax' || state.problem?.source === 'run') {
      setProblem(null);
    }
  } catch (e) {
    console.error(e);
  }
}

let syntaxTimer;
function onCodeChanged() {
  focusLine = null;
  updateGutter();
  state.codes[mission().id] = codeEl.value;
  store.set('codes', state.codes);
  clearTimeout(syntaxTimer);
  syntaxTimer = setTimeout(checkSyntax, 500);
}
editor.on('change', () => { if (!silentChange) onCodeChanged(); });

// מסמן ובוחר שורה בעורך (כשלוחצים על "שורה N" בהודעה של ינשוף)
function jumpToLine(ln) {
  if (ln < 1 || ln > editor.lineCount()) return;
  switchTab('practice');
  editor.focus();
  editor.setSelection(CodeMirror.Pos(ln - 1, 0), CodeMirror.Pos(ln - 1, editor.getLine(ln - 1).length));
  editor.scrollIntoView({ line: ln - 1, ch: 0 }, 60);
  focusLine = ln;
  updateGutter();
}

// גודל גופן בעורך (נשמר במחשב הזה)
let fontSize = 14;
try { fontSize = Number(localStorage.getItem('ic:fontsize')) || 14; } catch {}
function applyFontSize() {
  editor.getWrapperElement().style.fontSize = `${fontSize}px`;
  editor.refresh();
}
document.querySelectorAll('.font-ctl button').forEach((b) => (b.onclick = () => {
  fontSize = Math.min(22, Math.max(12, fontSize + Number(b.dataset.d)));
  try { localStorage.setItem('ic:fontsize', fontSize); } catch {}
  applyFontSize();
}));
applyFontSize();

$('askProblem').onclick = () => askTutor('מה הבעיה שמסומנת בקוד שלי? תעזור לי להבין אותה');

// ================== הרצה ובדיקה ==================
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TYPE_NAMES = {
  str: 'טקסט (str)', int: 'מספר שלם (int)', float: 'מספר עשרוני (float)', bool: 'אמת/שקר (bool)',
  list: 'רשימה (list)', dict: 'מילון (dict)', tuple: 'tuple', NoneType: 'כלום (None)', function: 'פונקציה'
};

function renderOutput({ output, error, vars }, waiting = false) {
  let html = esc(output).replace(/\x01([\s\S]*?)\x02/g, '<span class="in">$1</span>');
  if (error) {
    const msg = error.type === 'TimeoutError' ? 'TimeoutError: התוכנית רצה יותר מדי זמן' : `${error.type}: ${error.message}`;
    html += `<span class="err">${esc(msg)}</span>`;
    const lineText = error.line ? (codeEl.value.split('\n')[error.line - 1] || '').trim() : '';
    if (lineText) html += `<span class="err-line"><b>שורה ${error.line}:</b> <code>${esc(lineText)}</code></span>`;
    html += `<span class="err-he">${esc(explainError(error))}</span>`;
  }
  if (!output && !error && !waiting) html = '<span class="muted">(התוכנית רצה ולא הדפיסה כלום)</span>';
  // טבלת משתנים: רואים מה יש בכל משתנה, ובעיקר מאיזה סוג הוא
  if (!waiting && vars && vars.length) {
    html += `<details class="vars" dir="rtl" open><summary>משתנים בסוף ההרצה</summary><table>${vars.map(([name, type, value]) =>
      `<tr><td dir="ltr" class="v-name">${esc(name)}</td><td class="v-type t-${esc(type)}">${esc(TYPE_NAMES[type] || type)}</td><td dir="ltr" class="v-val">${esc(value)}</td></tr>`).join('')}</table></details>`;
  }
  $('console').innerHTML = html;
}

// preset: קלטים מוכנים (מהדוגמה) — חוסך להקליד אותם בכל הרצה
async function runCode(preset) {
  setBusy(true);
  $('console').innerHTML = '<span class="muted">מריץ…</span>';
  const inputs = Array.isArray(preset) ? [...preset] : [];
  try {
    // כל פעם שהתוכנית צריכה קלט, מבקשים אותו בקונסול ומריצים מחדש עם כל הקלטים עד עכשיו
    while (true) {
      const res = await runPython(codeEl.value, inputs, true);
      if (!res.needInput) {
        state.lastRun = { output: res.output.replace(/[\x01\x02]/g, ''), error: res.error, vars: res.vars };
        renderOutput(res);
        setProblem(res.error ? { ...res.error, source: 'run' } : null);
        break;
      }
      renderOutput(res, true);
      const value = await readConsoleInput();
      if (value === null) {
        $('console').insertAdjacentHTML('beforeend', '\n<span class="muted">(ההרצה הופסקה)</span>');
        break;
      }
      inputs.push(value);
    }
  } catch (e) {
    $('console').innerHTML = `<span class="err">${esc(e.message)}</span>`;
  }
  setBusy(false);
}

// שורת קלט בתוך הקונסול. Enter שולח, Escape מפסיק את ההרצה.
function readConsoleInput() {
  return new Promise((resolve) => {
    const field = document.createElement('input');
    field.className = 'console-input';
    field.spellcheck = false;
    field.setAttribute('aria-label', 'קלט לתוכנית');
    $('console').appendChild(field);
    field.focus();
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') resolve(field.value);
      else if (e.key === 'Escape') resolve(null);
    });
  });
}

const normalize = (s) => s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).join('\n').trim();

// בודק כללים על הקוד עצמו: מה חובה להשתמש בו ומה אסור (בלי להתחשב בהערות #)
function ruleFailures(m, code) {
  const src = code.split('\n').map((l) => l.replace(/#.*$/, '')).join('\n');
  return [
    ...(m.requires || []).filter((r) => !r.pattern.test(src)),
    ...(m.forbids || []).filter((r) => r.pattern.test(src))
  ].map((r) => r.message);
}

async function checkCode() {
  setBusy(true);
  const m = mission();
  const results = [];
  state.lastRules = ruleFailures(m, codeEl.value);
  try {
    for (const t of m.tests) {
      const res = await runPython(codeEl.value, t.inputs);
      const pass = !res.error && normalize(res.output) === normalize(t.expected);
      results.push({ ...t, actual: res.output, error: res.error, pass, hint: pass || res.error ? null : diffHint(t.expected, res.output) });
    }
  } catch (e) {
    showToast(e.message, true);
    setBusy(false);
    return;
  }
  state.lastTests = results;
  const crashed = results.find((r) => r.error);
  setProblem(crashed ? { ...crashed.error, source: 'run' } : null);
  renderTests();
  switchTab('tests');
  const passed = results.filter((r) => r.pass).length;
  if (passed === results.length && state.lastRules.length) {
    showToast('הטסטים עברו, אבל הקוד לא עומד בדרישות המשימה', true);
  } else if (passed === results.length) {
    const firstTime = !state.done[m.id];
    if (firstTime) {
      state.done[m.id] = true;
      store.set('done', state.done);
      bumpStreak();
      store.save(); // פתרון משימה נשמר מיד, בלי לחכות
      renderChapters();
      renderMissions();
      renderRewards();
      const pts = missionPoints(m.id);
      const bonus = pts > POINTS_PER_MISSION ? ` (כולל ${NO_HELP_BONUS} בונוס על פתרון בלי עזרה!)` : '';
      if (chapterDone(chapter())) {
        celebrate('קיבלתם תג חדש!', `סיימתם את האזור "${chapter().title}". +${pts} נקודות${bonus}`, badgeSrc(chapter()));
      } else {
        celebrate('כל הכבוד!', `+${pts} נקודות${bonus}`);
      }
    }
    renderTests();
    const next = nextStep();
    showToast('כל הכבוד! עברתם את כל הטסטים');
    if (!next) {
      addBotMessage('וואו! סיימת את כל המשימות ביער הקוד. אני ממש גאה בך — עשית את כל זה בעצמך!');
    } else if (firstTime) {
      addBotMessage(`מעולה! פתרת את "${m.title}" בעצמך. המשימה הבאה, "${next.m.title}", נפתחה — לחצו על הכפתור בלשונית הטסטים.`);
    }
  } else {
    showToast(`עברו ${passed} מתוך ${results.length} טסטים`, true);
  }
  setBusy(false);
}

// משווה פלט צפוי לפלט שהתקבל, ומסביר במילים מה בדיוק שונה
const showChar = (c) => (c === undefined ? 'סוף השורה' : c === ' ' ? 'רווח' : `"${c}"`);

function diffHint(expected, actual) {
  const e = normalize(expected), a = normalize(actual);
  if (!a) return { text: 'התוכנית לא הדפיסה כלום. יש print? והוא לא בתוך תנאי שלא מתקיים?' };
  const el = e.split('\n'), al = a.split('\n');
  let line = 0;
  while (line < Math.max(el.length, al.length) && el[line] === al[line]) line++;
  const exp = el[line], got = al[line];
  let col = 0;
  if (exp !== undefined && got !== undefined) while (col < Math.max(exp.length, got.length) && exp[col] === got[col]) col++;
  const where = { line, col };
  if (e.toLowerCase() === a.toLowerCase()) return { ...where, text: `ההבדל הוא באותיות גדולות וקטנות: בשורה ${line + 1} ציפינו ל-${showChar(exp[col])} וקיבלנו ${showChar(got[col])}.` };
  if (e.replace(/\s+/g, '') === a.replace(/\s+/g, '')) return { ...where, text: `ההבדל הוא ברווחים: בשורה ${line + 1}, בתו מספר ${col + 1}, ציפינו ל-${showChar(exp?.[col])} וקיבלנו ${showChar(got?.[col])}.` };
  if (got === undefined) return { text: `חסרות שורות: ציפינו ל-${el.length} שורות וקיבלנו ${al.length}. השורה הראשונה שחסרה: "${exp}"` };
  if (exp === undefined) return { ...where, col: 0, text: `יש שורות מיותרות: ציפינו ל-${el.length} שורות וקיבלנו ${al.length}. השורה המיותרת הראשונה: "${got}"` };
  return { ...where, text: `ההבדל הראשון בשורה ${line + 1}, בתו מספר ${col + 1}: ציפינו ל-${showChar(exp[col])} וקיבלנו ${showChar(got[col])}.` };
}

// מסמן בפלט שלכם את השורה ואת התו הראשון שבו יש הבדל
function markDiff(text, hint) {
  if (hint.line === undefined) return esc(text);
  return normalize(text).split('\n').map((l, i) => {
    if (i !== hint.line) return esc(l);
    const c = Math.min(hint.col, l.length);
    return `<span class="diff-line">${esc(l.slice(0, c))}<mark>${esc(l[c] ?? ' ')}</mark>${esc(l.slice(c + 1))}</span>`;
  }).join('\n');
}

function renderTests() {
  const m = mission();
  const r = state.lastTests;
  const rules = (r && state.lastRules) || [];
  const allPassed = r && r.every((x) => x.pass) && !rules.length;
  const next = nextStep();
  const nextBtn = allPassed && next
    ? `<div class="next-mission"><span>המשימה הבאה נפתחה!</span><button class="btn check" id="nextMissionBtn">למשימה הבאה: ${esc(next.m.title)}</button></div>`
    : '';
  const solutionBox = state.done[m.id]
    ? `<div class="solution-box"><button class="btn ghost small" id="showSolution" type="button">רוצים לראות דרך נוספת לפתור?</button><div id="solutionArea"></div></div>`
    : '';
  const ruleCards = rules.map((msg) => `<div class="test-card fail"><h3><span>דרישה של המשימה</span><span>לא מתקיים</span></h3><small>${esc(msg)}</small></div>`).join('');
  $('testsList').innerHTML = nextBtn + solutionBox + ruleCards + m.tests.map((t, i) => {
    const res = r && r[i];
    const cls = res ? (res.pass ? 'pass' : 'fail') : '';
    const status = res ? (res.pass ? 'עבר' : 'נכשל') : 'עוד לא נבדק';
    const hint = res && !res.pass && !res.error ? res.hint : null;
    const actualHtml = !res ? '' : res.error ? esc(`${res.actual}${res.error.type}: ${res.error.message}`) : hint ? markDiff(res.actual, hint) : esc(res.actual);
    const why = res && res.error ? explainError(res.error) : hint ? hint.text : '';
    return `<div class="test-card ${cls}">
      <h3><span>טסט ${i + 1}</span><span>${status}</span></h3>
      <small>קלט: ${t.inputs.length ? t.inputs.map(esc).join(' , ') : 'אין'}</small>
      <div class="cols">
        <div><small>פלט צפוי</small><pre>${esc(t.expected)}</pre></div>
        <div><small>הפלט שלך</small><pre>${actualHtml}</pre></div>
      </div>
      ${why ? `<div class="diff-hint"><b>מה שונה?</b> ${esc(why)}</div>` : ''}
    </div>`;
  }).join('') + '<p class="note">שימו לב: בטסטים, הטקסט שבתוך input("...") לא נחשב חלק מהפלט.</p>';
}

async function showSolution() {
  const area = $('solutionArea');
  try {
    if (store.timer) await store.save(); // השרת צריך לדעת שהמשימה נפתרה
    const r = await fetch(`/api/solution?id=${encodeURIComponent(mission().id)}`);
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    $('showSolution').hidden = true;
    area.innerHTML = `<p class="sol-intro">זו רק דרך אחת. אם הקוד שלכם עבר את הטסטים — הוא נכון! השוו ותראו אם למדתם משהו חדש:</p>
      <pre dir="ltr">${esc(data.code)}</pre><p class="sol-note"><b>שימו לב:</b> ${esc(data.note)}</p>`;
  } catch (e) {
    area.textContent = 'לא הצלחנו לטעון את הפתרון.';
  }
}

$('testsList').addEventListener('click', (e) => {
  if (e.target.closest('#showSolution')) return showSolution();
  if (e.target.closest('#nextMissionBtn')) {
    const next = nextStep();
    if (next) goTo(next.ci, next.mi);
  }
});

function setBusy(b) {
  ['runBtn', 'runSampleBtn', 'checkBtn', 'stepBtn'].forEach((id) => ($(id).disabled = b));
}

$('runBtn').onclick = () => runCode();
$('runSampleBtn').onclick = () => runCode(mission().tests[0].inputs);
$('checkBtn').onclick = checkCode;
$('resetBtn').onclick = () => {
  if (!confirm('להחזיר את הקוד ההתחלתי? הקוד הנוכחי יימחק.')) return;
  codeEl.value = STARTER;
  onCodeChanged();
};

// ===== שיעור אינטראקטיבי: דוגמה שאפשר להריץ ושאלת "מה יודפס?" =====
const lessonEditor = CodeMirror.fromTextArea($('lessonCode'), {
  mode: 'python', theme: 'forest', indentUnit: 4, tabSize: 4, indentWithTabs: false,
  matchBrackets: true, direction: 'ltr', viewportMargin: Infinity,
  extraKeys: { Tab: (cm) => cm.replaceSelection('    '), 'Ctrl-Enter': () => runExample() }
});
attachGlossary(lessonEditor); // גם בדוגמאות של השיעור אפשר לראות מה כל מילה עושה

function showLessonOutput(html, label) {
  $('lessonOutputLabel').textContent = label;
  $('lessonOutput').innerHTML = html;
}

function renderLesson() {
  const m = mission();
  const l = LESSONS[m.id];
  $('lessonCrumb').textContent = `שיעור · ${m.concept}`;
  $('lessonTitle').textContent = l.title;
  $('lessonBody').innerHTML = l.body.map((p) => `<p>${md(p)}</p>`).join('');
  lessonEditor.setValue(l.example);
  $('lessonInputRow').hidden = !l.input;
  $('lessonInput').textContent = l.input || '';
  showLessonOutput(esc(l.output), 'מה יוצג על המסך');
  $('lessonTip').innerHTML = `<strong>טיפ:</strong> ${md(l.tip)}`;
  $('lessonTask').textContent = m.description;
  renderQuiz();
}

async function runExample() {
  const l = LESSONS[mission().id];
  if (!pyodide) return showToast('פייתון עוד נטען, עוד רגע...', true);
  $('runExample').disabled = true;
  try {
    const res = await runPython(lessonEditor.getValue(), l.input ? [l.input] : [], true);
    let html = esc(res.output).replace(/\x01([\s\S]*?)\x02/g, '<span class="in">$1</span>');
    if (res.needInput) html += '\n<span class="muted">(הקוד ביקש עוד קלט — במשימה עצמה תוכלו להקליד בעצמכם)</span>';
    if (res.error) {
      html += `<span class="err">${esc(res.error.type)}: ${esc(res.error.message)}</span>`;
      html += `<span class="err-he">${esc(explainError(res.error))}</span>`;
    }
    showLessonOutput(html || '<span class="muted">(הקוד רץ ולא הדפיס כלום)</span>', 'הפלט מההרצה שלכם');
  } catch (e) {
    showToast(e.message, true);
  }
  $('runExample').disabled = false;
}
$('runExample').onclick = runExample;
$('resetExample').onclick = () => {
  const l = LESSONS[mission().id];
  lessonEditor.setValue(l.example);
  showLessonOutput(esc(l.output), 'מה יוצג על המסך');
};

// כפתור "בואו ננסה" נפתח אחרי תשובה נכונה (או אם כבר ראיתם את השיעור)
function renderQuiz() {
  const id = mission().id;
  const q = QUIZZES[id];
  const opened = !!(state.seen[id] || state.done[id]);
  $('quizCode').textContent = q.code;
  $('quizOptions').innerHTML = q.options.map((o, i) =>
    `<button type="button" class="quiz-opt" data-i="${i}"><pre dir="ltr">${esc(o)}</pre></button>`).join('');
  $('quizFeedback').textContent = '';
  $('quizFeedback').className = 'quiz-feedback';
  $('startMission').disabled = !opened;
  $('startMission').title = opened ? '' : 'קודם עונים על השאלה';
}

$('quizOptions').addEventListener('click', (e) => {
  const btn = e.target.closest('.quiz-opt');
  if (!btn || btn.disabled) return;
  const q = QUIZZES[mission().id];
  const right = Number(btn.dataset.i) === q.answer;
  btn.classList.add(right ? 'right' : 'wrong');
  btn.disabled = true;
  const fb = $('quizFeedback');
  if (right) {
    $('quizOptions').querySelectorAll('.quiz-opt').forEach((b) => (b.disabled = true));
    fb.textContent = `נכון! ${q.why}`;
    fb.className = 'quiz-feedback right';
    $('startMission').disabled = false;
    $('startMission').title = '';
  } else {
    fb.textContent = 'לא בדיוק. עברו על הקוד שורה אחרי שורה, כמו המחשב, ונסו שוב.';
    fb.className = 'quiz-feedback wrong';
  }
});

$('startMission').onclick = () => {
  state.seen[mission().id] = true;
  store.set('seen', state.seen);
  switchTab('practice');
  codeEl.focus();
};

function switchTab(name) {
  document.querySelector('.panel').classList.toggle('lesson-mode', name === 'lesson');
  $('lessonView').hidden = name !== 'lesson';
  if (name === 'lesson') requestAnimationFrame(() => lessonEditor.refresh());
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $('practiceView').hidden = name !== 'practice';
  if (name === 'practice') requestAnimationFrame(() => editor.refresh());
  $('testsView').hidden = name !== 'tests';
}
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => switchTab(t.dataset.tab)));

let toastTimer;
function showToast(text, warn = false) {
  const el = $('toast');
  el.textContent = text;
  el.style.background = warn ? 'var(--warn)' : 'var(--ok)';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2800);
}

// ================== העוזר: ינשוף ==================
// ההוראות של ינשוף (לא לגלות תשובות) נמצאות בשרת, ב-server.py

function numberedCode() {
  if (!codeEl.value.trim()) return '(העורך ריק)';
  return codeEl.value.split('\n').map((l, i) => `${String(i + 1).padStart(2)} | ${l}`).join('\n');
}

function missionContext() {
  const m = mission();
  let ctx = `[מידע עבורך — התלמיד לא רואה את זה]
משימה: ${m.title}
תיאור: ${m.description}
דוגמה — קלט: ${m.example.input} | פלט צפוי: ${m.example.output}
מדריך רמזים של המורה (מהעדין לממוקד): ${m.hints.map((h, i) => `\n  רמז ${i + 1}: ${h}`).join('')}
כמה פעמים התלמיד כבר ביקש עזרה במשימה הזו: ${getChat().filter((x) => x.role === 'user').length - 1}

הקוד הנוכחי של התלמיד, כפי שהוא מופיע עכשיו בעורך (מספר שורה | קוד):
${numberedCode()}`;
  if (state.problem) {
    const p = state.problem;
    const kind = p.source === 'syntax' ? 'בעיית תחביר שזוהתה בזמן ההקלדה (הקוד עוד לא הורץ)' : 'שגיאה בהרצה';
    ctx += `\n\nבעיה מסומנת בעורך — ${kind}: ${p.type}: ${p.message}${p.line ? ` (שורה ${p.line}: \`${(codeEl.value.split('\n')[p.line - 1] || '').trim()}\`)` : ''}`;
  } else {
    ctx += '\n\nאין כרגע בעיית תחביר בקוד.';
  }
  if (state.lastRun) {
    ctx += `\n\nהרצה אחרונה — פלט:\n${state.lastRun.output || '(ריק)'}`;
    if (state.lastRun.error) ctx += `\nשגיאה: ${state.lastRun.error.type}: ${state.lastRun.error.message} (שורה ${state.lastRun.error.line ?? '?'})`;
  }
  if (state.lastRun?.vars?.length) {
    ctx += `\nמשתנים בסוף ההרצה: ${state.lastRun.vars.map(([n, t, v]) => `${n} = ${v} (${t})`).join(', ')}`;
  }
  if (state.lastRules?.length) {
    ctx += `\n\nדרישות של המשימה שהקוד לא עומד בהן: ${state.lastRules.join(' ; ')}`;
  }
  if (state.lastTests) {
    const failed = state.lastTests.filter((t) => !t.pass);
    ctx += `\n\nבדיקה אחרונה: עברו ${state.lastTests.length - failed.length}/${state.lastTests.length} טסטים.`;
    failed.slice(0, 2).forEach((t) => {
      ctx += `\nטסט שנכשל — קלט: ${t.inputs.join(', ') || 'אין'} | צפוי: ${JSON.stringify(t.expected)} | התקבל: ${JSON.stringify(t.actual)}${t.error ? ` | שגיאה: ${t.error.type}: ${t.error.message}` : ''}${t.hint ? ` | ההבדל: ${t.hint.text}` : ''}`;
    });
  }
  return ctx;
}

// השיחה עם ינשוף נשמרת בחשבון (12 ההודעות האחרונות בכל משימה)
const CHAT_KEEP = 12;
function saveChats() {
  for (const id of Object.keys(state.chats)) state.chats[id] = state.chats[id].slice(-CHAT_KEEP);
  store.set('chats', state.chats);
}

function getChat() {
  const id = mission().id;
  if (!state.chats[id]) state.chats[id] = [];
  return state.chats[id];
}

// רנדור בסיסי של markdown: קוד, קוד מוטבע, הדגשה, שורות
function md(text) {
  const blocks = [];
  let s = text.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) => {
    blocks.push(`<pre><code>${esc(code.trim())}</code></pre>`);
    return `\u0000${blocks.length - 1}\u0000`;
  });
  s = esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/שורה (\d+)/g, '<span class="line-link" data-line="$1">שורה $1</span>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[i]);
}

function renderChat() {
  const chat = $('chat');
  chat.innerHTML = '';
  const msgs = getChat();
  if (!msgs.length) {
    const name = state.user?.name ? ` ${state.user.name}` : '';
    appendMsg('bot', `היי${name}! אני ינשוף. אני לא אגלה לך את התשובה — אבל אעזור לך להגיע אליה בעצמך. נתקעת? שאל אותי, או לחץ על "רמז".`);
  }
  msgs.forEach((m) => appendMsg(m.role === 'user' ? 'user' : 'bot', m.display ?? m.content));
}

function appendMsg(who, text) {
  const div = document.createElement('div');
  div.className = 'msg ' + who;
  div.innerHTML = md(text);
  if (who === 'bot') {
    // הודעות של ינשוף מופיעות עם הינשוף בצד, כאילו הוא אומר אותן
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML = '<img class="msg-avatar" src="images/owl.png" alt="ינשוף" />';
    row.appendChild(div);
    $('chat').appendChild(row);
  } else {
    $('chat').appendChild(div);
  }
  $('chat').scrollTop = $('chat').scrollHeight;
  return div;
}

// sig = החתימה מהשרת. בלעדיה השרת מתעלם מההודעה (הגנה מזיוף היסטוריה)
function addBotMessage(text, sig) {
  getChat().push(sig ? { role: 'assistant', content: text, sig } : { role: 'assistant', content: text });
  saveChats();
  appendMsg('bot', text);
}

async function askTutor(question) {
  if (!state.helped[mission().id] && !state.done[mission().id]) {
    state.helped[mission().id] = true; // בונוס "בלי עזרה" כבר לא יינתן במשימה הזו
    store.set('helped', state.helped);
  }
  const msgs = getChat();
  msgs.push({ role: 'user', content: question });
  saveChats();
  appendMsg('user', question);

  const typing = appendMsg('bot', 'חושב');
  typing.classList.add('typing');
  typing.parentElement.classList.add('typing');
  typing.textContent = 'ינשוף כותב';

  // ההקשר (קוד, שגיאות) מצורף רק להודעה האחרונה, כדי שהמודל תמיד יראה את המצב העדכני
  const apiMessages = msgs.slice(-8).map((m, i, arr) => ({
    role: m.role,
    sig: m.sig,
    content: i === arr.length - 1
      ? `${missionContext()}\n\n[זו בקשת עזרה מספר ${msgs.filter((x) => x.role === 'user').length} במשימה הזו — תן רמז ברמה הזו, חדש וממוקד יותר מהקודמים]\n\n[התלמיד כותב:]\n${m.content}`
      : m.content
  }));
  while (apiMessages.length && apiMessages[0].role !== 'user') apiMessages.shift();

  try {
    // השרת (server.py) מחזיק את מפתח ה-API ומעביר את השאלה ל-NVIDIA
    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: apiMessages })
    });
    const data = await resp.json();
    typing.closest('.msg-row').remove();
    if (resp.status === 401) return location.replace('/login.html'); // החיבור פג
    if (!resp.ok) throw new Error(data?.error || resp.statusText);
    if (data.text) addBotMessage(data.text, data.sig);
    else addBotMessage('הממ… לא הצלחתי לחשוב על תשובה. נסה לנסח שוב?');
  } catch (e) {
    typing.closest('.msg-row').remove();
    appendMsg('bot', `לא הצלחתי להתחבר ל-AI (${esc(e.message)}). בינתיים, הנה רמז מוכן:`);
    addBotMessage(offlineReply(question));
  }
}

// מצב לא מקוון: רמזים מדורגים + הסבר שגיאות
function offlineReply(question) {
  const m = mission();
  const err = state.problem || state.lastRun?.error || state.lastTests?.find((t) => t.error)?.error;
  if (err && /שגיאה|בעיה|error|טעות/i.test(question)) {
    return `${explainError(err)}${err.line ? `\n\nכדאי להסתכל על **שורה ${err.line}**.` : ''} מה לדעתך צריך לשנות שם?`;
  }
  const failed = state.lastTests?.find((t) => !t.pass && !t.error);
  if (failed && /טסט|נכשל/.test(question)) {
    return `השווה בזהירות בין "פלט צפוי" ל"הפלט שלך" בלשונית הטסטים. שים לב לאותיות גדולות/קטנות, רווחים וסימני פיסוק. איפה הם שונים?`;
  }
  const lvl = state.hintLevel[m.id] ?? 0;
  state.hintLevel[m.id] = Math.min(lvl + 1, m.hints.length - 1);
  const prefix = lvl >= m.hints.length - 1 && lvl > 0 ? 'זה הרמז האחרון שיש לי — אתה כבר ממש קרוב! ' : '';
  return prefix + m.hints[lvl];
}

$('chat').addEventListener('click', (e) => {
  const link = e.target.closest('.line-link');
  if (link) jumpToLine(Number(link.dataset.line));
});

$('chatForm').onsubmit = (e) => {
  e.preventDefault();
  const q = $('chatInput').value.trim();
  if (!q) return;
  $('chatInput').value = '';
  askTutor(q);
};
$('chatInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('chatForm').requestSubmit(); }
});
document.querySelectorAll('.quick button').forEach((b) => (b.onclick = () => askTutor(b.dataset.q)));
$('hintBtn').onclick = () => askTutor('אפשר רמז קטן? (בלי לגלות את התשובה)');

// ================== משתמש (Google) ==================
function showUser() {
  const { name, picture } = state.user;
  $('userName').textContent = name || 'סייר/ת';
  $('userInitial').textContent = (name || 'ס').trim()[0];
  if (picture) {
    const img = $('userAvatar');
    img.onload = () => { img.hidden = false; $('userInitial').hidden = true; };
    img.src = picture;
  }
  $('teacherLink').hidden = state.user.role !== 'teacher';
  $('classBtn').title = state.user.className ? `הכיתה שלי: ${state.user.className}` : 'הצטרפות לכיתה';
}

// ===== כיתה: הצטרפות עם קוד מהמורה =====
async function postJSON(path, body = {}) {
  const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'משהו השתבש');
  return data;
}

function renderClassDialog(msg = '', error = false) {
  const name = state.user.className;
  $('classStatus').textContent = name ? `את/ה בכיתה: ${name}` : 'עוד לא הצטרפת לכיתה. קבלו קוד מהמורה והקלידו אותו כאן.';
  $('leaveBtn').hidden = !name;
  $('classMsg').textContent = msg;
  $('classMsg').classList.toggle('error', error);
}

$('classBtn').onclick = () => {
  $('joinCode').value = '';
  renderClassDialog();
  $('classDialog').showModal();
};
$('joinBtn').onclick = async () => {
  try {
    const { className } = await postJSON('/api/class/join', { code: $('joinCode').value });
    state.user.className = className;
    showUser();
    renderClassDialog(`הצטרפת לכיתה "${className}"! המורה יכול/ה לראות את ההתקדמות שלך.`);
  } catch (e) {
    renderClassDialog(e.message, true);
  }
};
$('leaveBtn').onclick = async () => {
  if (!confirm('לצאת מהכיתה?')) return;
  try {
    await postJSON('/api/class/leave');
    state.user.className = '';
    showUser();
    renderClassDialog('יצאת מהכיתה.');
  } catch (e) {
    renderClassDialog(e.message, true);
  }
};
$('upgradeBtn').onclick = async () => {
  try {
    await postJSON('/api/upgrade', { teacherCode: $('upgradeCode').value });
    location.href = '/teacher.html';
  } catch (e) {
    renderClassDialog(e.message, true);
  }
};

$('recoveryBtn').onclick = () => {
  $('recoveryCode').textContent = '—';
  $('recoveryDialog').showModal();
};
$('makeRecovery').onclick = async () => {
  if (!confirm('ליצור קוד שחזור חדש? הקוד הקודם יפסיק לעבוד.')) return;
  const r = await fetch('/api/recovery', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const data = await r.json().catch(() => ({}));
  $('recoveryCode').textContent = r.ok ? data.recovery : (data.error || 'משהו השתבש');
};

$('logoutBtn').onclick = async () => {
  try {
    if (store.timer) await store.save(); // לא מאבדים את השינוי האחרון
    await fetch('/api/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  } finally {
    location.replace('/login.html');
  }
};

// ================== התחלה ==================
(async () => {
  try {
    const r = await fetch('/api/me');
    if (!r.ok) return location.replace('/login.html');
    state.user = await r.json();
    await loadProgress();
  } catch {
    return location.replace('/login.html');
  }
  if (state.chapterIdx >= CHAPTERS.length) state.chapterIdx = 0;
  if (state.missionIdx >= chapter().missions.length) state.missionIdx = 0;
  if (!isUnlocked(state.chapterIdx, state.missionIdx)) {
    ({ ci: state.chapterIdx, mi: state.missionIdx } = currentStep());
  }
  showUser();
  renderRewards();
  renderChapters();
  renderMissions();
  renderTask();
  initPython();
  if (!state.flags.tour) setTimeout(startTour, 600);
})();

// ================== סיור היכרות ==================
const TOUR = [
  { el: '.sidebar', title: 'המסלול שלכם', text: 'כאן כל המשימות לפי אזורים ביער. כל משימה נפתחת אחרי שפותרים את הקודמת, וכל אזור שמסיימים נותן תג.' },
  { el: '#lessonView', tab: 'lesson', title: 'קודם לומדים', text: 'כל משימה מתחילה בשיעור קצר: הסבר, דוגמה שאפשר להריץ ולשנות, ושאלה קטנה "מה יודפס?".' },
  { el: '.editor', tab: 'practice', title: 'כאן כותבים קוד', text: 'העורך צובע את הקוד ומציע השלמות. Ctrl+Enter מריץ, ובעיות מסומנות באדום כבר בזמן ההקלדה.' },
  { el: '.toolbar', tab: 'practice', title: 'הרצה ובדיקה', text: '"הרצה" מראה מה הקוד עושה ואת המשתנים. "בדיקה" מריצה טסטים ומסבירה בדיוק מה שונה אם משהו לא עובר.' },
  { el: '.tutor', title: 'ינשוף כאן בשבילכם', text: 'נתקעתם? שאלו אותי. אני לא אגלה את התשובה — אבל אעזור לכם להבין לבד. פתרון בלי עזרה שווה 5 נקודות בונוס!' }
];
let tourStep = -1;

function startTour() {
  tourStep = -1;
  $('tour').hidden = false;
  nextTourStep();
}

function endTour() {
  document.querySelector('.tour-target')?.classList.remove('tour-target');
  $('tour').hidden = true;
  state.flags.tour = true;
  store.set('flags', state.flags);
  switchTab(state.seen[mission().id] || state.done[mission().id] ? 'practice' : 'lesson');
}

function nextTourStep() {
  document.querySelector('.tour-target')?.classList.remove('tour-target');
  tourStep++;
  if (tourStep >= TOUR.length) return endTour();
  const step = TOUR[tourStep];
  if (step.tab) switchTab(step.tab);
  const target = document.querySelector(step.el);
  target.scrollIntoView({ block: 'nearest' });
  target.classList.add('tour-target');
  $('tourTitle').textContent = step.title;
  $('tourText').textContent = step.text;
  $('tourCount').textContent = `${tourStep + 1} / ${TOUR.length}`;
  $('tourNext').textContent = tourStep === TOUR.length - 1 ? 'בואו נתחיל!' : 'הבא';
  requestAnimationFrame(() => placeTourBubble(target));
}

// הבועה ליד האזור המודגש: מתחת, מעל, או בצד — איפה שיש מקום
function placeTourBubble(target) {
  const r = target.getBoundingClientRect();
  const bubble = $('tourBubble');
  const bw = bubble.offsetWidth, bh = bubble.offsetHeight, pad = 14;
  let top, left;
  if (r.bottom + bh + pad < innerHeight) top = r.bottom + pad;
  else if (r.top - bh - pad > 0) top = r.top - bh - pad;
  else top = Math.max(pad, Math.min(innerHeight - bh - pad, r.top + r.height / 2 - bh / 2));
  if (top === r.bottom + pad || top === r.top - bh - pad) left = r.left + r.width / 2 - bw / 2;
  else left = r.left - bw - pad > 0 ? r.left - bw - pad : r.right + pad;
  bubble.style.top = `${Math.max(pad, top)}px`;
  bubble.style.left = `${Math.max(pad, Math.min(innerWidth - bw - pad, left))}px`;
}

$('tourNext').onclick = nextTourStep;
$('tourSkip').onclick = endTour;
$('helpBtn').onclick = startTour;
addEventListener('resize', () => {
  const t = document.querySelector('.tour-target');
  if (t && !$('tour').hidden) placeTourBubble(t);
});
