const PRE_TASKS = [
    { id: 'documents', name: 'Документы' },
    { id: 'storyboard', name: 'Раскадровка' },
    { id: 'ai', name: 'AI-генерации' },
    { id: 'casting', name: 'Кастинг' },
    { id: 'location', name: 'Локация' },
    { id: 'props', name: 'Реквизит' }
  ];
  
const POST_TASKS = [
    { id: 'editing', name: 'Монтаж' },
    { id: 'voice', name: 'Озвучка' },
    { id: 'color', name: 'Цветокоррекция' },
    { id: 'photo', name: 'Фотообработка' },
    { id: 'cg', name: 'CG' }
  ];
const STATUS_WEIGHTS = {
    'Утверждено': 1,
    'Согласовано': 1,
    'В работе': 0.3,
    'На доработке': 0.7,
    'Ждёт согласования⚠️': 0.5,
    // прочие статусы (null, Не определён и т.п.) считаем вес 0
  };

let projects = [];
let projectFiles = [];
let processedProjects = []; // статусы из LLM
let screenHistory = [];   
let currentScreen = 'projectListScreen';
let currentProject = null;

    // Загрузка данных из JSON
async function loadProjects() {
        try {
          const [projectsRes, statusRes, filesRes] = await Promise.all([
            fetch('projects_with_clients.json'),
            fetch('processed_projects.json'),
            fetch('output.json') // ваш JSON с Google Drive данными
          ]);
          
          projects = await projectsRes.json();
          processedProjects = await statusRes.json();
          projectFiles = await filesRes.json();
          
          renderProjectList();
        } catch (error) {
          console.error('Ошибка загрузки данных:', error);
        }
      }
function getTaskFiles(projectName, taskId) {
        const projectData = projectFiles.find(p => p.parentName === projectName);
        if (!projectData) return [];
      
        const mapping = {
          'storyboard': '01 - Script',
          'casting': '03 - Casting', 
          'location': '05 - Locations',
          'props': '06 - Props'
        };
      
        const folderKey = mapping[taskId];
        return projectData.projectContents[folderKey] || [];
      }
function getTaskStatus(projectName, taskId) {
        const processedProject = processedProjects.find(p => p.project_name === projectName);
        if (!processedProject || !processedProject[taskId]) {
          return { status: null, date: null };
        }
        return processedProject[taskId];
}
function getStatusClass(status) {
    if (!status) return 'status-unknown';
    
    const statusMap = {
      'Утверждено': 'status-approved',
      'В работе': 'status-in-progress',
      'На доработке': 'status-in-progress',
      'Ждёт согласования⚠️': 'status-in-approved'
    };
    
    return statusMap[status] || 'status-unknown';
  }
    // Рендер списка проектов
function renderProjectList() {
        const container = document.getElementById('projectsContainer');
        container.innerHTML = '';
        projects.forEach(proj => {
          const card = document.createElement('div');
          card.className = 'project-card';
          card.onclick = () => openProject(proj.project_id);
          card.innerHTML = `
            <div class="project-info">
              <h3>${proj.project_name}</h3>
              <p class="project-date">Дата съемки:</p>
            </div>
            <div class="project-arrow">
            <img src="/arrow-fold.png" alt="Перейти" class="project-arrow-icon" />
            </div>
          `;
          container.appendChild(card);
        });
      }

    // Открытие экрана проекта
function openProject(id) {
        const proj = projects.find(p => p.project_id === id);
        if (!proj) return;
        currentProject = proj;
        const preProgress = calculateProgress(proj.project_name, PRE_TASKS);
        const postProgress = calculateProgress(proj.project_name, POST_TASKS);
        document.getElementById('stageHeader').textContent = proj.project_name;
        document.getElementById('prePercent').textContent = `${preProgress}%`;
        document.getElementById('preProgressBar').style.width = `${preProgress}%`;
        document.getElementById('postPercent').textContent = `${postProgress}%`;
        document.getElementById('postProgressBar').style.width = `${postProgress}%`;
      
        renderPreTasks(proj);
        renderTasks(proj);
      
        // по умолчанию открыт pre, скрыт post? Или наоборот:
        document.getElementById('preTasksContainer').classList.remove('hidden');
        document.getElementById('tasksGrid').classList.remove('hidden');
        // установка кнопок
        document.getElementById('preCollapseBtn').textContent = '∧';
        document.getElementById('postCollapseBtn').textContent = '∨';
        
      
        navigateToScreen('projectDetailScreen');
      }

    // Рендер задач в зависимости от stage
