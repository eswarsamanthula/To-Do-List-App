/* ─────────────────────────────────────────────────────
   TASK — Do-List.js
   Full rewrite: NLP input, keyboard shortcuts, bulk actions,
   streak counter, confetti on 100%, CSV export, notes field,
   edit modal, stagger animations, theme toggle
   ───────────────────────────────────────────────────── */

// ── DOM REFS ──────────────────────────────────────────
const taskInput      = document.getElementById('taskInput');
const addTaskBtn     = document.getElementById('addTaskBtn');
const taskList       = document.getElementById('taskList');
const emptyState     = document.getElementById('emptyState');
const themeToggle    = document.getElementById('themeToggle');
const progressFill   = document.getElementById('progressFill');
const progressLabel  = document.getElementById('progressLabel');
const dueDateInput   = document.getElementById('dueDate');
const categorySelect = document.getElementById('categorySelect');
const prioritySelect = document.getElementById('prioritySelect');
const searchInput    = document.getElementById('searchInput');
const sortSelect     = document.getElementById('sortSelect');
const filterTabs     = document.querySelectorAll('.ftab');
const exportBtn      = document.getElementById('exportBtn');
const exportCsvBtn   = document.getElementById('exportCsvBtn');
const importBtn      = document.getElementById('importBtn');
const importFile     = document.getElementById('importFile');
const toast          = document.getElementById('toast');
const toastMessage   = document.getElementById('toastMessage');
const undoBtn        = document.getElementById('undoBtn');
const bulkActions    = document.getElementById('bulkActions');
const bulkComplete   = document.getElementById('bulkComplete');
const bulkDelete     = document.getElementById('bulkDelete');
const shortcutsBtn   = document.getElementById('shortcutsBtn');
const shortcutsPanel = document.getElementById('shortcutsPanel');
const confettiCanvas = document.getElementById('confettiCanvas');

// Stats
const statTotal     = document.getElementById('statTotal');
const statCompleted = document.getElementById('statCompleted');
const statToday     = document.getElementById('statToday');
const statRate      = document.getElementById('statRate');
const statStreak    = document.getElementById('statStreak');

// Edit modal
const editModal    = document.getElementById('editModal');
const editInput    = document.getElementById('editInput');
const editDate     = document.getElementById('editDate');
const editCategory = document.getElementById('editCategory');
const editPriority = document.getElementById('editPriority');
const editNotes    = document.getElementById('editNotes');
const modalSave    = document.getElementById('modalSave');
const modalCancel  = document.getElementById('modalCancel');
const modalClose   = document.getElementById('modalClose');

// ── STATE ─────────────────────────────────────────────
let tasks         = [];
let currentFilter = 'all';
let deletedTask   = null;
let deletedIndex  = -1;
let toastTimer    = null;
let editingId     = null;
let confettiParts = [];
let confettiAnim  = null;

// ── INIT ──────────────────────────────────────────────
function init() {
  loadTasks();
  loadTheme();
  renderAll();

  addTaskBtn.addEventListener('click', addTask);
  taskInput.addEventListener('keydown', e => { if (e.key === 'Enter') addTask(); });

  filterTabs.forEach(btn => btn.addEventListener('click', () => {
    filterTabs.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderAll();
  }));

  searchInput.addEventListener('input', renderAll);
  sortSelect.addEventListener('change', renderAll);
  themeToggle.addEventListener('click', toggleTheme);

  exportBtn.addEventListener('click', exportJSON);
  exportCsvBtn.addEventListener('click', exportCSV);
  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', importJSON);

  undoBtn.addEventListener('click', undoDelete);
  bulkComplete.addEventListener('click', doBulkComplete);
  bulkDelete.addEventListener('click', doBulkDelete);

  shortcutsBtn.addEventListener('click', () => {
    shortcutsPanel.hidden = !shortcutsPanel.hidden;
  });

  // Modal
  modalSave.addEventListener('click', saveEdit);
  modalCancel.addEventListener('click', closeModal);
  modalClose.addEventListener('click', closeModal);
  editModal.addEventListener('click', e => { if (e.target === editModal) closeModal(); });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleShortcut);

  // Default date = today
  dueDateInput.valueAsDate = new Date();

  setInterval(checkDeadlines, 60000);
}

