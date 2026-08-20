/**
 * ZenPulse — Focus Tasks & Micro-Notes Module
 */

class TaskManager {
  constructor() {
    this.tasks = JSON.parse(localStorage.getItem('zenpulse_tasks') || '[]');
    this.taskForm = document.getElementById('taskForm');
    this.taskInput = document.getElementById('taskInput');
    this.tasksList = document.getElementById('tasksList');
    this.taskProgressBadge = document.getElementById('taskProgressBadge');
    this.focusQuote = document.getElementById('focusQuote');

    this.quotes = [
      '"Focus is a muscle. The quiet mind creates the clearest thoughts."',
      '"Simplicity is about subtracting the obvious and adding the meaningful."',
      '"Deep work is the superpower of the 21st century."',
      '"One task at a time. Total presence, zero friction."',
      '"Your calm mind is the ultimate weapon against your challenges."'
    ];

    this.init();
  }

  init() {
    this.renderTasks();
    this.bindEvents();
    this.cycleQuote();
  }

  bindEvents() {
    if (this.taskForm) {
      this.taskForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.addTask();
      });
    }
  }

  cycleQuote() {
    if (!this.focusQuote) return;
    const randomQuote = this.quotes[Math.floor(Math.random() * this.quotes.length)];
    this.focusQuote.textContent = randomQuote;
  }

  save() {
    localStorage.setItem('zenpulse_tasks', JSON.stringify(this.tasks));
    this.updateProgressBadge();
  }

  addTask() {
    const text = this.taskInput.value.trim();
    if (!text) return;

    const newTask = {
      id: 'task_' + Date.now(),
      text: text,
      completed: false,
      createdAt: Date.now()
    };

    this.tasks.unshift(newTask);
    this.taskInput.value = '';
    this.save();
    this.renderTasks();
  }

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    task.completed = !task.completed;
    this.save();

    if (task.completed && window.zenAudio) {
      window.zenAudio.playTaskChime();
    }

    this.renderTasks();
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.save();
    this.renderTasks();
  }

  updateProgressBadge() {
    if (!this.taskProgressBadge) return;
    const total = this.tasks.length;
    const completed = this.tasks.filter(t => t.completed).length;
    this.taskProgressBadge.textContent = `${completed}/${total}`;
  }

  renderTasks() {
    if (!this.tasksList) return;

    this.updateProgressBadge();

    if (this.tasks.length === 0) {
      this.tasksList.innerHTML = `
        <div class="empty-tasks-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 20h9"></path>
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
          </svg>
          <p>No focus tasks yet.<br>Set your main objective for this session!</p>
        </div>
      `;
      return;
    }

    this.tasksList.innerHTML = this.tasks.map(task => `
      <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
        <button class="task-checkbox" onclick="window.zenTasks.toggleTask('${task.id}')" aria-label="Toggle task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <span class="task-text">${this.escapeHtml(task.text)}</span>
        <button class="task-delete-btn" onclick="window.zenTasks.deleteTask('${task.id}')" title="Delete task" aria-label="Delete task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `).join('');
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Global instance
document.addEventListener('DOMContentLoaded', () => {
  window.zenTasks = new TaskManager();
});
