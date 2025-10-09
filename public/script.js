const PRE_TASKS = [
    { id: 'documents', name: 'Документы' },
    { id: 'storyboard', name: 'Раскадровка' },
    { id: 'ai', name: 'AI-генерации' },
    { id: 'casting', name: 'Кастинг' },
    { id: 'location', name: 'Локация' },
    { id: 'wardrobe', name: 'Костюмы' },
    { id: 'props', name: 'Реквизит' }
  ];
  
  const POST_TASKS = [
    { id: 'edit', name: 'Монтаж' },
    { id: 'sound', name: 'Озвучка' },
    { id: 'color', name: 'Цветокоррекция' },
    { id: 'cg', name: 'CG' }
  ];
const STATUS_WEIGHTS = {
    'Утверждено': 1,
    'В работе': 0.3,
    'На доработке': 0.3,
    'Ждёт согласования⚠️': 0.3,
  };
const STATUSES = [
    'Утверждено',
    'В работе',
    'На доработке',
    'Ждёт согласования⚠️'
];
let editMode = false;
const editedDates = new Map();
let projects = [];
let projectFiles = [];
let processedProjects = []; // статусы из LLM
let screenHistory = [];   
let currentScreen = 'projectListScreen';
let currentProject = null;

let editTaskMode = false;
let currentTaskId = null;
let currentProjectName = null;

document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupEditControls();
  });

  function setupEditControls() {
    // Кнопки для редактирования дат
    const editDatesBtn = document.getElementById('editDatesBtn');
    const saveDatesBtn = document.getElementById('saveDatesBtn');
    // Кнопки для редактирования задач
    const editTasksBtn = document.getElementById('editTasksBtn');
    const saveTasksBtn = document.getElementById('saveTasksBtn');
  
    const editTaskBtn = document.getElementById('editTaskBtn');
    const saveTaskBtn = document.getElementById('saveTaskBtn');
    // Проверяем, что элементы найдены
    if (!editDatesBtn || !saveDatesBtn) {
      console.error('Кнопки редактирования дат не найдены в DOM');
    }
    if (!editTasksBtn || !saveTasksBtn) {
      console.error('Кнопки редактирования задач не найдены в DOM');
    }
    if (!editTaskBtn || !saveTaskBtn) {
        console.error('Кнопки редактирования задачи не найдены');
        return;
      }
    // Режим редактирования дат
    editDatesBtn.addEventListener('click', () => {
      editMode = !editMode;
      saveDatesBtn.disabled = !editMode;
      renderProjectList();
    });
    saveDatesBtn.addEventListener('click', async () => {
      await saveProjectDates();
      editMode = false;
      saveDatesBtn.disabled = true;
      renderProjectList();
    });
  
    // Режим редактирования задач
    editTasksBtn.addEventListener('click', () => {
      editMode = !editMode;
      saveTasksBtn.disabled = !editMode;
      renderPreTasks(currentProject);
      renderTasks(currentProject);
    });
    saveTasksBtn.addEventListener('click', async () => {
      await saveTasksStatuses();
      editMode = false;
      saveTasksBtn.disabled = true;
      renderPreTasks(currentProject);
      renderTasks(currentProject);
    });

    editTaskBtn.addEventListener('click', () => {
        // Работает только для Локации
        if (!currentTaskId) return;
        editTaskMode = !editTaskMode;
        saveTaskBtn.disabled = !editTaskMode;
        renderTaskDetail(currentTaskId, currentProjectName);
      });
    
      saveTaskBtn.addEventListener('click', async () => {
        if (!currentTaskId) return;
        await saveTaskStatuses();
        editTaskMode = false;             // сбрасываем режим редактирования
        saveTaskBtn.disabled = true;
        renderTaskDetail(currentTaskId, currentProjectName);      
      });
  }
  
  async function saveTaskStatuses() {
    await fetch('/api/processed-projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processedProjects)
    });
  }
  async function saveTasksStatuses() {
    await fetch('/api/processed-projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processedProjects)
    });
  }
  
  