// ── THEME ─────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
}

// ── KEYBOARD SHORTCUTS ────────────────────────────────
function handleShortcut(e) {
  // Don't fire when typing in inputs/textareas
  const tag = e.target.tagName.toLowerCase();
  const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';

  if (e.key === 'Escape') {
    if (!editModal.hidden) { closeModal(); return; }
    if (!shortcutsPanel.hidden) { shortcutsPanel.hidden = true; return; }
    searchInput.value = '';
    renderAll();
    return;
  }

  if (inInput) return;

  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    taskInput.focus();
  }
  if (e.key === '/') {
    e.preventDefault();
    searchInput.focus();
  }
  if (e.key === '?') {
    shortcutsPanel.hidden = !shortcutsPanel.hidden;
  }
  if (e.key === 't' || e.key === 'T') {
    toggleTheme();
  }
}

// ── NLP PARSER ────────────────────────────────────────
// Parses natural language like "Buy milk tomorrow high personal"
function parseNaturalInput(raw) {
  let text = raw.trim();
  let dueDate = null;
  let priority = '';
  let category = '';

  // Priority keywords
  const priMap = { high: 'high', urgent: 'high', important: 'high', medium: 'medium', normal: 'medium', low: 'low', minor: 'low' };
  for (const [kw, val] of Object.entries(priMap)) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(text)) { priority = val; text = text.replace(re, '').trim(); break; }
  }

  // Category keywords
  const catMap = { work: 'work', job: 'work', office: 'work', personal: 'personal', self: 'personal', health: 'health', gym: 'health', exercise: 'health', shopping: 'shopping', shop: 'shopping', buy: 'shopping', education: 'education', learn: 'education', study: 'education' };
  for (const [kw, val] of Object.entries(catMap)) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(text) && text.replace(re,'').trim().length > 0) {
      // Only strip if it's a trailing/leading context word, not part of the task
      // Simple heuristic: strip only if it appears after 2+ words
      const words = text.split(' ');
      if (words.length > 2 && re.test(words[words.length - 1])) {
        category = val; text = words.slice(0, -1).join(' ').trim();
      } else if (words.length > 2 && re.test(words[0])) {
        // don't strip leading category words — they're likely part of the task
      }
      break;
    }
  }

  // Date keywords
  const today = new Date(); today.setHours(0,0,0,0);
  const datePatterns = [
    { re: /\btoday\b/i,     days: 0 },
    { re: /\btomorrow\b/i,  days: 1 },
    { re: /\bnext week\b/i, days: 7 },
  ];
  for (const { re, days } of datePatterns) {
    if (re.test(text)) {
      dueDate = new Date(today); dueDate.setDate(today.getDate() + days);
      text = text.replace(re, '').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  // Day of week: "friday", "monday" etc.
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  for (let i = 0; i < days.length; i++) {
    const re = new RegExp(`\\b${days[i]}\\b`, 'i');
    if (re.test(text)) {
      const target = new Date(today);
      const diff = (i - today.getDay() + 7) % 7 || 7;
      target.setDate(today.getDate() + diff);
      dueDate = target;
      text = text.replace(re, '').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  return { text: text || raw.trim(), dueDate, priority, category };
}

// ── ADD TASK ──────────────────────────────────────────
function addTask() {
  const raw = taskInput.value.trim();
  if (!raw) { taskInput.focus(); return; }

  const parsed = parseNaturalInput(raw);

  const dueDateVal = dueDateInput.value ? new Date(dueDateInput.value) : parsed.dueDate;
  const catVal     = categorySelect.value || parsed.category;
  const priVal     = prioritySelect.value || parsed.priority;

  const task = {
    id:          Date.now(),
    text:        parsed.text,
    notes:       '',
    completed:   false,
    createdAt:   new Date().toISOString(),
    completedAt: null,
    dueDate:     dueDateVal ? dueDateVal.toISOString() : null,
    category:    catVal,
    priority:    priVal,
  };

  tasks.unshift(task);
  taskInput.value = '';
  saveTasks();
  renderAll();
  showToast('Task added', false);
}

// ── RENDER ────────────────────────────────────────────
function renderAll() {
  const searchTerm = searchInput.value.toLowerCase();
  const sortBy     = sortSelect.value;

  let list = tasks.filter(t => {
    const matchSearch = t.text.toLowerCase().includes(searchTerm) || (t.notes || '').toLowerCase().includes(searchTerm);
    const matchFilter = currentFilter === 'all' ? true : currentFilter === 'completed' ? t.completed : !t.completed;
    return matchSearch && matchFilter;
  });

  list.sort((a, b) => {
    if (sortBy === 'due-date') {
      if (!a.dueDate) return 1; if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    if (sortBy === 'priority') {
      const o = { high:1, medium:2, low:3, '':4 };
      return (o[a.priority||'']||4) - (o[b.priority||'']||4);
    }
    if (sortBy === 'alphabetical') return a.text.localeCompare(b.text);
    return new Date(b.createdAt) - new Date(a.createdAt); // newest first
  });

  taskList.innerHTML = '';

  if (list.length === 0) {
    emptyState.hidden = false;
    bulkActions.hidden = true;
  } else {
    emptyState.hidden = true;
    bulkActions.hidden = false;
    list.forEach((task, i) => taskList.appendChild(buildTaskEl(task, i)));
  }

  updateStats();
  updateProgress();
}

function buildTaskEl(task, idx) {
  const li = document.createElement('li');
  li.className = `task-item${task.completed ? ' completed' : ''}${task.priority ? ` priority-${task.priority}` : ''}`;
  li.dataset.id = task.id;
  li.style.animationDelay = `${Math.min(idx * 30, 300)}ms`;

  // Checkbox / complete btn
  const checkBtn = document.createElement('button');
  checkBtn.className = 'task-check';
  checkBtn.innerHTML = task.completed ? '◆' : '◇';
  checkBtn.title = task.completed ? 'Mark incomplete' : 'Mark complete';
  checkBtn.addEventListener('click', () => toggleComplete(task.id));

  // Body
  const body = document.createElement('div');
  body.className = 'task-body';

  const textEl = document.createElement('div');
  textEl.className = 'task-text';
  textEl.textContent = task.text;

  body.appendChild(textEl);

  if (task.notes) {
    const notesEl = document.createElement('div');
    notesEl.className = 'task-notes';
    notesEl.textContent = task.notes;
    body.appendChild(notesEl);
  }

  // Meta row
  const meta = document.createElement('div');
  meta.className = 'task-meta-row';

  if (task.category) {
    const cat = document.createElement('span');
    cat.className = `cat-tag cat-${task.category}`;
    cat.textContent = task.category;
    meta.appendChild(cat);
  }

  if (task.priority) {
    const pri = document.createElement('span');
    pri.className = `pri-tag pri-${task.priority}`;
    pri.textContent = task.priority;
    meta.appendChild(pri);
  }

  if (task.dueDate) {
    const due = document.createElement('span');
    const dueD = new Date(task.dueDate);
    const now  = new Date();
    const diff = (dueD - now) / 36e5; // hours
    let cls = 'due-tag';
    let label = `📅 ${formatDate(dueD)}`;
    if (!task.completed) {
      if (diff < 0)  { cls += ' overdue'; label = `⚠ Overdue ${formatDate(dueD)}`; }
      else if (diff < 24) { cls += ' soon'; label = `⏰ Due soon ${formatDate(dueD)}`; }
    }
    due.className = cls;
    due.textContent = label;
    meta.appendChild(due);
  }

  body.appendChild(meta);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'task-actions';

  const editBtn = makeTaskBtn('✎', 'Edit task', () => openEdit(task.id));
  const delBtn  = makeTaskBtn('✕', 'Delete task', () => deleteTask(task.id));
  delBtn.classList.add('del');

  actions.appendChild(editBtn);
  actions.appendChild(delBtn);

  li.appendChild(checkBtn);
  li.appendChild(body);
  li.appendChild(actions);

  return li;
}

function makeTaskBtn(icon, title, handler) {
  const btn = document.createElement('button');
  btn.className = 'task-btn';
  btn.innerHTML = icon;
  btn.title = title;
  btn.addEventListener('click', handler);
  return btn;
}

// ── COMPLETE ──────────────────────────────────────────
function toggleComplete(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? new Date().toISOString() : null;
  saveTasks();
  renderAll();

  // Check for 100% completion
  if (tasks.length > 0 && tasks.every(t => t.completed)) launchConfetti();
}

// ── DELETE ────────────────────────────────────────────
function deleteTask(id) {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  deletedTask  = tasks[idx];
  deletedIndex = idx;
  tasks.splice(idx, 1);
  saveTasks();
  renderAll();
  showToast(`Deleted "${deletedTask.text.slice(0,30)}${deletedTask.text.length>30?'…':''}"`, true);
}

function undoDelete() {
  if (!deletedTask) return;
  tasks.splice(deletedIndex, 0, deletedTask);
  deletedTask = null; deletedIndex = -1;
  saveTasks();
  renderAll();
  hideToast();
}

// ── BULK ACTIONS ──────────────────────────────────────
function doBulkComplete() {
  tasks.forEach(t => {
    if (!t.completed) { t.completed = true; t.completedAt = new Date().toISOString(); }
  });
  saveTasks(); renderAll();
  if (tasks.length > 0 && tasks.every(t => t.completed)) launchConfetti();
}

function doBulkDelete() {
  if (!confirm('Delete all visible tasks?')) return;
  const visible = getVisibleIds();
  tasks = tasks.filter(t => !visible.has(t.id));
  saveTasks(); renderAll();
}

function getVisibleIds() {
  const ids = new Set();
  taskList.querySelectorAll('.task-item').forEach(el => ids.add(Number(el.dataset.id)));
  return ids;
}

// ── EDIT MODAL ────────────────────────────────────────
function openEdit(id) {
  const t = tasks.find(t => t.id === id);
  if (!t) return;
  editingId = id;
  editInput.value    = t.text;
  editNotes.value    = t.notes || '';
  editDate.value     = t.dueDate ? t.dueDate.slice(0,10) : '';
  editCategory.value = t.category || '';
  editPriority.value = t.priority || '';
  editModal.hidden   = false;
  editInput.focus();
}

function saveEdit() {
  const t = tasks.find(t => t.id === editingId);
  if (!t) return;
  const text = editInput.value.trim();
  if (!text) { editInput.focus(); return; }
  t.text     = text;
  t.notes    = editNotes.value.trim();
  t.dueDate  = editDate.value ? new Date(editDate.value).toISOString() : null;
  t.category = editCategory.value;
  t.priority = editPriority.value;
  saveTasks();
  renderAll();
  closeModal();
}

function closeModal() {
  editModal.hidden = true;
  editingId = null;
}

// ── STATS ─────────────────────────────────────────────
function updateStats() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const today     = tasks.filter(t => t.completed && t.completedAt && isToday(new Date(t.completedAt))).length;
  const rate      = total === 0 ? 0 : Math.round((completed / total) * 100);
  const streak    = calcStreak();

  statTotal.textContent     = total;
  statCompleted.textContent = completed;
  statToday.textContent     = today;
  statRate.textContent      = rate + '%';
  statStreak.textContent    = `🔥 ${streak}`;
}

function updateProgress() {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pct       = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressFill.style.width = pct + '%';
  progressLabel.textContent = `${completed} / ${total} complete`;
}

// ── STREAK ────────────────────────────────────────────
function calcStreak() {
  // Count consecutive days (going backwards from today) that had at least 1 completed task
  const completedDates = new Set(
    tasks.filter(t => t.completedAt).map(t => t.completedAt.slice(0,10))
  );
  let streak = 0;
  const d = new Date(); d.setHours(0,0,0,0);
  while (true) {
    const key = d.toISOString().slice(0,10);
    if (completedDates.has(key)) { streak++; d.setDate(d.getDate()-1); }
    else break;
  }
  return streak;
}

// ── DATE UTILS ────────────────────────────────────────
function formatDate(date) {
  return date.toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' });
}

function isToday(date) {
  const t = new Date(); 
  return date.getDate()===t.getDate() && date.getMonth()===t.getMonth() && date.getFullYear()===t.getFullYear();
}

// ── DEADLINE CHECK ────────────────────────────────────
function checkDeadlines() {
  tasks.forEach(t => {
    if (!t.dueDate || t.completed) return;
    const diff = (new Date(t.dueDate) - new Date()) / 36e5;
    if (diff <= 24 && diff > 0 && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('TASK', { body: `"${t.text}" is due in less than 24 hours` });
    }
  });
}

// ── PERSIST ───────────────────────────────────────────
function saveTasks()  { localStorage.setItem('tasks', JSON.stringify(tasks)); }
function loadTasks()  { try { tasks = JSON.parse(localStorage.getItem('tasks') || '[]'); } catch { tasks = []; } }

// ── EXPORT / IMPORT ───────────────────────────────────
function exportJSON() {
  const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
  triggerDownload(blob, 'tasks.json');
}

function exportCSV() {
  const header = ['id','text','notes','completed','priority','category','dueDate','createdAt','completedAt'];
  const rows = tasks.map(t => header.map(k => JSON.stringify(t[k] ?? '')).join(','));
  const blob = new Blob([header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' });
  triggerDownload(blob, 'tasks.csv');
}

function triggerDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Not an array');
      imported.forEach(t => {
        if (!tasks.find(x => x.id === t.id)) tasks.push(t);
      });
      saveTasks(); renderAll();
      showToast(`Imported ${imported.length} tasks`, false);
    } catch { showToast('Import failed — invalid JSON', false); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// ── TOAST ─────────────────────────────────────────────
function showToast(msg, showUndo = true) {
  toastMessage.textContent = msg;
  undoBtn.style.display = showUndo ? '' : 'none';
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, 4000);
}

function hideToast() {
  toast.classList.remove('show');
}

// ── CONFETTI ──────────────────────────────────────────
function launchConfetti() {
  const W = confettiCanvas.width  = window.innerWidth;
  const H = confettiCanvas.height = window.innerHeight;
  const ctx = confettiCanvas.getContext('2d');
  const colors = ['#e8d44d','#ff5533','#4dbbe8','#4de87a','#b87de8','#e8a14d'];

  confettiParts = Array.from({ length: 120 }, () => ({
    x: Math.random() * W,
    y: Math.random() * -H,
    r: Math.random() * 8 + 4,
    d: Math.random() * 80 + 20,
    color: colors[Math.floor(Math.random() * colors.length)],
    tilt: Math.random() * 10 - 10,
    tiltAngle: 0,
    tiltSpeed: Math.random() * 0.1 + 0.05,
    speed: Math.random() * 3 + 2,
  }));

  if (confettiAnim) cancelAnimationFrame(confettiAnim);

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    confettiParts.forEach(p => {
      ctx.beginPath();
      ctx.fillStyle = p.color;
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.tilt, 0, Math.PI * 2);
      ctx.fill();
      p.y += p.speed;
      p.tiltAngle += p.tiltSpeed;
      p.tilt = Math.sin(p.tiltAngle) * 15;
      if (p.y > H) { p.y = -20; p.x = Math.random() * W; }
    });
    frame++;
    if (frame < 250) confettiAnim = requestAnimationFrame(draw);
    else { ctx.clearRect(0, 0, W, H); }
  }

  draw();
  showToast('🎉 All tasks complete!', false);
}

// ── START ─────────────────────────────────────────────
init();