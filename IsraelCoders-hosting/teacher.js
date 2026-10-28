// לוח המורה: כיתות, קודי הצטרפות וההתקדמות של כל תלמיד.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// אותו מסלול ואותו חישוב נקודות כמו באפליקציה
const PATH = CHAPTERS.flatMap((c) => c.missions.map((m) => ({ m, chapter: c })));
const POINTS_PER_MISSION = 10;
const NO_HELP_BONUS = 5;
const DAY = 864e5;

const view = { classes: [], selected: null, tab: 'students', student: null };

async function api(path, body) {
  const opts = body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
  const r = await fetch(path, opts);
  if (r.status === 401) return location.replace('/login.html');
  if (r.status === 403 && body === undefined) return location.replace('/');
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'משהו השתבש');
  return data;
}

let toastTimer;
function toast(text, warn = false) {
  const el = $('toast');
  el.textContent = text;
  el.style.background = warn ? 'var(--warn)' : 'var(--ok)';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// ===== חישובים לכל תלמיד =====
function lastActive(ts) {
  if (!ts) return { text: 'עוד לא התחיל/ה', days: Infinity };
  const days = Math.floor((startOfDay(Date.now()) - startOfDay(ts * 1000)) / DAY);
  const text = days <= 0 ? 'היום' : days === 1 ? 'אתמול' : `לפני ${days} ימים`;
  return { text, days };
}
function startOfDay(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function studentStats(s) {
  const doneCount = PATH.filter((p) => s.done[p.m.id]).length;
  const points = PATH.reduce((sum, p) => sum + (s.done[p.m.id] ? POINTS_PER_MISSION + (s.helped[p.m.id] ? 0 : NO_HELP_BONUS) : 0), 0);
  const current = PATH.find((p) => !s.done[p.m.id]);
  const active = lastActive(s.updated);
  let status;
  if (!current) status = { key: 'finished', label: 'סיים/ה הכל' };
  else if (current && s.helped[current.m.id]) status = { key: 'help', label: 'ביקש/ה עזרה' };
  else if (active.days >= 3) status = { key: 'idle', label: 'לא פעיל/ה' };
  else status = { key: 'ok', label: 'בדרך' };
  return {
    doneCount, points, current, active, status,
    helpedCount: Object.keys(s.helped).length
  };
}

function cellState(s, id) {
  if (s.done[id]) return s.helped[id] ? 'done-help' : 'done';
  if (s.helped[id]) return 'stuck';
  if (s.seen[id] || (s.codes[id] && !s.codes[id].startsWith('# כתבו כאן') )) return 'started';
  return 'none';
}

// ===== תצוגה =====
function selectedClass() {
  return view.classes.find((c) => c.id === view.selected);
}

function renderSide() {
  $('classList').innerHTML = view.classes.map((c) => `
    <li class="t-class${c.id === view.selected ? ' active' : ''}" data-id="${c.id}">
      <span>${esc(c.name)}</span><small>${c.students.length} תלמידים</small>
    </li>`).join('');
}

function render() {
  renderSide();
  const c = selectedClass();
  $('emptyState').hidden = !!c;
  $('classView').hidden = !c;
  if (!c) return;
  $('classTitle').textContent = c.name;
  $('joinCode').textContent = c.code;

  const rows = c.students.map((s) => ({ s, st: studentStats(s) }));
  const n = rows.length;
  const avg = n ? (rows.reduce((a, r) => a + r.st.doneCount, 0) / n).toFixed(1) : 0;
  const today = rows.filter((r) => r.st.active.days === 0).length;
  const needHelp = rows.filter((r) => r.st.status.key === 'help').length;
  $('stats').innerHTML = [
    ['תלמידים', n, ''],
    ['ממוצע משימות שנפתרו', `${avg} / ${PATH.length}`, ''],
    ['עבדו היום', today, ''],
    ['ביקשו עזרה במשימה הנוכחית', needHelp, needHelp ? 'warn' : '']
  ].map(([label, value, cls]) => `<div class="t-stat ${cls}"><strong>${value}</strong><span>${label}</span></div>`).join('');

  document.querySelectorAll('.t-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === view.tab));
  $('studentsView').hidden = view.tab !== 'students';
  $('mapView').hidden = view.tab !== 'map';

  if (!n) {
    const empty = `<div class="t-none">עוד אין תלמידים בכיתה. שתפו את הקוד <strong dir="ltr">${esc(c.code)}</strong> עם התלמידים.</div>`;
    $('studentsView').innerHTML = empty;
    $('mapView').innerHTML = empty;
    return;
  }

  // תלמידים שביקשו עזרה מופיעים ראשונים
  const order = { help: 0, idle: 1, ok: 2, finished: 3 };
  rows.sort((a, b) => order[a.st.status.key] - order[b.st.status.key] || a.s.first.localeCompare(b.s.first, 'he'));

  $('studentsView').innerHTML = `
    <div class="t-table-wrap"><table class="t-table">
      <thead><tr><th>תלמיד/ה</th><th>התקדמות</th><th>נקודות</th><th>משימה נוכחית</th><th>בקשות עזרה</th><th>פעילות אחרונה</th><th>מצב</th></tr></thead>
      <tbody>${rows.map(({ s, st }) => `
        <tr data-id="${s.id}">
          <td class="t-name">${esc(s.first)} ${esc(s.last)}</td>
          <td><div class="t-progress"><div data-pct="${Math.round((st.doneCount / PATH.length) * 100)}"></div></div><small>${st.doneCount} / ${PATH.length}</small></td>
          <td>${st.points}</td>
          <td>${st.current ? esc(st.current.m.title) : '—'}</td>
          <td>${st.helpedCount}</td>
          <td>${st.active.text}</td>
          <td><span class="t-status ${st.status.key}">${st.status.label}</span></td>
        </tr>`).join('')}
      </tbody>
    </table></div>`;
  // רוחב פס ההתקדמות נקבע דרך JavaScript (מדיניות האבטחה חוסמת style בתוך HTML)
  $('studentsView').querySelectorAll('[data-pct]').forEach((el) => (el.style.width = `${el.dataset.pct}%`));

  const head =PATH.map((p, i) => `<th title="${esc(p.chapter.title)} — ${esc(p.m.title)}">${i + 1}</th>`).join('');
  $('mapView').innerHTML = `
    <div class="t-map-wrap"><table class="t-map">
      <thead><tr><th class="t-name">תלמיד/ה</th>${head}</tr></thead>
      <tbody>${rows.map(({ s }) => `
        <tr data-id="${s.id}"><td class="t-name">${esc(s.first)} ${esc(s.last)}</td>${PATH.map((p) =>
          `<td><span class="cell ${cellState(s, p.m.id)}" title="${esc(p.m.title)}"></span></td>`).join('')}</tr>`).join('')}
      </tbody>
    </table></div>
    <div class="t-legend">
      <span><i class="cell done"></i> נפתרה</span>
      <span><i class="cell done-help"></i> נפתרה עם עזרה</span>
      <span><i class="cell stuck"></i> ביקש/ה עזרה, עוד לא פתר/ה</span>
      <span><i class="cell started"></i> התחיל/ה</span>
      <span><i class="cell none"></i> עוד לא</span>
    </div>`;
}

// ===== פרטי תלמיד =====
const STATUS_TEXT = { done: 'נפתרה', 'done-help': 'נפתרה עם עזרה', stuck: 'ביקש/ה עזרה', started: 'התחיל/ה', none: 'עוד לא' };

function openStudent(id) {
  const s = selectedClass().students.find((x) => x.id === id);
  if (!s) return;
  view.student = s;
  const st = studentStats(s);
  $('sdName').textContent = `${s.first} ${s.last}`;
  $('sdSummary').textContent = `${st.doneCount} מתוך ${PATH.length} משימות · ${st.points} נקודות · פעילות אחרונה: ${st.active.text}`;
  $('sdMissions').innerHTML = CHAPTERS.map((c) => `
    <div class="t-area">
      <div class="t-area-title">${c.id} | ${esc(c.title)}</div>
      ${c.missions.map((m) => {
        const state = cellState(s, m.id);
        const hasCode = !!s.codes[m.id];
        return `<button type="button" class="t-mission" data-mission="${m.id}" ${hasCode ? '' : 'disabled'}>
          <span class="cell ${state}"></span><span>${esc(m.title)}</span><small>${STATUS_TEXT[state]}${hasCode ? ' · הצגת קוד' : ''}</small>
        </button>`;
      }).join('')}
    </div>`).join('');
  $('sdCodeBox').hidden = true;
  $('studentDialog').showModal();
}

$('sdMissions').addEventListener('click', (e) => {
  const btn = e.target.closest('.t-mission');
  if (!btn || btn.disabled) return;
  const m = PATH.find((p) => p.m.id === btn.dataset.mission).m;
  $('sdCodeTitle').textContent = `הקוד של ${view.student.first} במשימה "${m.title}"`;
  $('sdCode').textContent = view.student.codes[m.id];
  $('sdCodeBox').hidden = false;
});
$('sdClose').onclick = () => $('studentDialog').close();
$('sdRemove').onclick = async () => {
  const s = view.student;
  if (!confirm(`להוציא את ${s.first} ${s.last} מהכיתה? ההתקדמות שלו/ה לא תימחק.`)) return;
  try {
    await api('/api/class/remove', { classId: view.selected, studentId: s.id });
    $('studentDialog').close();
    toast('התלמיד/ה הוצא/ה מהכיתה');
    await load();
  } catch (e) { toast(e.message, true); }
};

// ===== פעולות =====
$('classList').addEventListener('click', (e) => {
  const li = e.target.closest('.t-class');
  if (!li) return;
  view.selected = li.dataset.id;
  location.hash = view.selected;
  render();
});
document.querySelectorAll('.t-tabs .tab').forEach((t) => (t.onclick = () => { view.tab = t.dataset.view; render(); }));
$('studentsView').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openStudent(tr.dataset.id); });
$('mapView').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) openStudent(tr.dataset.id); });

