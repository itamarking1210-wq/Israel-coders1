// ===== הסבר צעד אחר צעד =====
// מריץ קוד שורה אחרי שורה, ובכל צעד מראה: איזו שורה רצה, מה היא עשתה (בעברית),
// מה השתנה במשתנים, ומה הודפס עד עכשיו.

const MAX_TRACE_STEPS = 400;

// מריץ את הקוד ב-Pyodide עם "מעקב" על כל שורה. מחזיר רשימת אירועים.
const TRACER = `
import sys, io, builtins, json
__tbuf = io.StringIO()
__events = []
__tq = list(__inputs)
__TFN = '<trace>'
__tns = {'__name__': '__main__'}

def __tinput(prompt=''):
    __tbuf.write(str(prompt))
    if not __tq:
        raise EOFError('need input')
    v = str(__tq.pop(0))
    __tbuf.write(v + '\\n')
    return v

def __snap(d):
    out = {}
    for k, v in list(d.items()):
        if k.startswith('__'):
            continue
        if callable(v) and not isinstance(v, type):
            out[k] = ['function', 'פונקציה']
        elif v is None or isinstance(v, (bool, int, float, str, list, dict, tuple)):
            r = repr(v)
            out[k] = [type(v).__name__, r if len(r) <= 50 else r[:47] + '...']
    return out

def __tr(frame, event, arg):
    if frame.f_code.co_filename != __TFN:
        return None
    if event in ('line', 'return'):
        if len(__events) >= ${MAX_TRACE_STEPS}:
            raise TimeoutError('too many steps')
        fn = frame.f_code.co_name
        local = __snap(frame.f_locals) if fn != '<module>' else {}
        ret = repr(arg)[:50] if event == 'return' and fn != '<module>' else ''
        __events.append([event, frame.f_lineno, fn, __snap(__tns), local, __tbuf.getvalue(), ret])
    return __tr

__old_out, __old_in = sys.stdout, builtins.input
__terr = None
sys.stdout = __tbuf
builtins.input = __tinput
sys.settrace(__tr)
try:
    exec(compile(__trace_code, __TFN, 'exec'), __tns)
except BaseException as e:
    __terr = [type(e).__name__, str(e)]
finally:
    sys.settrace(None)
    sys.stdout = __old_out
    builtins.input = __old_in
__events.append(['end', 0, '<module>', __snap(__tns), {}, __tbuf.getvalue(), ''])
json.dumps({'events': __events, 'error': __terr})
`;

async function traceCode(code, inputs) {
  pyodide.globals.set('__trace_code', code);
  pyodide.globals.set('__inputs', pyodide.toPy(inputs || []));
  return JSON.parse(await pyodide.runPythonAsync(TRACER));
}

// ---------- ניסוח בעברית: מה עשתה השורה ----------
const TYPE_WORD = { str: 'טקסט', int: 'מספר שלם', float: 'מספר עשרוני', bool: 'אמת/שקר', list: 'רשימה', dict: 'מילון', NoneType: 'כלום' };
const indentOf = (line) => line.match(/^\s*/)[0].length;
const shortExpr = (s) => (s.length > 40 ? s.slice(0, 37) + '…' : s);