// Рендер задач препродакшн
function renderPreTasks(proj) {
    const preGrid = document.getElementById('preTasksContainer');
    preGrid.innerHTML = '';
  
    PRE_TASKS.forEach(t => {
      const { status, date } = getTaskStatus(proj.project_name, t.id);
      const statusClass = getStatusClass(status);
      const card = document.createElement('div');
      card.className = 'task-card';
      card.setAttribute('data-status', statusClass);
      card.innerHTML = `
        <h3 style = 'font-family: 'TT Hoves Pro', sans-serif;'>${t.name}</h3>
        <p class="task-status ${statusClass}">
          ${status || 'Статус не определён'}
        </p>
        <p>
        ${date ? `<span style= class="task-date">${date}</span>` : ''}</p>`;
      preGrid.appendChild(card);
    });
  }
  
function renderTasks(proj) {
        const grid = document.getElementById('tasksGrid');
        grid.innerHTML = '';
      
        // Выбираем шаблон задач по стадии
        const tasksTemplate = proj.stage === 'препродакшн' ? PRE_TASKS : POST_TASKS;
      
        tasksTemplate.forEach(t => {
          const taskStatus = getTaskStatus(proj.project_name, t.id);
          const statusClass = getStatusClass(taskStatus.status);
          
          const card = document.createElement('div');
          card.className = 'task-card';
          card.setAttribute('data-status', statusClass);
          card.onclick = () => openTaskDetail(t.id);
          card.innerHTML = `
            <h3>${t.name}</h3>
            <p class="task-status ${statusClass}">
              ${taskStatus.status || 'Статус не определен'}
              ${taskStatus.date ? `<span class="task-date">${taskStatus.date}</span>` : ''}
            </p>
          `;
          grid.appendChild(card);
        });
      }

    // Навигация
    function navigateToScreen(id) {
        document.querySelector('.screen.active').classList.remove('active');
        screenHistory.push(currentScreen);
        document.getElementById(id).classList.add('active');
        currentScreen = id;
        // if (tg?.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
      }

      function goBack() {
        if (!screenHistory.length) return;
        const prev = screenHistory.pop();
        document.querySelector('.screen.active').classList.remove('active');
        document.getElementById(prev).classList.add('active');
        currentScreen = prev;
      }

      function toggleSection(which) {
        const preContainer = document.getElementById('preTasksContainer');
        const postContainer = document.getElementById('tasksGrid');
        const preBtn = document.getElementById('preCollapseBtn');
        const postBtn = document.getElementById('postCollapseBtn');
      
        if (which === 'pre') {
          preContainer.classList.toggle('hidden');
          preBtn.textContent = preContainer.classList.contains('hidden') ? '∨' : '∧';
        } else {
          postContainer.classList.toggle('hidden');
          postBtn.textContent = postContainer.classList.contains('hidden') ? '∨' : '∧';
        }
      }
function calculateProgress(projectName, taskList) {
        const totalTasks = taskList.length;
        // Максимальный суммарный вес = totalTasks * 1
        const maxWeight = totalTasks * 1;
      
        // Суммируем текущий вес по задачам
        const currentWeight = taskList.reduce((sum, task) => {
          const { status } = getTaskStatus(projectName, task.id);
          const weight = STATUS_WEIGHTS[status] ?? 0;
          return sum + weight;
        }, 0);
      
        // Процент = (текущий вес / макс. вес) * 100
        return Math.round((currentWeight / maxWeight) * 100);
      }
    // Загрузка и запуск
    document.addEventListener('DOMContentLoaded', loadProjects);