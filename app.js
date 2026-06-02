const DEFAULT_SETTINGS = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  longEvery: 4,
  dailyGoal: 8,
  autoStart: "off",
  sound: true,
  notify: false
};

const MODE_COPY = {
  focus: { label: "专注时间", action: "开始专注", complete: "一轮专注完成" },
  short: { label: "短休时间", action: "开始短休", complete: "短休结束" },
  long: { label: "长休时间", action: "开始长休", complete: "长休结束" }
};

const STORAGE_KEY = "tomato-focus-state-v1";
const RING_LENGTH = 1143.54;

let state = loadState();
let mode = state.mode || "focus";
let remaining = state.remaining || durationFor(mode);
let total = state.total || durationFor(mode);
let running = false;
let endAt = null;
let tickTimer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  timeDisplay: $("#timeDisplay"),
  ringProgress: $("#ringProgress"),
  modeLabel: $("#modeLabel"),
  cycleLabel: $("#cycleLabel"),
  startPauseBtn: $("#startPauseBtn"),
  resetBtn: $("#resetBtn"),
  skipBtn: $("#skipBtn"),
  activeTaskName: $("#activeTaskName"),
  todayCompleted: $("#todayCompleted"),
  dailyGoalInline: $("#dailyGoalInline"),
  goalText: $("#goalText"),
  goalPercent: $("#goalPercent"),
  goalProgress: $("#goalProgress"),
  focusedMinutes: $("#focusedMinutes"),
  doneTasks: $("#doneTasks"),
  streakCount: $("#streakCount"),
  taskForm: $("#taskForm"),
  taskInput: $("#taskInput"),
  taskList: $("#taskList"),
  clearDoneBtn: $("#clearDoneBtn"),
  focusNote: $("#focusNote"),
  saveNoteBtn: $("#saveNoteBtn"),
  settingsDialog: $("#settingsDialog"),
  settingsBtn: $("#settingsBtn"),
  saveSettingsBtn: $("#saveSettingsBtn"),
  restoreBtn: $("#restoreBtn"),
  soundToggle: $("#soundToggle"),
  notifyToggle: $("#notifyToggle"),
  focusNowBtn: $("#focusNowBtn"),
  desktopMiniBtn: $("#desktopMiniBtn"),
  historyBtn: $("#historyBtn"),
  historyDialog: $("#historyDialog"),
  historyList: $("#historyList"),
  clearHistoryBtn: $("#clearHistoryBtn")
};