function narrate(src, ctx) {
  const t = src.trim();
  const { before, after, entered, outDelta, typed } = ctx;
  const val = (name) => after[name]?.[1];
  const typeOf = (name) => TYPE_WORD[after[name]?.[0]];
  let m;

  if ((m = t.match(/^def\s+(\w+)/))) return `מגדירים פונקציה בשם ${m[1]}. הקוד שבתוכה עוד לא רץ — הוא ירוץ רק כשיקראו לה.`;
  if ((m = t.match(/^(if|elif)\s+(.+):$/))) return `בודקים את התנאי ${shortExpr(m[2])} — ` + (entered ? 'הוא נכון, אז נכנסים לשורות שבתוכו.' : 'הוא לא נכון, אז מדלגים עליו.');
  if (/^else\s*:/.test(t)) return 'אף תנאי קודם לא התקיים, אז נכנסים ל-else.';
  if ((m = t.match(/^while\s+(.+):$/))) return `בודקים את תנאי הלולאה ${shortExpr(m[1])} — ` + (entered ? 'הוא נכון, אז מריצים עוד סיבוב.' : 'הוא כבר לא נכון, אז הלולאה נגמרת.');
  if ((m = t.match(/^for\s+(\w+)\s+in\s+(.+):$/))) {
    return entered ? `סיבוב חדש בלולאה: ${m[1]} מקבל את הערך ${val(m[1])}.` : `אין יותר ערכים ב-${shortExpr(m[2])} — הלולאה נגמרת.`;
  }
  if ((m = t.match(/^return\s+(.+)$/))) return `מחזירים את ${shortExpr(m[1])} למי שקרא לפונקציה.`;
  if (/^(break)$/.test(t)) return 'break: יוצאים מהלולאה מיד.';
  if (/^(continue)$/.test(t)) return 'continue: מדלגים לסיבוב הבא של הלולאה.';

  // שמירה במשתנה: x = ..., x += ...
  if ((m = t.match(/^([A-Za-z_]\w*)\s*([+\-*/%]?=)\s*(.+)$/)) && !/^[^=]*==/.test(t)) {
    const [, name, op, expr] = m;
    if (/input\(/.test(expr)) {
      const conv = /\bint\(/.test(expr) ? ', הופכים אותו למספר שלם' : /\bfloat\(/.test(expr) ? ', הופכים אותו למספר עשרוני' : ' — שימו לב, זה נשמר כטקסט';
      return `המשתמש מקליד ${typed ? `"${typed}"` : 'משהו'}${conv}, ושומרים במשתנה ${name}. עכשיו ${name} = ${val(name)}.`;
    }
    if (op !== '=') return `מעדכנים את ${name} (${op}): עכשיו ${name} = ${val(name)}.`;
    if (new RegExp(`\\b${name}\\b`).test(expr)) return `מחשבים ${shortExpr(expr)} עם הערך הקודם של ${name}, ושומרים בחזרה: עכשיו ${name} = ${val(name)}.`;
    const kind = typeOf(name) ? ` (${typeOf(name)})` : '';
    return (before[name] ? `משנים את המשתנה ${name}` : `יוצרים משתנה חדש בשם ${name}`) + `: ${name} = ${val(name)}${kind}.`;
  }
  if ((m = t.match(/^([A-Za-z_]\w*)\.append\((.*)\)$/))) return `מוסיפים ${shortExpr(m[2])} לסוף הרשימה ${m[1]}. עכשיו ${m[1]} = ${val(m[1])}.`;
  if (/^print\(/.test(t)) {
    const shown = outDelta.replace(/\n$/, '');
    return shown ? `מדפיסים על המסך: ${shown.includes('\n') ? 'כמה שורות' : `"${shown}"`}.` : 'מדפיסים שורה ריקה.';
  }
  return 'מריצים את השורה הזו.';
}

// השורה האחרונה של הבלוק שמתחיל בשורה line (if / for / while / else...)
function blockEnd(lines, line) {
  const base = indentOf(lines[line - 1] || '');
  let end = line;
  for (let n = line + 1; n <= lines.length; n++) {
    const l = lines[n - 1];
    if (!l.trim()) continue;
    if (indentOf(l) <= base) break;
    end = n;
  }
  return end;
}

// הופך את רשימת האירועים לצעדים שאפשר להציג
function buildSteps(code, trace, inputs = []) {
  const lines = code.split('\n');
  const ev = trace.events;
  const steps = [];
  const calls = []; // שורות שקראו לפונקציה ומחכות שהיא תחזיר תשובה
  let inputIdx = 0; // כדי לדעת מה "המשתמש הקליד" בכל שורה עם input
  const stateOf = (e, fn) => (fn === '<module>' ? e[3] : { ...e[3], ...e[4] });
  // האירוע הבא באותה פונקציה — שם רואים את המצב אחרי שהשורה סיימה
  const nextInFrame = (i, fn) => ev.slice(i + 1).find((e) => e[2] === fn && (e[0] === 'line' || e[0] === 'end' || (e[0] === 'return' && fn !== '<module>')));
  const lastLineIdx = ev.map((e) => e[0]).lastIndexOf('line');

  for (let i = 0; i < ev.length - 1; i++) {
    const [kind, line, fn, g, local, out] = ev[i];
    const next = ev[i + 1];

    if (kind === 'return') {
      if (fn === '<module>') continue;
      steps.push({ line, fn, text: `הפונקציה ${fn} מסתיימת ומחזירה ${ev[i][6]}.`, vars: next[3], local: {}, prevVars: g, out: next[5] });
      const call = calls.pop();
      if (call) {
        // חוזרים לשורה שקראה לפונקציה — עכשיו כבר יודעים את התוצאה
        const done = nextInFrame(i, call.fn) || next;
        const after = stateOf(done, call.fn);
        steps.push({
          line: call.line, fn: call.fn,
          text: 'חוזרים לשורה שקראה לפונקציה. ' + narrate(call.src, { before: call.before, after, entered: false, outDelta: done[5].slice(call.out.length), typed: call.typed }),
          vars: done[3], local: call.fn !== '<module>' ? done[4] : {}, prevVars: call.prevVars, out: done[5]
        });
      }
      continue;
    }

    const src = lines[line - 1] || '';
    const before = stateOf(ev[i], fn);
    const typed = /input\(/.test(src) ? inputs[inputIdx++] : '';

    // השורה קוראת לפונקציה שלנו: קודם נכנסים לפונקציה, ואחר כך חוזרים לשורה
    if (next[2] !== fn && next[0] === 'line') {
      calls.push({ line, fn, src, before, prevVars: g, out, typed });
      steps.push({ line, fn, text: `השורה הזו קוראת לפונקציה ${next[2]} — נכנסים לפונקציה ומריצים אותה.`, vars: next[3], local: next[4], prevVars: g, out: next[5] });
      continue;
    }

    // השורה שבה הקוד נעצר עם שגיאה
    if (trace.error && i === lastLineIdx) {
      steps.push({ line, fn, text: 'מנסים להריץ את השורה הזו —', vars: next[3], local: {}, prevVars: g, out: next[5] });
      continue;
    }

    // נכנסנו לבלוק? רק אם השורה הבאה שרצה נמצאת בתוך הבלוק של השורה הזו
    const following = ev.slice(i + 1).find((e) => e[0] === 'line' && e[2] === fn);
    const entered = !!following && following[1] > line && following[1] <= blockEnd(lines, line);
    const done = nextInFrame(i, fn) || next;
    steps.push({
      line, fn,
      text: narrate(src, { before, after: stateOf(done, fn), entered, outDelta: /input\(/.test(src) ? '' : next[5].slice(out.length), typed }),
      vars: next[3], local: next[2] === fn && fn !== '<module>' ? next[4] : {}, prevVars: g, out: next[5]
    });
  }
  return steps;
}

// ---------- חלון ההסבר ----------
const stepper = { steps: [], i: 0, cm: null, timer: null, mark: null, error: null };

function openStepper(code, inputs, title) {
  if (!pyodide) return showToast('פייתון עוד נטען, עוד רגע…', true);
  $('stepTitle').textContent = title;
  $('stepDialog').showModal();
  if (!stepper.cm) {
    stepper.cm = CodeMirror.fromTextArea($('stepCode'), {
      mode: 'python', theme: 'forest', readOnly: 'nocursor', lineNumbers: true, direction: 'ltr', viewportMargin: Infinity
    });
    attachGlossary(stepper.cm);
  }
  stepper.cm.setValue(code);
  requestAnimationFrame(() => stepper.cm.refresh());
  $('stepText').textContent = 'מכין את ההסבר…';
  traceCode(code, inputs).then((trace) => {
    stepper.steps = buildSteps(code, trace, inputs);
    stepper.error = trace.error;
    stepper.i = 0;
    if (!stepper.steps.length) {
      $('stepText').textContent = trace.error ? `הקוד נעצר לפני שהספיק לרוץ: ${trace.error[0]}. ${explainError({ type: trace.error[0], message: trace.error[1] })}` : 'אין כאן שורות להריץ.';
      return;
    }
    showStep();
  }).catch((e) => ($('stepText').textContent = 'לא הצלחנו להכין הסבר לקוד הזה.'));
}

function varRows(vars, prev, cls = '') {
  return Object.entries(vars).map(([k, [type, value]]) => {
    const changed = !prev[k] || prev[k][1] !== value;
    return `<tr class="${changed ? 'changed' : ''} ${cls}"><td dir="ltr" class="v-name">${esc(k)}</td><td class="v-type t-${esc(type)}">${esc(TYPE_NAMES[type] || type)}</td><td dir="ltr" class="v-val">${esc(value)}</td></tr>`;
  }).join('');
}

function showStep() {
  const s = stepper.steps[stepper.i];
  const last = stepper.i === stepper.steps.length - 1;
  if (stepper.mark) stepper.cm.removeLineClass(stepper.mark, 'background', 'step-line');
  stepper.mark = stepper.cm.addLineClass(s.line - 1, 'background', 'step-line');
  stepper.cm.scrollIntoView({ line: s.line - 1, ch: 0 }, 40);
  let text = s.text;
  if (last && stepper.error) text += ` ואז קרתה שגיאה: ${stepper.error[0]}. ${explainError({ type: stepper.error[0], message: stepper.error[1] })}`;
  else if (last) text = text.replace(/\.$/, '') + ' — וזה הצעד האחרון. התוכנית הסתיימה!';
  $('stepText').textContent = text;
  $('stepLine').textContent = `שורה ${s.line}${s.fn !== '<module>' ? ` · בתוך הפונקציה ${s.fn}` : ''}`;
  const rows = varRows(s.local, {}, 'local') + varRows(s.vars, s.prevVars);
  $('stepVars').innerHTML = rows ? `<table>${rows}</table>` : '<span class="muted">עוד אין משתנים</span>';
  $('stepOut').textContent = s.out || '';
  $('stepOut').classList.toggle('empty', !s.out);
  $('stepCount').textContent = `צעד ${stepper.i + 1} מתוך ${stepper.steps.length}`;
  $('stepPrev').disabled = stepper.i === 0;
  $('stepNext').disabled = last;
}

function moveStep(d) {
  stepper.i = Math.max(0, Math.min(stepper.steps.length - 1, stepper.i + d));
  showStep();
}

function toggleAutoplay() {
  if (stepper.timer) return stopAutoplay();
  if (stepper.i === stepper.steps.length - 1) stepper.i = -1;
  $('stepPlay').textContent = 'עצירה';
  stepper.timer = setInterval(() => {
    if (stepper.i >= stepper.steps.length - 1) return stopAutoplay();
    moveStep(1);
  }, 1600);
  moveStep(1);
}
function stopAutoplay() {
  clearInterval(stepper.timer);
  stepper.timer = null;
  $('stepPlay').textContent = 'הפעלה אוטומטית';
}

$('stepPrev').onclick = () => { stopAutoplay(); moveStep(-1); };
$('stepNext').onclick = () => { stopAutoplay(); moveStep(1); };
$('stepPlay').onclick = toggleAutoplay;
$('stepClose').onclick = () => $('stepDialog').close();
$('stepDialog').addEventListener('close', () => { stopAutoplay(); hideTip(); });
$('stepDialog').addEventListener('keydown', (e) => {
  // בעברית "הבא" הוא שמאלה
  if (e.key === 'ArrowLeft') { e.preventDefault(); stopAutoplay(); moveStep(1); }
  if (e.key === 'ArrowRight') { e.preventDefault(); stopAutoplay(); moveStep(-1); }
});

// כפתורים: בשיעור (על הדוגמה) ובתרגול (על הקוד שלכם)
$('explainExample').onclick = () => {
  const l = LESSONS[mission().id];
  openStepper(lessonEditor.getValue(), l.input ? [l.input] : [], 'הסבר צעד אחר צעד: הדוגמה מהשיעור');
};
$('stepBtn').onclick = () => {
  const m = mission();
  openStepper(codeEl.value, m.tests[0].inputs, m.tests[0].inputs.length
    ? `הקוד שלכם, צעד אחר צעד (עם הקלט מהדוגמה: ${m.tests[0].inputs.join(', ')})`
    : 'הקוד שלכם, צעד אחר צעד');
};
