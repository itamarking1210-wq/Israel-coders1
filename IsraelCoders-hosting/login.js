// דף הכניסה: כניסה או הרשמה עם שם פרטי, שם משפחה וסיסמה.
const $ = (id) => document.getElementById(id);
let mode = 'login';

function setStatus(text, error = false) {
  $('status').textContent = text;
  $('status').classList.toggle('error', error);
}

const LABELS = { login: 'כניסה ליער', register: 'יצירת חשבון', reset: 'איפוס סיסמה' };

function setMode(next) {
  mode = next;
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.mode === mode;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on);
  });
  $('confirmRow').hidden = mode === 'login';
  $('recoveryRow').hidden = mode !== 'reset';
  $('forgotBtn').hidden = mode !== 'login';
  $('teacherRow').hidden = mode !== 'register';
  $('teacherCodeRow').hidden = mode !== 'register' || !$('isTeacher').checked;
  $('password').previousSibling.textContent = mode === 'reset' ? 'סיסמה חדשה' : 'סיסמה';
  $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  $('submitBtn').textContent = LABELS[mode];
  setStatus('');
}

$('forgotBtn').onclick = () => setMode('reset');

// אחרי הרשמה או איפוס: מציגים את קוד השחזור פעם אחת, ורק אז נכנסים
function showRecovery(code) {
  $('authForm').hidden = true;
  document.querySelector('.tabs').hidden = true;
  $('codeValue').textContent = code;
  $('codeBox').hidden = false;
}
$('copyCode').onclick = async () => {
  try { await navigator.clipboard.writeText($('codeValue').textContent); $('copyCode').textContent = 'הועתק!'; } catch {}
};
// מורים מגיעים ללוח המורה, תלמידים לאפליקציה
let nextUrl = '/';
$('continueBtn').onclick = () => location.replace(nextUrl);
$('isTeacher').onchange = () => ($('teacherCodeRow').hidden = !$('isTeacher').checked);

document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => setMode(t.dataset.mode)));

$('authForm').onsubmit = async (e) => {
  e.preventDefault();
  const first = $('first').value.trim();
  const last = $('last').value.trim();
  const password = $('password').value;
  if (!first || !last) return setStatus('צריך למלא שם פרטי ושם משפחה.', true);
  if (password.length < 6) return setStatus('הסיסמה צריכה להיות לפחות 6 תווים.', true);
  if (mode !== 'login' && password !== $('confirm').value) return setStatus('הסיסמאות לא זהות.', true);
  const recovery = $('recovery').value.trim();
  if (mode === 'reset' && !recovery) return setStatus('צריך להקליד את קוד השחזור.', true);
  const teacher = mode === 'register' && $('isTeacher').checked;
  const teacherCode = $('teacherCode').value.trim();
  if (teacher && !teacherCode) return setStatus('צריך להקליד את קוד המורים.', true);

  $('submitBtn').disabled = true;
  setStatus({ login: 'נכנסים…', register: 'יוצרים חשבון…', reset: 'מאפסים…' }[mode]);
  try {
    const r = await fetch(`/api/${mode}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ first, last, password, recovery, teacher, teacherCode })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'משהו השתבש');
    nextUrl = data.role === 'teacher' ? '/teacher.html' : '/';
    if (data.recovery) return showRecovery(data.recovery);
    location.replace(nextUrl);
  } catch (err) {
    setStatus(err.message || 'אין חיבור לשרת.', true);
    $('submitBtn').disabled = false;
  }
};
