// admin-tasks.js - ניהול משימות מנהל פנימיות
import {
    REPO_OWNER, REPO_NAME, TASKS_JSON_PATH,
    GITHUB_TOKEN,
    showStatus, hideStatus, encodeToBase64, decodeBase64ToUtf8,
    logEvent, putWithShaRetry
} from './admin-core.js';

let allTasks = [];
let tasksSha = null;

// אלמנטים
const tasksListContainer = document.getElementById('tasks-list');
const newTaskInput = document.getElementById('new-task-input');
const addTaskBtn = document.getElementById('add-task-btn');

export async function loadAndRenderTasks() {
    if (!tasksListContainer) return;
    
    tasksListContainer.innerHTML = '<p style="text-align:center;">טוען משימות...</p>';
    
    try {
        const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TASKS_JSON_PATH}`;
        const res = await fetch(API_URL, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}` },
            cache: 'no-store'
        });
        
        if (res.ok) {
            const data = await res.json();
            tasksSha = data.sha;
            allTasks = JSON.parse(decodeBase64ToUtf8(data.content.replace(/\n/g, '')));
        } else if (res.status === 404) {
            // קובץ לא קיים - התחל עם רשימה ריקה
            allTasks = [];
            tasksSha = null;
        } else {
            throw new Error('Failed to fetch tasks');
        }
        
        renderTasks();
    } catch (err) {
        tasksListContainer.innerHTML = `<p style="text-align:center; color:red;">שגיאה בטעינת משימות: ${err.message}</p>`;
    }
}

function renderTasks() {
    if (!tasksListContainer) return;
    
    if (allTasks.length === 0) {
        tasksListContainer.innerHTML = '<p style="text-align:center; color:#7f8c8d;">אין משימות פתוחות. עבודה טובה!</p>';
        return;
    }
    
    tasksListContainer.innerHTML = '';
    allTasks.forEach((task, index) => {
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''}`;
        div.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px;
            background: ${task.completed ? '#f1f5f9' : '#fff'};
            border: 1px solid ${task.completed ? '#e2e8f0' : '#cbd5e1'};
            border-radius: 8px;
            margin-bottom: 10px;
            transition: all 0.2s;
        `;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.style.cursor = 'pointer';
        checkbox.addEventListener('change', () => toggleTask(index));
        
        const span = document.createElement('span');
        span.textContent = task.text;
        span.style.cssText = `
            flex: 1;
            font-size: 1rem;
            text-decoration: ${task.completed ? 'line-through' : 'none'};
            color: ${task.completed ? '#64748b' : '#1e293b'};
        `;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.style.cssText = 'background:none; border:none; cursor:pointer; font-size:1.1rem; opacity:0.6;';
        deleteBtn.title = 'מחק משימה';
        deleteBtn.addEventListener('click', () => deleteTask(index));
        deleteBtn.addEventListener('mouseover', () => deleteBtn.style.opacity = '1');
        deleteBtn.addEventListener('mouseout', () => deleteBtn.style.opacity = '0.6');
        
        div.appendChild(checkbox);
        div.appendChild(span);
        div.appendChild(deleteBtn);
        tasksListContainer.appendChild(div);
    });
}

async function addTask() {
    const text = newTaskInput.value.trim();
    if (!text) return;
    
    const newTask = {
        text,
        completed: false,
        createdAt: new Date().toISOString()
    };
    
    allTasks.unshift(newTask);
    newTaskInput.value = '';
    renderTasks();
    await saveTasks(`Add task: ${text}`);
}

async function toggleTask(index) {
    allTasks[index].completed = !allTasks[index].completed;
    renderTasks();
    await saveTasks(`Toggle task: ${allTasks[index].text}`);
}

async function deleteTask(index) {
    const text = allTasks[index].text;
    allTasks.splice(index, 1);
    renderTasks();
    await saveTasks(`Delete task: ${text}`);
}

async function saveTasks(message) {
    showStatus('מעדכן משימות ב-GitHub...', 50);
    const API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${TASKS_JSON_PATH}`;
    
    try {
        const payload = {
            message,
            content: encodeToBase64(JSON.stringify(allTasks, null, 2)),
            branch: 'main'
        };
        
        const res = await putWithShaRetry(API_URL, payload, GITHUB_TOKEN, tasksSha, 2);
        if (res.ok) {
            const data = await res.json();
            tasksSha = data.content.sha;
            hideStatus();
        } else {
            throw new Error('Failed to save tasks');
        }
    } catch (err) {
        showStatus(`שגיאה בשמירת משימות: ${err.message}`, null, true);
    }
}

// מאזינים
if (addTaskBtn) {
    addTaskBtn.addEventListener('click', addTask);
}
if (newTaskInput) {
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask();
    });
}
