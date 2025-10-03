// Telegram WebApp initialization
let tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.MainButton.hide();
}

// App state
let currentScreen = 'projectListScreen';
let currentProject = null;
let currentTask = null;
let screenHistory = [];

// Project data
const projectsData = {
    1: {
        title: 'Проект №1:',
        preProduction: {
            progress: 100,
            tasks: [
                { id: 'documents', name: 'Документы', status: 'approved' },
                { id: 'storyboard', name: 'Раскадровка', status: 'approved' },
                { id: 'ai', name: 'AI-генерации', status: 'approved' },
                { id: 'casting', name: 'Кастинг', status: 'approved' },
                { id: 'location', name: 'Локация', status: 'approved' },
                { id: 'props', name: 'Реквизит', status: 'approved' }
            ]
        },
        postProduction: {
            progress: 34,
            tasks: [
                { id: 'editing', name: 'Монтаж', status: 'pending' },
                { id: 'voice', name: 'Озвучка', status: 'approved' },
                { id: 'color', name: 'Цветокоррекция', status: 'approved' },
                { id: 'photo', name: 'Фотообработка', status: 'rejected' },
                { id: 'cg', name: 'CG', status: 'rejected' }
            ]
        }
    },
    2: {
        title: 'Проект №2:',
        preProduction: {
            progress: 64,
            tasks: [
                { id: 'documents', name: 'Документы', status: 'rejected' },
                { id: 'storyboard', name: 'Раскадровка', status: 'approved' },
                { id: 'ai', name: 'AI-генерации', status: 'rejected' },
                { id: 'casting', name: 'Кастинг', status: 'pending' },
                { id: 'location', name: 'Локация', status: 'pending' },
                { id: 'props', name: 'Реквизит', status: 'rejected' }
            ]
        }
    }
};

const tasksData = {
    casting: {
        title: 'Кастинг',
        deadline: '05.09.2025',
        link: 'Ссылка на кастинг',
        actors: [
            { role: 'Мама', actor: 'Елена Мельникова' },
            { role: 'Папа', actor: 'Александр Шушарин' },
            { role: 'Сын', actor: 'Олег Малышев' }
        ]
    }
};

// Navigation functions
function openProject(projectId) {
    currentProject = projectId;
    const project = projectsData[projectId];

    if (!project) return;

    // Update project title
    document.getElementById('projectTitle').textContent = project.title;

    // Update pre-production
    if (project.preProduction) {
        updateSection('pre', project.preProduction);
    }

    // Update post-production  
    if (project.postProduction) {
        updateSection('post', project.postProduction);
    }

    navigateToScreen('projectDetailScreen');
}

function updateSection(sectionType, sectionData) {
    const progressText = document.getElementById(sectionType + 'ProgressText');
    const progressBar = document.getElementById(sectionType + 'ProgressBar');
    const tasksGrid = document.getElementById(sectionType + 'Tasks');

    if (progressText) progressText.textContent = sectionData.progress + '%';
    if (progressBar) progressBar.style.width = sectionData.progress + '%';

    if (tasksGrid && sectionData.tasks) {
        tasksGrid.innerHTML = '';
        sectionData.tasks.forEach(task => {
            const taskCard = createTaskCard(task);
            tasksGrid.appendChild(taskCard);
        });
    }
}

function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute('data-status', task.status);
    card.onclick = () => openTaskDetail(task.id);

    const statusText = getStatusText(task.status);
    const statusClass = getStatusClass(task.status);

    card.innerHTML = `
        <h3>${task.name}</h3>
        <p class="task-status ${statusClass}">${statusText}</p>
    `;

    return card;
}

function getStatusText(status) {
    const statusMap = {
        'approved': 'Согласовано',
        'pending': 'На согласовании',
        'rejected': 'Не согласовано',
        'not-started': 'Не начато'
    };
    return statusMap[status] || status;
}

function getStatusClass(status) {
    const classMap = {
        'approved': 'approved',
        'pending': 'pending', 
        'rejected': 'rejected',
        'not-started': 'not-started'
    };
    return classMap[status] || '';
}

function openTaskDetail(taskId) {
    currentTask = taskId;
    const task = tasksData[taskId];

    if (!task) return;

    // Update task detail screen
    document.getElementById('taskTitle').textContent = task.title;
    document.getElementById('taskDeadline').textContent = `Дедлайн: ${task.deadline}`;
    document.getElementById('linkText').textContent = task.link;

    navigateToScreen('taskDetailScreen');
}

function navigateToScreen(screenId) {
    // Hide current screen
    const currentScreenEl = document.querySelector('.screen.active');
    if (currentScreenEl) {
        currentScreenEl.classList.remove('active');
        screenHistory.push(currentScreen);
    }

    // Show new screen
    const newScreenEl = document.getElementById(screenId);
    if (newScreenEl) {
        newScreenEl.classList.add('active');
        currentScreen = screenId;
    }

    // Haptic feedback
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

function goBack() {
    if (screenHistory.length > 0) {
        const previousScreen = screenHistory.pop();
        navigateToScreen(previousScreen);
    }
}

function goBackFromTask() {
    navigateToScreen('projectDetailScreen');
}

function toggleSection(sectionType) {
    const section = document.querySelector(`#${sectionType}Tasks`).closest('.section');
    const collapseBtn = document.getElementById(sectionType + 'CollapseBtn');

    section.classList.toggle('collapsed');

    if (section.classList.contains('collapsed')) {
        collapseBtn.textContent = '∨';
    } else {
        collapseBtn.textContent = '∧';
    }

    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

function openLink(type) {
    if (tg?.openLink) {
        tg.openLink('https://example.com/casting');
    } else {
        window.open('https://example.com/casting', '_blank');
    }
}

function openActorDetail(actorId) {
    if (tg?.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
    // Здесь можно добавить логику для открытия детальной информации об актере
    console.log('Opening actor detail:', actorId);
}

// Handle device back button
if (tg) {
    tg.onEvent('backButtonClicked', () => {
        if (currentScreen === 'taskDetailScreen') {
            goBackFromTask();
        } else if (currentScreen === 'projectDetailScreen') {
            goBack();
        }
    });
}

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('App initialized');

    // Set theme colors if available
    if (tg) {
        document.documentElement.style.setProperty('--tg-theme-bg-color', tg.themeParams.bg_color || '#ffffff');
        document.documentElement.style.setProperty('--tg-theme-text-color', tg.themeParams.text_color || '#000000');
        document.documentElement.style.setProperty('--tg-theme-hint-color', tg.themeParams.hint_color || '#999999');
        document.documentElement.style.setProperty('--tg-theme-link-color', tg.themeParams.link_color || '#007AFF');
        document.documentElement.style.setProperty('--tg-theme-button-color', tg.themeParams.button_color || '#007AFF');
        document.documentElement.style.setProperty('--tg-theme-secondary-bg-color', tg.themeParams.secondary_bg_color || '#f8f9fa');
    }
});