function loadState() {
  const fallback = {
    settings: { ...DEFAULT_SETTINGS },
    tasks: [],
    activeTaskId: null,
    history: [],
    completedToday: 0,
    focusSecondsToday: 0,
    streak: 0,
    note: "",
    day: todayKey()
  };

  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const hydrated = {
      ...fallback,
      ...stored,
      settings: { ...DEFAULT_SETTINGS, ...stored?.settings },
      tasks: Array.isArray(stored?.tasks) ? stored.tasks : [],
      history: Array.isArray(stored?.history) ? stored.history : []
    };
    if (hydrated.day !== todayKey()) {
      hydrated.day = todayKey();
      hydrated.completedToday = 0;
      hydrated.focusSecondsToday = 0;
      hydrated.streak = 0;
    }
    return hydrated;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, mode, remaining, total }));
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function durationFor(nextMode) {
  const key = nextMode === "focus" ? "focusMinutes" : nextMode === "short" ? "shortMinutes" : "longMinutes";
  return state.settings[key] * 60;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${secs}`;
}

function formatClock(iso) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

function formatDayLabel(dayKey) {
  const today = todayKey();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = todayKey(yesterdayDate);
  if (dayKey === today) return "今天";
  if (dayKey === yesterday) return "昨天";
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(`${dayKey}T00:00:00`));
}

function setMode(nextMode, keepRunning = false) {
  mode = nextMode;
  total = durationFor(mode);
  remaining = total;
  running = false;
  endAt = null;
  if (tickTimer) clearInterval(tickTimer);
  if (keepRunning) startTimer();
  render();
  saveState();
}

function startTimer() {
  running = true;
  endAt = Date.now() + remaining * 1000;
  elements.startPauseBtn.textContent = "暂停";
  tickTimer = setInterval(tick, 250);
  tick();
}

function pauseTimer() {
  running = false;
  if (endAt) remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  endAt = null;
  clearInterval(tickTimer);
  render();
  saveState();
}

function tick() {
  remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  renderTimer();
  if (remaining <= 0) completeSession();
}

function completeSession({ countCompletion = true } = {}) {
  clearInterval(tickTimer);
  running = false;
  endAt = null;

  if (mode === "focus" && countCompletion) {
    state.completedToday += 1;
    state.streak += 1;
    state.focusSecondsToday += total;
    applyPomodoroToTask();
    addHistoryRecord();
  } else if (mode !== "focus") {
    state.streak = 0;
  }

  if (countCompletion) {
    playChime();
    notify(MODE_COPY[mode].complete, nextModeMessage());
  }

  const nextMode = getNextMode();
  const auto = state.settings.autoStart === "all" || (state.settings.autoStart === "breaks" && nextMode !== "focus");
  setMode(nextMode, auto);
}

function getNextMode() {
  if (mode !== "focus") return "focus";
  return state.completedToday % state.settings.longEvery === 0 ? "long" : "short";
}

function nextModeMessage() {
  const next = getNextMode();
  if (next === "focus") return "准备进入下一轮专注。";
  if (next === "short") return "休息一下，喝口水。";
  return "进入长休，恢复能量。";
}

function activeTask() {
  return state.tasks.find((task) => task.id === state.activeTaskId);
}

function applyPomodoroToTask() {
  const task = activeTask();
  if (!task || task.done) return;
  task.pomodoros += 1;
}

function addHistoryRecord() {
  const task = activeTask();
  const completedAt = new Date().toISOString();
  state.history.unshift({
    id: crypto.randomUUID(),
    completedAt,
    day: todayKey(new Date(completedAt)),
    minutes: Math.round(total / 60),
    taskTitle: task?.title || "未关联任务",
    round: state.completedToday
  });
  state.history = state.history.slice(0, 300);
}

function playChime() {
  if (!state.settings.sound) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const notes = [660, 880, 990];
  notes.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.0001, context.currentTime + index * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.16, context.currentTime + index * 0.12 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + index * 0.12 + 0.28);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + index * 0.12);
    oscillator.stop(context.currentTime + index * 0.12 + 0.32);
  });
}

function notify(title, body) {
  if (!state.settings.notify || !("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body });
}

function render() {
  renderTimer();
  renderModes();
  renderStats();
  renderTasks();
  renderSettings();
}

function renderTimer() {
  elements.timeDisplay.textContent = formatTime(remaining);
  elements.modeLabel.textContent = MODE_COPY[mode].label;
  elements.startPauseBtn.textContent = running ? "暂停" : MODE_COPY[mode].action;
  const completedInCycle = state.completedToday % state.settings.longEvery;
  const left = state.settings.longEvery - completedInCycle;
  elements.cycleLabel.textContent =
    mode === "focus" ? `第 ${state.completedToday + 1} 轮 · 距离长休还有 ${left} 个番茄` : "休息不是中断，是下一轮专注的燃料";

  const progress = total === 0 ? 0 : 1 - remaining / total;
  elements.ringProgress.style.strokeDashoffset = RING_LENGTH * (1 - progress);
  document.title = `${formatTime(remaining)} · ${MODE_COPY[mode].label}`;
  window.tomatoDesktop?.updateTimer({
    time: formatTime(remaining),
    label: MODE_COPY[mode].label
  });
}

function renderModes() {
  $$(".mode-tab").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
}

function renderStats() {
  const completed = state.completedToday;
  const goal = state.settings.dailyGoal;
  const percent = Math.min(100, Math.round((completed / goal) * 100));
  elements.todayCompleted.textContent = completed;
  elements.dailyGoalInline.textContent = goal;
  elements.goalText.textContent = `目标 ${goal} 个番茄`;
  elements.goalPercent.textContent = `${percent}%`;
  elements.goalProgress.style.width = `${percent}%`;
  elements.focusedMinutes.textContent = `${Math.round(state.focusSecondsToday / 60)}m`;
  elements.doneTasks.textContent = state.tasks.filter((task) => task.done).length;
  elements.streakCount.textContent = state.streak;
}

function renderTasks() {
  const task = activeTask();
  elements.activeTaskName.textContent = task ? task.title : "未选择任务";
  elements.focusNote.value = state.note || "";
  elements.taskList.innerHTML = "";

  if (state.tasks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "task-item";
    empty.innerHTML = `<div></div><div><p class="task-title">暂无任务</p><p class="task-meta">添加任务后，可以把番茄记录到它上面</p></div>`;
    elements.taskList.appendChild(empty);
    return;
  }

  state.tasks.forEach((taskItem) => {
    const item = document.createElement("article");
    item.className = `task-item${taskItem.id === state.activeTaskId ? " active" : ""}`;
    item.innerHTML = `
      <input class="task-check" type="checkbox" ${taskItem.done ? "checked" : ""} aria-label="完成任务" />
      <button class="task-main text-button" type="button">
        <p class="task-title">${escapeHtml(taskItem.title)}</p>
        <p class="task-meta">${taskItem.pomodoros} 个番茄 · ${taskItem.done ? "已完成" : "进行中"}</p>
      </button>
      <div class="task-tools">
        <button class="icon-button task-plus" type="button" title="增加一个番茄">+</button>
        <button class="icon-button task-delete" type="button" title="删除">×</button>
      </div>
    `;

    item.querySelector(".task-check").addEventListener("change", (event) => {
      taskItem.done = event.target.checked;
      if (taskItem.done && state.activeTaskId === taskItem.id) state.activeTaskId = null;
      saveState();
      render();
    });
    item.querySelector(".task-main").addEventListener("click", () => {
      state.activeTaskId = taskItem.id;
      saveState();
      render();
    });
    item.querySelector(".task-plus").addEventListener("click", () => {
      taskItem.pomodoros += 1;
      saveState();
      render();
    });
    item.querySelector(".task-delete").addEventListener("click", () => {
      state.tasks = state.tasks.filter((candidate) => candidate.id !== taskItem.id);
      if (state.activeTaskId === taskItem.id) state.activeTaskId = null;
      saveState();
      render();
    });
    elements.taskList.appendChild(item);
  });
}

function renderSettings() {
  $("#focusMinutes").value = state.settings.focusMinutes;
  $("#shortMinutes").value = state.settings.shortMinutes;
  $("#longMinutes").value = state.settings.longMinutes;
  $("#longEvery").value = state.settings.longEvery;
  $("#dailyGoal").value = state.settings.dailyGoal;
  $("#autoStart").value = state.settings.autoStart;
  elements.soundToggle.checked = state.settings.sound;
  elements.notifyToggle.checked = state.settings.notify;
}

function renderHistory() {
  elements.historyList.innerHTML = "";

  if (state.history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "还没有历史记录。完成一轮专注后，这里会自动保存。";
    elements.historyList.appendChild(empty);
    return;
  }

  const groups = state.history.reduce((map, record) => {
    const key = record.day || todayKey(new Date(record.completedAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
    return map;
  }, new Map());

  groups.forEach((records, day) => {
    const section = document.createElement("section");
    section.className = "history-day";
    section.innerHTML = `<h3>${formatDayLabel(day)}</h3>`;

    records.forEach((record) => {
      const item = document.createElement("article");
      item.className = "history-item";
      item.innerHTML = `
        <strong>${escapeHtml(record.taskTitle || "未关联任务")}</strong>
        <time datetime="${record.completedAt}">${formatClock(record.completedAt)}</time>
        <span>${record.minutes} 分钟 · 第 ${record.round || "-"} 轮</span>
      `;
      section.appendChild(item);
    });

    elements.historyList.appendChild(section);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

elements.startPauseBtn.addEventListener("click", () => (running ? pauseTimer() : startTimer()));
elements.resetBtn.addEventListener("click", () => setMode(mode));
elements.skipBtn.addEventListener("click", () => completeSession({ countCompletion: false }));

$$(".mode-tab").forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

elements.taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = elements.taskInput.value.trim();
  if (!title) return;
  const task = { id: crypto.randomUUID(), title, pomodoros: 0, done: false, createdAt: Date.now() };
  state.tasks.unshift(task);
  state.activeTaskId = task.id;
  elements.taskInput.value = "";
  saveState();
  render();
});

elements.clearDoneBtn.addEventListener("click", () => {
  state.tasks = state.tasks.filter((task) => !task.done);
  saveState();
  render();
});

elements.saveNoteBtn.addEventListener("click", () => {
  state.note = elements.focusNote.value.trim();
  saveState();
});

elements.settingsBtn.addEventListener("click", () => elements.settingsDialog.showModal());
elements.historyBtn.addEventListener("click", () => {
  renderHistory();
  elements.historyDialog.showModal();
});

elements.clearHistoryBtn.addEventListener("click", () => {
  if (!window.confirm("确定要清空所有历史专注记录吗？")) return;
  state.history = [];
  saveState();
  renderHistory();
});

elements.focusNowBtn.addEventListener("click", () => {
  document.body.classList.toggle("focus-ambience");
  elements.focusNowBtn.setAttribute("aria-pressed", document.body.classList.contains("focus-ambience").toString());
});

if (window.tomatoDesktop) {
  document.body.classList.add("desktop-app");
  elements.desktopMiniBtn.addEventListener("click", () => {
    window.tomatoDesktop.minimizeToTop();
  });

  window.tomatoDesktop.onMiniMode((enabled) => {
    document.body.classList.toggle("desktop-mini", enabled);
    elements.desktopMiniBtn.textContent = enabled ? "恢复窗口" : "置顶小窗";
  });

  document.addEventListener("dblclick", () => {
    if (document.body.classList.contains("desktop-mini")) {
      window.tomatoDesktop.minimizeToTop();
    }
  });
} else {
  elements.desktopMiniBtn.hidden = true;
}

elements.saveSettingsBtn.addEventListener("click", () => {
  state.settings = {
    ...state.settings,
    focusMinutes: Number($("#focusMinutes").value),
    shortMinutes: Number($("#shortMinutes").value),
    longMinutes: Number($("#longMinutes").value),
    longEvery: Number($("#longEvery").value),
    dailyGoal: Number($("#dailyGoal").value),
    autoStart: $("#autoStart").value
  };
  setMode(mode);
});

elements.restoreBtn.addEventListener("click", () => {
  state.settings = { ...DEFAULT_SETTINGS };
  setMode("focus");
});

elements.soundToggle.addEventListener("change", (event) => {
  state.settings.sound = event.target.checked;
  saveState();
});

elements.notifyToggle.addEventListener("change", async (event) => {
  if (event.target.checked && "Notification" in window && Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    state.settings.notify = permission === "granted";
  } else {
    state.settings.notify = event.target.checked;
  }
  saveState();
  renderSettings();
});

document.addEventListener("keydown", (event) => {
  if (event.target.matches("input, textarea")) return;
  if (event.code === "Space") {
    event.preventDefault();
    running ? pauseTimer() : startTimer();
  }
  if (event.key.toLowerCase() === "r") setMode(mode);
  if (event.key.toLowerCase() === "s") completeSession({ countCompletion: false });
  if (event.key === "Escape") {
    document.body.classList.remove("focus-ambience");
    if (document.body.classList.contains("desktop-mini") && window.tomatoDesktop) {
      window.tomatoDesktop.minimizeToTop();
    }
  }
});

render();