async function saveProjectDates() {
    try {

      editedDates.forEach((newDate, projectId) => {
        const project = projects.find(p => p.project_id === projectId);
        if (project) {
          project.shoot_date = newDate;
        }
      });
  
      // Отправляем обновленный массив проектов на сервер
      const res = await fetch('/api/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projects)
      });
  
      if (!res.ok) throw new Error('Network response was not ok');
      
      // Успешно сохранено
      editedDates.clear();
      editMode = false;
      
      document.getElementById('editModeBtn').disabled = false;
      document.getElementById('saveChangesBtn').disabled = true;
      
      renderProjectList();
            
    } catch (err) {
      console.error('Ошибка при сохранении дат:', err);
    }
  }
  
async function loadProjects() {
        try {
          const [projectsRes, statusRes, filesRes] = await Promise.all([
            fetch('projects_with_clients.json'),
            fetch('processed_projects.json'),
            fetch('output.json') 
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
          'props': '06 - Props',
          'wardrobe': '04 - Wardrobe',
          'edit': '07 - Edit',
          'cg': '08 - CG',
          'color': '09 - Color',
          'sound': '10 - Sound'
        };

        const folderKey = mapping[taskId];
        return projectData.projectContents[folderKey] || [];
      }
function getTaskStatus(projectName, taskId) {
        const proc = processedProjects.find(p => p.project_name === projectName) || {};
        return {
          status:  proc[taskId]?.status || null,
          date:    proc[taskId]?.date   || null,
          address: proc[taskId]?.address|| '',
          photo:   proc[taskId]?.photo   || '',
          photos:  proc[taskId]?.photos    || []     

        };
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
          
          // Получаем текущую дату (из editedDates или из проекта)
          const currentDate = editedDates.get(proj.project_id) || proj.shoot_date || '';
          
          let dateHTML;
          if (editMode) {
            // В режиме редактирования показываем input
            dateHTML = `
              <p class="project-date-label">Дата съемки:</p>
              <input type="date" 
                     class="date-input" 
                     value="${currentDate}" 
                     data-project-id="${proj.project_id}"
                     onclick="event.stopPropagation()">
            `;
          } else {
            // Обычный режим
            const displayDate = currentDate ? new Date(currentDate).toLocaleDateString('ru-RU') : 'Не указана';
            dateHTML = `<p class="project-date">Дата съемки: ${displayDate}</p>`;
            card.onclick = () => openProject(proj.project_id);
          }
      
          card.innerHTML = `
            <div class="project-info">
              <h3>${proj.project_name}</h3>
              ${dateHTML}
            </div>
            <div class="project-arrow">
              <img src="./logo/arrow-fold.png" alt="Перейти" class="project-arrow-icon" />
            </div>
          `;
      
          // Добавляем обработчик для input в режиме редактирования
          if (editMode) {
            const dateInput = card.querySelector('.date-input');
            dateInput.addEventListener('change', (e) => {
              editedDates.set(proj.project_id, e.target.value);
            });
          }
      
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
async function renderPreTasks(proj) {
    const preGrid = document.getElementById('preTasksContainer');
    preGrid.innerHTML = '';
  
    PRE_TASKS.forEach(t => {
      const ts = getTaskStatus(proj.project_name, t.id);
      const statusClass = getStatusClass(ts.status);
      const isWaiting = ts.status === 'Ждёт согласования⚠️';
  
      // Преобразуем дату для input
      const inputDateValue = ts.date
        ? new Date(ts.date.split('.').reverse().join('-')).toISOString().slice(0, 10)
        : '';
  
      // Общий блок статуса + даты
      let bodyHTML = '';
      if (editMode) {
        const statusOptions = STATUSES.map(s =>
          `<option value="${s}" ${s === ts.status ? 'selected' : ''}>${s}</option>`
        ).join('');
  
        bodyHTML += `
          <select class="status-select" data-task-id="${t.id}">
            <option value="">Не определён</option>
            ${statusOptions}
          </select>
          <input type="date"
                 class="date-input"
                 data-task-id="${t.id}"
                 value="${inputDateValue}">
        `;
      } else {
        // Обычный режим — текстовый статус + дата
        bodyHTML += `
          <p class="task-status ${statusClass}">
            ${ts.status || 'Не определён'}
          </p>
          ${ts.date ? `<span class="task-date${isWaiting?' date-waiting':''}">
                         ${isWaiting?'ДО ':''}${ts.date}
                       </span>` : ''}
        `;
      }
  
      // Собираем карточку
      const card = document.createElement('div');
      card.className = 'task-card';
      card.innerHTML = `<h3>${t.name}</h3>${bodyHTML}`;
  
      // В обычном режиме кликабельно
      if (!editMode) {
        card.onclick = () => openTaskDetail(t.id, t.name, proj.project_name);
      }
  
      preGrid.appendChild(card);
    });
  
    // После вставки всех карточек навешиваем слушатели
    if (editMode) {
      // Статус и дата
      preGrid.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', e => {
          const taskId = e.target.dataset.taskId;
          const newStatus = e.target.value || null;
          const newDate = newStatus ? new Date().toLocaleDateString('ru-RU') : null;
          updateProcessedProject(currentProject.project_name, taskId, {
            status: newStatus,
            date: newDate
          });
        });
      });
      preGrid.querySelectorAll('.date-input').forEach(inp => {
        inp.addEventListener('change', e => {
          const taskId = e.target.dataset.taskId;
          const newDate = e.target.value
            ? new Date(e.target.value).toLocaleDateString('ru-RU')
            : null;
          updateProcessedProject(currentProject.project_name, taskId, { date: newDate });
        });
      });
      // Фото для кастинга — добавление
      const castInput = preGrid.querySelector('.casting-photo-input');
      if (castInput) {
        castInput.addEventListener('change', async e => {
          const files = Array.from(e.target.files).slice(0, 5);
          const base64s = await Promise.all(files.map(f => new Promise(res => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(f);
          })));
          const existing = getTaskStatus(currentProject.project_name, 'casting').photos;
          updateProcessedProject(currentProject.project_name, 'casting', {
            photos: existing.concat(base64s).slice(0, 5)
          });
          renderPreTasks(currentProject);
        });
      }
    }
  }
  
  
  // Расширяем updateProcessedProject для поддержки address
  function updateProcessedProject(projectName, taskId, updates) {
    let projObj = processedProjects.find(p => p.project_name === projectName);
    if (!projObj) {
      projObj = { project_name: projectName };
      processedProjects.push(projObj);
    }
    const existing = projObj[taskId] || {};
  
    projObj[taskId] = {
      // сохраняем старые или применяем новые значения
      status:  updates.status  !== undefined ? updates.status  : existing.status,
      date:    updates.date    !== undefined ? updates.date    : existing.date,
      address: updates.address !== undefined ? updates.address : existing.address,
      photo:   updates.photo   !== undefined ? updates.photo   : existing.photo,
      photos:  updates.photos  !== undefined ? updates.photos  : existing.photos || []
    };
  }
  
  
  function openTaskDetail(taskId, taskName, projectName) {
    console.log('Открываем задачу:', taskId, taskName, projectName);
  
    // Получаем файлы для этой задачи
    const files = getTaskFiles(projectName, taskId);
  
    // Элементы экрана
    const titleEl    = document.getElementById('taskDetailTitle');
    const deadlineEl = document.getElementById('taskDeadline');
    const linksEl    = document.getElementById('taskLinks');
  
    if (!titleEl || !linksEl) {
      console.error('Не найдены элементы экрана деталей задачи');
      return;
    }
  
    // Устанавливаем заголовок
    titleEl.textContent = taskName;
  
    // Устанавливаем дедлайн (для простоты показываем дату статуса)
    const { date } = getTaskStatus(projectName, taskId);
    if (deadlineEl) {
      if (date) {
        deadlineEl.textContent = `Дедлайн: ${date}`;
        deadlineEl.style.display = 'block';
      } else {
        deadlineEl.style.display = 'none';
      }
    }
    let lowerName = taskName.charAt(0).toLowerCase() + taskName.slice(1);
    if (lowerName === 'раскадровка') {
    lowerName = 'сториборд';
    }
    if (lowerName === 'цветокоррекция') {
        lowerName = 'цветокоррекцию';
        }
    if (lowerName === 'озвучка') {
        lowerName = 'озвучку';
        }
    if (lowerName === 'cG') {
        lowerName = 'CG';
        }
    // Очищаем контейнер и рендерим ссылки
    linksEl.innerHTML = '';
    if (files.length === 1) {
      files.forEach(file => {
        const linkCard = document.createElement('a');
        linkCard.className = 'link-card';
        linkCard.href = file.webViewLink;
        linkCard.target = '_blank';
        linkCard.rel = 'noopener noreferrer';
        linkCard.innerHTML = `<p class="link-text">Ссылка на ${lowerName}</p>`;
        linksEl.appendChild(linkCard);
      });
    } else if (files.length > 1){
        linksEl.innerHTML = `
    <p style="color:#E94444; text-align:center;">
      Ошибка, невозможно получить файлы
    </p>
  `;
    } else {
      linksEl.innerHTML = '<p style="color: #999; text-align: center;">Файлы не найдены</p>';
    }
    currentTaskId = taskId;
    currentProjectName = projectName;
    renderTaskDetail(taskId, projectName);
    // Переходим на экран деталей задачи
    navigateToScreen('taskDetailScreen');
  }
  function renderTaskDetail(taskId, projectName) {
    const { date, address, photo, photos = [] } = getTaskStatus(projectName, taskId);
    const titleEl    = document.getElementById('taskDetailTitle');
    const deadlineEl = document.getElementById('taskDeadline');
    const linksEl    = document.getElementById('taskLinks');
  
    // Устанавливаем заголовок задачи
    const taskMeta = [...PRE_TASKS, ...POST_TASKS].find(t => t.id === taskId);
    titleEl.textContent = taskMeta ? taskMeta.name : 'Задача';
  
    // Дата
    if (date) {
      deadlineEl.textContent = `Дедлайн: ${date}`;
      deadlineEl.style.display = 'block';
    } else {
      deadlineEl.style.display = 'none';
    }
    let lowerName = taskMeta.name
    lowerName = lowerName.charAt(0).toLowerCase() + lowerName.slice(1);
    if (lowerName === 'раскадровка') {
    lowerName = 'сториборд';
    }
    if (lowerName === 'цветокоррекция') {
        lowerName = 'цветокоррекцию';
        }
    if (lowerName === 'озвучка') {
        lowerName = 'озвучку';
        }
    if (lowerName === 'cG') {
        lowerName = 'CG';
        }
    // Определяем контейнер ссылок/контента
    linksEl.innerHTML = '';
    
    // Для всех остальных задач — ссылки на файлы
    const files = getTaskFiles(projectName, taskId);
    if (files.length === 1) {
      files.forEach(file => {
        const a = document.createElement('a');
        a.href = file.webViewLink;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'link-card';
        a.innerHTML = `<p class="link-text">Ссылка на ${lowerName}</p>`;
        linksEl.appendChild(a);
      });
    } else if (files.length > 1){
        linksEl.innerHTML = `
    <p style="color:#E94444; text-align:center;">
      Ошибка⚠️ Невозможно получить файлы
    </p>
  `;
    } else {
        if ((taskMeta.name != 'Кастинг') && (taskMeta.name != 'Локация')){
            linksEl.innerHTML = '<p style="color:#999;text-align:center;">Файлы не найдены</p>';
        }
    }
  
    // Если это Локация — отображаем адрес и одно фото
    if (taskId === 'location') {
      const container = document.createElement('div');
      container.className = 'location-container';
      // Адрес
      container.innerHTML = `<label>Адрес:</label>`;
      if (editTaskMode) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'address-input';
        inp.value = address;
        inp.placeholder = 'Введите адрес';
        inp.addEventListener('input', e =>
          updateProcessedProject(projectName, taskId, { address: e.target.value })
        );
        container.appendChild(inp);
      } else if (address) {
        const p = document.createElement('p');
        p.className = 'task-address';
        p.textContent = address;
        container.appendChild(p);
      }
      
      // Фото
      container.insertAdjacentHTML('beforeend', '<label>Фото:</label>');
      const photoBlock = document.createElement('div');
      photoBlock.className = 'photo-block';
      const preview = document.createElement('img');
      preview.className = 'photo-preview';
      if (photo) preview.src = photo;
      photoBlock.appendChild(preview);

      if (editTaskMode) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'photo-delete-btn';
        delBtn.textContent = '×';
        delBtn.addEventListener('click', () => {
          updateProcessedProject(projectName, taskId, { photo: '' });
          renderTaskDetail(taskId, projectName);
        });
        photoBlock.appendChild(delBtn);
  
        const fileInp = document.createElement('input');
        fileInp.type = 'file';
        fileInp.accept = 'image/*';
        fileInp.addEventListener('change', e => {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = () => {
            updateProcessedProject(projectName, taskId, { photo: reader.result });
            renderTaskDetail(taskId, projectName);
          };
          reader.readAsDataURL(file);
        });
        container.appendChild(fileInp);
      }
  
      container.appendChild(photoBlock);
      linksEl.appendChild(container);
    }
    if (taskId === 'casting') {
        // Контейнер кастинга
        const container = document.createElement('div');
        container.className = 'casting-detail-container';
        
        // Заголовок всегда
        container.innerHTML = `<h3>Фото согласованных актёров</h3>`;
      
        // Превью фото (всегда)
        if (photos.length > 0) {
          const previewsHtml = photos.map((src, i) => {
            const removeBtn = editTaskMode 
              ? `<button type="button" class="photo-remove-btn" data-index="${i}">×</button>`
              : '';
            return `
              <div class="photo-preview-block">
                <img src="${src}" class="photo-preview"/>
                ${removeBtn}
              </div>
            `;
          }).join('');
          container.insertAdjacentHTML('beforeend', `
            <div class="casting-photos-container">${previewsHtml}</div>
          `);
        } else {
          container.insertAdjacentHTML('beforeend', `
            <p style="color:#999;">Фото не загружены</p>
          `);
        }
      
        // Кнопки и input только в режиме редактирования
        if (editTaskMode) {
          container.insertAdjacentHTML('beforeend', `
            <button id="addCastingPhotosBtn">Добавить фото</button>
            <input type="file" accept="image/*" id="castingPhotoInput" multiple style="display:none">
          `);
        }
      
        linksEl.appendChild(container);
      
        // Навешиваем слушатели (только если editTaskMode)
        if (editTaskMode) {
          const input = document.getElementById('castingPhotoInput');
          const addBtn = document.getElementById('addCastingPhotosBtn');
      
          addBtn.addEventListener('click', () => input.click());
      
          input.addEventListener('change', async e => {
            const files = Array.from(e.target.files).slice(0,5);
            const base64s = await Promise.all(files.map(f => new Promise(res => {
              const r = new FileReader();
              r.onload = () => res(r.result);
              r.readAsDataURL(f);
            })));
            const existing = [...getTaskStatus(projectName,'casting').photos];
            updateProcessedProject(projectName,'casting',{
              photos: existing.concat(base64s).slice(0,5)
            });
            renderTaskDetail(taskId, projectName);
          });
      
          container.querySelectorAll('.photo-remove-btn').forEach(btn => {
            btn.addEventListener('click', e => {
              const idx = +e.target.dataset.index;
              const arr = [...getTaskStatus(projectName,'casting').photos];
              arr.splice(idx,1);
              updateProcessedProject(projectName,'casting',{ photos: arr });
              renderTaskDetail(taskId, projectName);
            });
          });
        }
      
        return;
      }}
      
  
  function renderTasks(proj) {
    const grid = document.getElementById('tasksGrid');
    grid.innerHTML = '';
  
    const tasksTemplate = proj.stage === 'препродакшн' ? PRE_TASKS : POST_TASKS;
  
    tasksTemplate.forEach(t => {
      const { status, date } = getTaskStatus(proj.project_name, t.id);
      const statusClass = getStatusClass(status);
  
      const card = document.createElement('div');
      card.className = 'task-card';
  
      let statusHTML;
      if (editMode) {
        // режим редактирования — селект
        const options = STATUSES.map(s =>
          `<option value="${s}" ${s === status ? 'selected' : ''}>${s}</option>`
        ).join('');
        statusHTML = `
          <select class="status-select" data-task-id="${t.id}">
            ${options}
          </select>
        `;
      } else {
        // обычный режим — параграф
        statusHTML = `
          <p class="task-status ${statusClass}">
            ${status || 'Не определён'}
          </p>
        `;
      }
  
      card.innerHTML = `
        <h3>${t.name}</h3>
        ${statusHTML}
        ${date ? `<span class="task-date">${date}</span>` : ''}
      `;
  
      // Открытие карточки только в обычном режиме
      if (!editMode) {
        card.onclick = () => openTaskDetail(t.id, t.name, proj.project_name);
      }
  
      grid.appendChild(card);
    });
  
    // Вешаем слушатели на селекты только в режиме редактирования
    if (editMode) {
      grid.querySelectorAll('.status-select').forEach(sel => {
        sel.addEventListener('change', e => {
          const taskId = e.target.dataset.taskId;
          const newStatus = e.target.value;
          const newDate = newStatus ? new Date().toLocaleDateString('ru-RU') : null;
          let projObj = processedProjects.find(p => p.project_name === proj.project_name);
          if (!projObj) {
            projObj = { project_name: proj.project_name };
            processedProjects.push(projObj);
          }
          projObj[taskId] = { status: newStatus, date: newDate };
        });
      });
    }
  }
  
  function enableStatusEdit(el, projectName, taskId) {
    // Текущий текст
    const current = el.textContent.trim() === 'Статус не определён' ? null : el.textContent.trim();
  
    // Создаём <select>
    const select = document.createElement('select');
    STATUSES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s ?? '';
      opt.textContent = s ?? 'Статус не определён';
      if (s === current) opt.selected = true;
      select.appendChild(opt);
    });
  
    // При потере фокуса или Enter — сохраняем
    select.onblur = () => saveStatusEdit(select, el, projectName, taskId);
    select.onkeydown = e => {
      if (e.key === 'Enter') {
        select.blur();
      }
    };
  
    // Заменяем <p> на <select> и фокусируем
    el.replaceWith(select);
    select.focus();
  }
  function saveStatusEdit(select, originalP, projectName, taskId) {
    const newStatus = select.value || null;
    const date = newStatus ? new Date().toLocaleDateString('ru-RU') : null;
  
    // Обновляем локальный массив
    const proj = processedProjects.find(p => p.project_name === projectName);
    if (!proj) {
      // Если проекта ещё нет в processedProjects — создаём
      processedProjects.push({ project_name: projectName, [taskId]: { status: newStatus, date } });
    } else {
      proj[taskId] = { status: newStatus, date };
    }
  
    // Создаём обновлённый <p>
    const statusClass = getStatusClass(newStatus);
    const p = document.createElement('p');
    p.className = `task-status ${statusClass}`;
    p.ondblclick = () => enableStatusEdit(p, projectName, taskId);
    p.textContent = newStatus || 'Статус не определён';
  
    // Если нужна дата рядом
    if (date) {
      const span = document.createElement('span');
      span.className = 'task-date';
      span.textContent = date;
      p.appendChild(span);
    }
  
    // Заменяем <select> обратно на <p>
    select.replaceWith(p);
  
    // Отправляем на сервер или сохраняем локально
    persistProcessedProjects();
  }
async function persistProcessedProjects() {
    try {
      const res = await fetch('/api/processed-projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processedProjects)
      });
      if (!res.ok) throw new Error('Network response was not ok');
      console.log('Статусы сохранены на сервере');
    } catch (err) {
      console.error('Ошибка при сохранении на сервер:', err);
    }
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