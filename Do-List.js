// DOM elements
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const emptyState = document.getElementById('emptyState');
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const themeText = document.getElementById('themeText');
const totalTasksEl = document.getElementById('totalTasks');
const completedTasksEl = document.getElementById('completedTasks');
const completionRateEl = document.getElementById('completionRate');
const todayCompletedEl = document.getElementById('todayCompleted');
const weekCompletedEl = document.getElementById('weekCompleted');
const progressBar = document.getElementById('progressBar');
const dueDateInput = document.getElementById('dueDate');
const categorySelect = document.getElementById('categorySelect');
const prioritySelect = document.getElementById('prioritySelect');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');
const sortSelect = document.getElementById('sortSelect');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importContainer = document.getElementById('importContainer');
const importFile = document.getElementById('importFile');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const undoBtn = document.getElementById('undoBtn');

// App state
let tasks = [];
let isDarkMode = false;
let currentFilter = 'all';
let deletedTask = null;
let deletedTaskIndex = -1;

// Initialize app
function init() {
    loadTasks();
    loadThemePreference();
    renderTasks();
    updateStats();
    
    // Event listeners
    addTaskBtn.addEventListener('click', addTask);
    taskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
    themeToggle.addEventListener('click', toggleTheme);
    searchInput.addEventListener('input', filterTasks);
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            filterTasks();
        });
    });
    
    sortSelect.addEventListener('change', filterTasks);
    
    exportBtn.addEventListener('click', exportTasks);
    importBtn.addEventListener('click', () => {
        importContainer.style.display = importContainer.style.display === 'block' ? 'none' : 'block';
    });
    
    importFile.addEventListener('change', importTasks);
    undoBtn.addEventListener('click', undoDelete);
    
    // Set default due date to today
    const today = new Date();
    dueDateInput.valueAsDate = today;
    
    // Check for approaching deadlines
    setInterval(checkDeadlines, 60000); // Check every minute
}

// Load tasks from localStorage
function loadTasks() {
    const savedTasks = localStorage.getItem('tasks');
    if (savedTasks) {
        tasks = JSON.parse(savedTasks);
        // Convert stored date strings back to Date objects
        tasks.forEach(task => {
            if (task.dueDate) {
                task.dueDate = new Date(task.dueDate);
            }
            if (task.createdAt) {
                task.createdAt = new Date(task.createdAt);
            }
            if (task.completedAt) {
                task.completedAt = new Date(task.completedAt);
            }
        });
    }
}

// Save tasks to localStorage
function saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// Load theme preference
function loadThemePreference() {
    isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.body.classList.add('dark-mode');
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    }
}

// Toggle theme
function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode');
    
    if (isDarkMode) {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark Mode';
    }
    
    localStorage.setItem('darkMode', isDarkMode);
}

// Check for approaching deadlines
function checkDeadlines() {
    const now = new Date();
    
    tasks.forEach(task => {
        if (task.dueDate && !task.completed) {
            const timeDiff = task.dueDate.getTime() - now.getTime();
            const hoursDiff = timeDiff / (1000 * 60 * 60);
            
            if (hoursDiff <= 24 && hoursDiff > 0) {
                showNotification(`Task "${task.text}" is due in less than 24 hours!`);
            }
        }
    });
}

// Show notification
function showNotification(message) {
    // Check if browser supports notifications
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        return;
    }
    
    // Check if permission is already granted
    if (Notification.permission === "granted") {
        new Notification("Task Manager", { body: message });
    }
    // Otherwise, ask for permission
    else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(function (permission) {
            if (permission === "granted") {
                new Notification("Task Manager", { body: message });
            }
        });
    }
}

// Format date for display
function formatDate(date) {
    if (!date) return '';
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
}

// Check if a date is today
function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

// Check if a date is within the current week
function isThisWeek(date) {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    return date >= weekStart && date <= weekEnd;
}

// Check if due date is approaching (within 24 hours)
function isDeadlineApproaching(dueDate) {
    if (!dueDate) return false;
    
    const now = new Date();
    const timeDiff = dueDate.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    return hoursDiff <= 24 && hoursDiff > 0;
}