$('newClassForm').onsubmit = async (e) => {
  e.preventDefault();
  const name = $('newClassName').value.trim();
  if (!name) return;
  try {
    const { id } = await api('/api/class/create', { name });
    $('newClassName').value = '';
    $('sideMsg').textContent = '';
    view.selected = id;
    location.hash = id;
    await load();
    toast('הכיתה נוצרה! שתפו את הקוד עם התלמידים.');
  } catch (err) {
    $('sideMsg').textContent = err.message;
  }
};
$('copyCode').onclick = async () => {
  try { await navigator.clipboard.writeText($('joinCode').textContent); toast('הקוד הועתק'); } catch { toast('לא הצלחנו להעתיק', true); }
};
$('newCodeBtn').onclick = async () => {
  if (!confirm('ליצור קוד הצטרפות חדש? הקוד הישן יפסיק לעבוד (תלמידים שכבר בכיתה נשארים).')) return;
  try { await api('/api/class/newcode', { classId: view.selected }); await load(); toast('נוצר קוד חדש'); } catch (e) { toast(e.message, true); }
};
$('deleteClass').onclick = async () => {
  const c = selectedClass();
  if (!confirm(`למחוק את הכיתה "${c.name}"? התלמידים יצאו ממנה, אבל ההתקדמות שלהם תישמר.`)) return;
  try { await api('/api/class/delete', { classId: c.id }); view.selected = null; await load(); toast('הכיתה נמחקה'); } catch (e) { toast(e.message, true); }
};
$('refreshBtn').onclick = () => load().then(() => toast('עודכן'));
$('logoutBtn').onclick = async () => {
  try { await api('/api/logout', {}); } finally { location.replace('/login.html'); }
};

async function load() {
  const data = await api('/api/teacher/classes');
  if (!data) return;
  view.classes = data.classes;
  if (!view.classes.some((c) => c.id === view.selected)) view.selected = view.classes[0]?.id || null;
  render();
  if (view.student && $('studentDialog').open) openStudent(view.student.id);
}

(async () => {
  const me = await api('/api/me');
  if (!me) return;
  if (me.role !== 'teacher') return location.replace('/');
  $('userName').textContent = me.name;
  $('userInitial').textContent = (me.name || 'מ').trim()[0];
  view.selected = location.hash.slice(1) || null;
  await load();
  setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 30000); // מתעדכן לבד כל חצי דקה
})();