// Check if due date is past
function isDeadlinePast(dueDate) {
    if (!dueDate) return false;
    
    const now = new Date();
    return dueDate < now;
}

// Filter and sort tasks
function filterTasks() {
    const searchTerm = searchInput.value.toLowerCase();
    const sortBy = sortSelect.value;
    
    let filteredTasks = tasks.filter(task => {
        // Apply search filter
        const matchesSearch = task.text.toLowerCase().includes(searchTerm);
        
        // Apply completion filter
        let matchesCompletion = true;
        if (currentFilter === 'completed') {
            matchesCompletion = task.completed;
        } else if (currentFilter === 'active') {
            matchesCompletion = !task.completed;
        }
        
        return matchesSearch && matchesCompletion;
    });
    
    // Apply sorting
    filteredTasks.sort((a, b) => {
        switch(sortBy) {
            case 'due-date':
                if (!a.dueDate) return 1;
                if (!b.dueDate) return -1;
                return a.dueDate - b.dueDate;
            case 'priority':
                const priorityOrder = { high: 1, medium: 2, low: 3, '': 4 };
                return priorityOrder[a.priority || ''] - priorityOrder[b.priority || ''];
            case 'alphabetical':
                return a.text.localeCompare(b.text);
            default: // date-added
                return a.createdAt - b.createdAt;
        }
    });
    
    renderFilteredTasks(filteredTasks);
}

// Render filtered tasks
function renderFilteredTasks(filteredTasks) {
    taskList.innerHTML = '';
    
    if (filteredTasks.length === 0) {
        emptyState.style.display = 'block';
        emptyState.innerHTML = '<p>No matching tasks found.</p>';
        return;
    }
    
    emptyState.style.display = 'none';
    
    filteredTasks.forEach(task => {
        const taskIndex = tasks.findIndex(t => t.id === task.id);
        renderTaskItem(task, taskIndex);
    });
}

// Render all tasks
function renderTasks() {
    filterTasks(); // This will handle rendering based on current filters
    updateProgressBar();
}

// Render a single task item
function renderTaskItem(task, index) {
    const taskItem = document.createElement('li');
    taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
    
    // Add priority class
    if (task.priority) {
        taskItem.classList.add(`priority-${task.priority}`);
    }
    
    const taskContent = document.createElement('div');
    taskContent.className = 'task-content';
    
    const taskHeader = document.createElement('div');
    taskHeader.className = 'task-header';
    
    // Add category tag if exists
    if (task.category) {
        const categoryTag = document.createElement('span');
        categoryTag.className = `category-tag category-${task.category}`;
        categoryTag.textContent = task.category.charAt(0).toUpperCase() + task.category.slice(1);
        taskHeader.appendChild(categoryTag);
    }
    
    const taskText = document.createElement('div');
    taskText.className = 'task-text';
    taskText.textContent = task.text;
    taskHeader.appendChild(taskText);
    
    taskContent.appendChild(taskHeader);
    
    // Task metadata (due date, etc)
    const taskMeta = document.createElement('div');
    taskMeta.className = 'task-meta';
    
    if (task.dueDate) {
        const dueDate = document.createElement('div');
        dueDate.className = 'due-date';
        
        // Check if deadline is approaching or past
        if (isDeadlinePast(task.dueDate) && !task.completed) {
            dueDate.classList.add('approaching-deadline');
            dueDate.innerHTML = `<span>⚠️ Overdue: ${formatDate(task.dueDate)}</span>`;
        } else if (isDeadlineApproaching(task.dueDate) && !task.completed) {
            dueDate.classList.add('approaching-deadline');
            dueDate.innerHTML = `<span>⏰ Due soon: ${formatDate(task.dueDate)}</span>`;
        } else {
            dueDate.innerHTML = `<span>📅 Due: ${formatDate(task.dueDate)}</span>`;
        }
        
        taskMeta.appendChild(dueDate);
    }
    
    if (task.priority) {
        const priority = document.createElement('div');
        priority.textContent = `Priority: ${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`;
        taskMeta.appendChild(priority);
    }
    
    taskContent.appendChild(taskMeta);
    
    const taskActions = document.createElement('div');
    taskActions.className = 'task-actions';
    
    // Complete button
    const completeBtn = document.createElement('button');
    completeBtn.className = 'btn btn-complete';
    completeBtn.innerHTML = '✓';
    completeBtn.title = task.completed ? 'Mark as incomplete' : 'Mark as complete';
    completeBtn.addEventListener('click', () => {
        task.completed = !task.completed;
        if (task.completed) {
            task.completedAt = new Date();
        } else {
            delete task.completedAt;
        }
        saveTasks();
        renderTasks();
        updateStats();
    });

    // Edit button
    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-edit';
    editBtn.innerHTML = '✎';
    editBtn.title = 'Edit task';
    editBtn.addEventListener('click', () => {
        const newText = prompt("Edit task:", task.text);
        if (newText !== null && newText.trim() !== '') {
            task.text = newText.trim();
            saveTasks();
            renderTasks();
        }
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-delete';
    deleteBtn.innerHTML = '×';
    deleteBtn.title = 'Delete task';
    deleteBtn.addEventListener('click', () => {
        deletedTask = task;
        deletedTaskIndex = index;
        tasks.splice(index, 1);
        saveTasks();
        renderTasks();
        updateStats();
        showToast(`Task "${task.text}" deleted`);
    });

    taskActions.appendChild(completeBtn);
    taskActions.appendChild(editBtn);
    taskActions.appendChild(deleteBtn);

    taskItem.appendChild(taskContent);
    taskItem.appendChild(taskActions);

    taskList.appendChild(taskItem);
}

// Show toast
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

// Undo delete
function undoDelete() {
    if (deletedTask && deletedTaskIndex !== -1) {
        tasks.splice(deletedTaskIndex, 0, deletedTask);
        saveTasks();
        renderTasks();
        updateStats();
        deletedTask = null;
        deletedTaskIndex = -1;
        toast.classList.remove('show');
    }
}

// Update progress bar and stats
function updateProgressBar() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);
    progressBar.style.width = percentage + '%';
}

function updateStats() {
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const todayCompleted = tasks.filter(task =>
        task.completed && task.completedAt && isToday(new Date(task.completedAt))
    ).length;
    const weekCompleted = tasks.filter(task =>
        task.completed && task.completedAt && isThisWeek(new Date(task.completedAt))
    ).length;

    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    completionRateEl.textContent = total === 0 ? '0%' : `${Math.round((completed / total) * 100)}%`;
    todayCompletedEl.textContent = todayCompleted;
    weekCompletedEl.textContent = weekCompleted;
    updateProgressBar();
}

// Add new task
function addTask() {
    const text = taskInput.value.trim();
    if (text === '') return;

    const newTask = {
        id: Date.now(),
        text,
        completed: false,
        createdAt: new Date(),
        dueDate: dueDateInput.value ? new Date(dueDateInput.value) : null,
        category: categorySelect.value,
        priority: prioritySelect.value
    };

    tasks.push(newTask);
    taskInput.value = '';
    saveTasks();
    renderTasks();
    updateStats();
}

// Export tasks to file
function exportTasks() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(tasks));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", "tasks.json");
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
}

// Import tasks from file
function importTasks(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedTasks = JSON.parse(e.target.result);
            importedTasks.forEach(task => {
                task.id = task.id || Date.now();
                task.createdAt = task.createdAt ? new Date(task.createdAt) : new Date();
                if (task.dueDate) task.dueDate = new Date(task.dueDate);
                if (task.completedAt) task.completedAt = new Date(task.completedAt);
                tasks.push(task);
            });
            saveTasks();
            renderTasks();
            updateStats();
        } catch (err) {
            alert('Invalid file format.');
        }
    };
    reader.readAsText(file);
}

// Initialize everything
init();
