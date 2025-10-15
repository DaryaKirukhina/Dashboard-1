const tg = window.Telegram.WebApp;
const currentTgId = 489599665//parseInt(tg.initDataUnsafe.user.id, 10);
let admin = 489599665;
console.log('Using Telegram ID:', currentTgId);
//добавила в гит
async function shouldShowOnboarding(tgId) {
    const resClient = await fetch('/api/check-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegram_id: tgId })
    });
    const { exists: clientExists, client_id } = await resClient.json();
    if (!clientExists) return false;
  
    const resSettings = await fetch('/api/check-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id })
    });
    const { exists: settingsExists } = await resSettings.json();
    return !settingsExists;
  }

function filterProjectsByUser(allProjects, tgId) {
    console.log('работает функция filterProjectsByUser')
    return allProjects.filter(p => {
      if (p.producer_id?.producer_tg_chat_id === tgId) return true;
      if (p.client1?.client_chat_id === tgId) return true;
      if (p.client2?.client_chat_id === tgId) return true;
      if (p.client3?.client_chat_id === tgId) return true;
      if (p.producer2?.producer_tg_chat_id === tgId) return true;
      if (p.producer3?.producer_tg_chat_id === tgId) return true;
      return false;
    });
  }

let editDatesBtn, saveDatesBtn, editTasksBtn, saveTasksBtn, editTaskBtn, saveTaskBtn;
let isProducer = false, isClient = false;
let editMode = false, editTaskMode = false;

async function loadProjects() {
    console.log('работает фнукция loadProjects')
    const [projectsRes, statusRes, filesRes] = await Promise.all([
        fetch('projects_with_clients.json'),
        fetch('processed_projects.json'),
        fetch('output.json')
    ]);
  
    const allProjects = await projectsRes.json();
    processedProjects = await statusRes.json();
    projectFiles = await filesRes.json();
    if (currentTgId === admin) {
        projects = allProjects;
      } else {
        projects = filterProjectsByUser(allProjects, currentTgId);
      }
  
    isProducer = currentTgId === admin || allProjects.some(p =>
        p.producer_id?.producer_tg_chat_id === currentTgId ||
        p.producer2?.producer_tg_chat_id === currentTgId ||
        p.producer3?.producer_tg_chat_id === currentTgId
      );
      isClient = currentTgId === admin || allProjects.some(p =>
        p.client1?.client_chat_id === currentTgId ||
        p.client2?.client_chat_id === currentTgId ||
        p.client3?.client_chat_id === currentTgId
      );
      console.log('User isProducer:', isProducer, 'isClient:', isClient);
  
    renderProjectList();
  }
  

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
const editedDates = new Map();
let projects = [];
let projectFiles = [];
let processedProjects = []; // статусы из LLM
let screenHistory = [];   
let currentScreen = 'projectListScreen';
let currentProject = null;

let currentTaskId = null;
let currentProjectName = null;

function initCustomDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
      const newDropdown = dropdown.cloneNode(true);
      dropdown.parentNode.replaceChild(newDropdown, dropdown);
  
      const trigger = newDropdown.querySelector('.dropdown-trigger');
      const menu = newDropdown.querySelector('.dropdown-menu');
      const selectedValue = newDropdown.querySelector('.selected-value');
      const name = newDropdown.dataset.name;
  
      // По умолчанию отмечаем первый элемент
      const firstItem = menu.querySelector('li');
      if (firstItem && !menu.querySelector('li.selected')) {
        firstItem.classList.add('selected');
        selectedValue.textContent = firstItem.textContent;
        data[name] = firstItem.dataset.value;
      }
  
      trigger.addEventListener('click', e => {
        e.stopPropagation();
        document.querySelectorAll('.custom-dropdown').forEach(d => {
          if (d !== newDropdown) d.classList.remove('open');
        });
        newDropdown.classList.toggle('open');
      });
  
      menu.addEventListener('click', e => {
        if (e.target.tagName === 'LI') {
          const item = e.target;
          menu.querySelectorAll('li').forEach(i => i.classList.remove('selected'));
          item.classList.add('selected');
          selectedValue.textContent = item.textContent;
          data[name] = item.dataset.value;
          newDropdown.classList.remove('open');
        }
      });
  
      document.addEventListener('click', e => {
        if (!newDropdown.contains(e.target)) {
          newDropdown.classList.remove('open');
        }
      });
    });
  }
  
  function fillConfirmation() {
    const list = document.querySelector('.confirmation-list');
    list.innerHTML = '';
  
    const items = [
      {
        icon: '📊',
        title: 'Частота статусов',
        getValue: () => {
          if (data.frequency === 'daily') return 'Каждый день в ' + (data.time || '12:00');
          if (data.frequency === 'weekly') {
            const days = data.days ? data.days.join(', ') : '';
            return `Несколько раз в неделю (${days}) в ${data.time || '12:00'}`;  
          }
          return '';
        }
      },
      {
        icon: '📝',
        title: 'Формат статусов',
        getValue: () => data.format === 'short' ? 'Краткий' : 'Подробный'
      },
      {
        icon: '⚡',
        title: 'Время ответа (рабочие часы)',
        getValue: () => {
          const times = {
            '15min': '15 минут',
            '30min': '30 минут', 
            '1hour': '1 час'
          };
          return times[data.responseTimeWork] || '';
        }
      },
      {
        icon: '🌙',
        title: 'Время ответа (нерабочие часы)',
        getValue: () => {
          const times = {
            '30min': '30 минут',
            '1hour': '1 час',
            'nextDay': 'на следующий рабочий день'
          };
          return times[data.responseTimeOff] || '';
        }
      },
      {
        icon: '🎯',
        title: 'Писать в выходные',
        getValue: () => {
          const options = {
            'urgent': 'Да, если срочно',
            'no': 'Лучше не писать'
          };
          return options[data.weekend] || '';
        }
      },
      {
        icon: '✅',
        title: 'Время на согласование',
        getValue: () => {
          const times = {
            '24h': '24 часа',
            '48h': '48 часов',
            'day': 'В течение дня'
          };
          return times[data.approvalTime] || '';
        }
      },
      {
        icon: '🔕',
        title: 'Не беспокоить',
        getValue: () => `с ${data.quietFrom || '22:00'} до ${data.quietTo || '09:30'}`
      },
      {
        icon: '🧪',
        title: 'Бета-тестирование',
        getValue: () => {
          const options = {
            'yes': 'Конечно, с удовольствием',
            'later': 'Возможно, обсудим позже',
            'no': 'Пока нет'
          };
          return options[data.testing] || '';
        }
      }
    ];
  
    items.forEach(item => {
      const value = item.getValue();
      if (value) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'confirmation-item';
        itemDiv.innerHTML = `
          <div class="item-icon">${item.icon}</div>
          <div class="item-content">
            <div class="item-title">${item.title}</div>
            <div class="item-value">${value}</div>
          </div>
        `;
        list.appendChild(itemDiv);
      }
    });
  }
  const responseCodeToMin = {
    '15min': 15,
    '30min': 30,
    '1hour': 60,
    'nextDay': 24 * 60
  };
  function prepareDbRow(data) {
    const workMin = responseCodeToMin[data.responseTimeWork] ?? 0;
    const offMin  = responseCodeToMin[data.responseTimeOff]  ?? 0;
  
    const freqTimeMsk = toMoscowTime(data.time);
    const quietFromMsk = toMoscowTime(data.quietFrom);
    const quietToMsk   = toMoscowTime(data.quietTo);
  
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  
    return {
      client_id: currentTgId,
      status_frequency_day: data.frequency === 'daily' ? 'daily' : data.days.join(','),
  
      status_frequency_time: `${freqTimeMsk}`,
  
      timezone: tz,
  
      format_status: data.format === 'short' ? 'короткий' : 'подробный',
  
      response_time_work: workMin,
      response_time_off: offMin,
  
      weekend: data.weekend,
      testing: data.testing,
  
      quiet_from: `${quietFromMsk}`,
      quiet_to:   `${quietToMsk}`,
  
      approval_time: data.approvalTime  // текстово, например '24h'
    };
  }
function toMoscowTime(hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    let total = h * 60 + m + deltaMin;
    total = (total % 1440 + 1440) % 1440;
    const rh = String(Math.floor(total / 60)).padStart(2,'0');
    const rm = String(total % 60).padStart(2,'0');
    return `${rh}:${rm}`;
  }
  async function sendOnboardingData(row) {
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(row)
      });
      if (!res.ok) {
        throw new Error(`Ошибка сервера: ${res.status}`);
      }
      const result = await res.json();
      console.log('Сервер вернул:', result);
    } catch (err) {
      console.error('Не удалось отправить данные:', err);
    }
  }
  
const userOffsetMin = new Date().getTimezoneOffset();
const mskOffsetMin = -3 * 60;
const deltaMin = mskOffsetMin - userOffsetMin;

let data = {};
let currentStep = 0;
let steps = [];
document.addEventListener('DOMContentLoaded', async () => {
    tg.expand();
    setupEditControls();
    const showOnboard = await shouldShowOnboarding(currentTgId);
    if (showOnboard) {
    steps = Array.from(document.querySelectorAll('.onboarding-step'));

      const shortExample = `
      <p style="color:#A6A6A6; font-size: 13px;">Пример статуса:</p>
      <ul>
        <li>📍 Документы — утверждено 01.09.</li>
        <li>📍 Кастинг — в работе до 04.09.</li>
        <li>📍 Локации — ждёт согласования до 05.09.</li>
      </ul>
    `;
    const detailedExample = `
  <p style="color:#A6A6A6; font-size: 13px;">Пример статуса:</p>
  <p>Наши процессы</p>
  <div>
    <div class="li1">
        <span>📍</span>
        <span>Документы</span>
    </div>
    <p class="p2">Идет процесс согласования договора с клиентом.</p>
  </div>
    <div>
    <div class="li1">
        <span>📍</span>
        <span>Сториборд</span>
    </div>
    <p class="p2">Ждем финальное утверждение с клиентом сегодня.</p>
  </div>
    <div>
    <div class="li1">
        <span>📍</span>
        <span>Кастинг</span>
    </div>
    <p class="p2">Запустили сбор второй волны кастинга, пришлем 01.09 утром, ОС будем ждать 01.09 до вечера. Коллбек планируем на 02.09.</p>
  </div>
    <div>
    <div class="li1">
        <span>📍</span>
        <span>Костюм</span>
    </div>
    <p class="p2">Обновленный мудборд пришлем сегодня, ОС ждем завтра 29.08.</p>
  </div>
    <div>
    <div class="li1">
        <span>📍</span>
        <span>Декорации/локации</span>
    </div>
    <p class="p2">Продолжаем поиск локаций. Скаут — завтра 29.08. После — отправим варианты на согласование. Идеально получить ОС в день скаута (29.08), чтобы художник мог проработать эскизы в выходные. Если не получится — ждем ОС 01.09 (пн).</p>
  </div>
    <div>
    <div class="li1">
        <span>📍</span>
        <span>Эскизы и реквизит</span>
    </div>
    <p class="p2">Бриф дадим в день согласования локаций. Эскизы готовим до вечера 02.09 и отправляем первую версию. ОС по эскизам ждем 03.09.</p>
  </div>
    <div>
    <div class="li1">
        <span>📍</span>
        <span>AI-сцена</span>
    </div>
    <p class="p2">Начнем после утверждения локации, чтобы совпали материалы. Планируем закончить сцену к съемке — 10.09. Смету по зимней сцене пришлем сегодня.</p>
  </div>
`;
    const showStep = idx => {
      steps.forEach((s, i) => {
        s.classList.toggle('active', i === idx);
      });
  
      if (idx === 1) {
        const radios = document.querySelectorAll('input[name="frequency"]');
        const weekdays = document.querySelector('.weekdays');
        weekdays.style.display = 'none';
  
        radios.forEach(radio => {
          radio.addEventListener('change', () => {
            if (radio.value === 'weekly' && radio.checked) {
              weekdays.style.display = 'flex';
            } else if (radio.value === 'daily' && radio.checked) {
              weekdays.style.display = 'none';
            }
          });
        });
      }
  
      if (idx === 2) {
        const formatOptions = steps[2].querySelectorAll('.format-option');
        const exampleBox = steps[2].querySelector('.example-box');
        exampleBox.innerHTML = shortExample;
      
        formatOptions.forEach(opt => {
          const clone = opt.cloneNode(true);
          opt.parentNode.replaceChild(clone, opt);
        });
      
        const newFormatOptions = steps[2].querySelectorAll('.format-option');
        newFormatOptions.forEach(option => {
          option.addEventListener('click', () => {
            newFormatOptions.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
      
            const value = option.dataset.value;
            exampleBox.innerHTML = value === 'detailed' ? detailedExample : shortExample;
          });
        });
      
        if (data.format) {
          const savedOption = steps[2].querySelector(`.format-option[data-value="${data.format}"]`);
          if (savedOption) {
            newFormatOptions.forEach(o => o.classList.remove('active'));
            savedOption.classList.add('active');
            exampleBox.innerHTML = data.format === 'detailed' ? detailedExample : shortExample;
          }
        }
      }
      if (idx === 3) {
        initCustomDropdowns();
        if (data.responseTimeWork) {
          const workDropdown = steps[3].querySelector('[data-name="responseTimeWork"]');
          const workMenu = workDropdown.querySelector('.dropdown-menu');
          const workItem = workMenu.querySelector(`li[data-value="${data.responseTimeWork}"]`);
          if (workItem) {
            workMenu.querySelectorAll('li').forEach(i => i.classList.remove('selected'));
            workItem.classList.add('selected');
            workDropdown.querySelector('.selected-value').textContent = workItem.textContent;
          }
        }
      
        if (data.responseTimeOff) {
          const offDropdown = steps[3].querySelector('[data-name="responseTimeOff"]');
          const offMenu = offDropdown.querySelector('.dropdown-menu');
          const offItem = offMenu.querySelector(`li[data-value="${data.responseTimeOff}"]`);
          if (offItem) {
            offMenu.querySelectorAll('li').forEach(i => i.classList.remove('selected'));
            offItem.classList.add('selected');
            offDropdown.querySelector('.selected-value').textContent = offItem.textContent;
          }
        }
      }
      if (idx === 6) {
        initCustomDropdowns();
      
        // Восстановление состояния
        if (data.quietFrom) {
          const fromDropdown = steps[6].querySelector('[data-name="quietFrom"]');
          const fromMenu = fromDropdown.querySelector('.dropdown-menu');
          const fromItem = fromMenu.querySelector(`li[data-value="${data.quietFrom}"]`);
          if (fromItem) {
            fromMenu.querySelectorAll('li').forEach(i => i.classList.remove('selected'));
            fromItem.classList.add('selected');
            fromDropdown.querySelector('.selected-value').textContent = fromItem.textContent;
          }
        }
      
        if (data.quietTo) {
          const toDropdown = steps[6].querySelector('[data-name="quietTo"]');
          const toMenu = toDropdown.querySelector('.dropdown-menu');
          const toItem = toMenu.querySelector(`li[data-value="${data.quietTo}"]`);
          if (toItem) {
            toMenu.querySelectorAll('li').forEach(i => i.classList.remove('selected'));
            toItem.classList.add('selected');
            toDropdown.querySelector('.selected-value').textContent = toItem.textContent;
          }
        }
      }
    };
  
    const collectData = idx => {
        if (idx === 0) return;
      
        if (idx === 2) {
          const activeFormat = steps[2].querySelector('.format-option.active');
          if (activeFormat) {
            data.format = activeFormat.dataset.value;
          }
      
          const skipCheckbox = steps[2].querySelector('#skipDirections');
          if (skipCheckbox) {
            data.skipDirections = skipCheckbox.checked ? 'true' : 'false';
          }
          return;
        }
      
        // Сбор данных из кастомных дропдаунов
        if (idx === 3) {
          const workDropdown = steps[3].querySelector('[data-name="responseTimeWork"]');
          const workSelected = workDropdown.querySelector('.dropdown-menu li.selected');
          if (workSelected) {
            data.responseTimeWork = workSelected.dataset.value;
          }
      
          const offDropdown = steps[3].querySelector('[data-name="responseTimeOff"]');
          const offSelected = offDropdown.querySelector('.dropdown-menu li.selected');
          if (offSelected) {
            data.responseTimeOff = offSelected.dataset.value;
          }
          return;
        }
      
        if (idx === 6) {
          const fromDropdown = steps[6].querySelector('[data-name="quietFrom"]');
          const fromSelected = fromDropdown.querySelector('.dropdown-menu li.selected');
          if (fromSelected) {
            data.quietFrom = fromSelected.dataset.value;
          }
      
          const toDropdown = steps[6].querySelector('[data-name="quietTo"]');
          const toSelected = toDropdown.querySelector('.dropdown-menu li.selected');
          if (toSelected) {
            data.quietTo = toSelected.dataset.value;
          }
          return;
        }
      
        // Обычные input/select элементы
        steps[idx].querySelectorAll('input, select').forEach(el => {
          if (el.type === 'radio' && !el.checked) return;
          if (el.type === 'checkbox') {
            data[el.name] = data[el.name] || [];
            if (el.checked) data[el.name].push(el.value);
          } else {
            data[el.name] = el.value;
          }
        });
      };      
  
    document.body.addEventListener('click', e => {
      if (e.target.matches('.btn-next')) {
        if (currentStep === 0) {
          currentStep = 1;
          showStep(currentStep);
          return;
        }
        if (currentStep === steps.length - 2) {
          collectData(currentStep);
          console.log(data)
          const row = prepareDbRow(data);
          console.log('Для вставки в БД:', row);
          sendOnboardingData(row);
          currentStep++;
          showStep(currentStep);
          setTimeout(() => {
            document.getElementById('onboarding').style.display = 'none';
            document.getElementById('projectListScreen').style.display = 'block';
            loadProjects();
          }, 1000);
          return;
        }
        collectData(currentStep);
        currentStep++;
        showStep(currentStep);
        if (currentStep === steps.length - 2) {
          fillConfirmation();
        }
      }
      if (e.target.matches('.btn-prev')) {
        if (currentStep > 1) {
          currentStep--;
          showStep(currentStep);
        }
      }
    });
    console.log(data);
    showStep(0);}
    else{
        document.getElementById('projectListScreen').style.display = 'block'
        loadProjects();
    }
  });
  
console.log('Visible projects for user', currentTgId, projects);
function setupEditControls() {
    console.log('работает фнукция setupEditControls')
    editDatesBtn = document.getElementById('editDatesBtn');
    saveDatesBtn = document.getElementById('saveDatesBtn');
    editTasksBtn = document.getElementById('editTasksBtn');
    saveTasksBtn = document.getElementById('saveTasksBtn');
    editTaskBtn  = document.getElementById('editTaskBtn');
    saveTaskBtn  = document.getElementById('saveTaskBtn');
    if (isProducer) {
        editDatesBtn.style.display = ''
        saveDatesBtn.style.display = ''
        editTasksBtn.style.display = '';
        saveTasksBtn.style.display = '';
        editTaskBtn.style.display = '';
        saveTaskBtn.style.display = '';
    } else {
        editDatesBtn.style.display = 'none'
        saveDatesBtn.style.display = 'none'
        editTasksBtn.style.display = 'none';
        saveTasksBtn.style.display = 'none';
        editTaskBtn.style.display = 'none';
        saveTaskBtn.style.display = 'none';
    }
    editDatesBtn.addEventListener('click', () => {
      if (!isProducer) return;
      editMode = true;
      saveDatesBtn.disabled = false;
      editDatesBtn.disabled = true;
      renderProjectList();
    });
    saveDatesBtn.addEventListener('click', async () => {
      if (!isProducer) return;
      await saveProjectDates();
      editMode = false;
      editDatesBtn.disabled = false;
      saveDatesBtn.disabled = true;
      renderProjectList();
    });
    editTasksBtn.addEventListener('click', () => {
      if (!isProducer) return;
      editMode = !editMode;
      saveTasksBtn.disabled = false;
      editTasksBtn.disabled = true;
      renderPreTasks(currentProject);
      renderTasks(currentProject);
    });
    saveTasksBtn.addEventListener('click', async () => {
      if (!isProducer) return;
      await saveTasksStatuses();
      editMode = false;
      saveTasksBtn.disabled = true;
      editTasksBtn.disabled = false;
      renderPreTasks(currentProject);
      renderTasks(currentProject);
    });
    editTaskBtn.addEventListener('click', () => {
        if (!isProducer) return;
        editTaskMode = true;
        saveTaskBtn.disabled = false;
        editTaskBtn.disabled = true;
        renderTaskDetail(currentTaskId, currentProjectName);
      });
    saveTaskBtn.addEventListener('click', async () => {
        if (!isProducer) return;
        await saveTaskStatuses();    // делает PUT /api/processed-projects
        editTaskMode = false;
        saveTaskBtn.disabled = true;
        editTaskBtn.disabled = false;
        renderTaskDetail(currentTaskId, currentProjectName);
      });
    }
async function saveTaskStatuses() {
        // отправляем именно processedProjects с адресом
        const res = await fetch('/api/processed-projects', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processedProjects)
        });
        if (!res.ok) console.error('Не удалось сохранить статус задачи');
      }
async function saveTasksStatuses() {
    await fetch('/api/processed-projects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processedProjects)
    });
  }

async function saveProjectDates() {
    console.log('работает фнукция saveProjectDates')
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
            
    } catch (err) {
      console.error('Ошибка при сохранении дат:', err);
    }
  }
  
/*async function loadProjects() {
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
      }*/
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
    console.log('работает фнукция renderProjectList')
        const container = document.getElementById('projectsContainer');
        editDatesBtn = document.getElementById('editDatesBtn');
        saveDatesBtn = document.getElementById('saveDatesBtn');
        if (isProducer) {
            editDatesBtn.style.display = ''
            saveDatesBtn.style.display = ''
        }
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
    console.log('работает фнукция openProject')
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
    console.log('работает фнукция renderPreTasks')
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
                       ` : ''}
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
    console.log('работает фнукция openTaskDetail')
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
    console.log('работает фнукция renderTaskDetail')
    const { address, photo, photos = [] } = getTaskStatus(projectName, taskId);
    const linksEl = document.getElementById('taskLinks');
    const files = getTaskFiles(projectName, taskId);
    // Показываем или скрываем кнопки
    editDatesBtn.style.display = isProducer ? '' : 'none';
    saveDatesBtn.style.display = isProducer ? '' : 'none';
    editTasksBtn.style.display = isProducer ? '' : 'none';
    saveTasksBtn.style.display = isProducer ? '' : 'none';
    editTaskBtn.style.display = isProducer ? '' : 'none';
    saveTaskBtn.style.display = isProducer ? '' : 'none';
    const titleEl = document.getElementById('taskDetailTitle');
    if (!titleEl || !linksEl) {
      console.error('Не найдены элементы экрана деталей задачи');
      return;
    }
    // Устанавливаем заголовок
    let lowerName = taskId.charAt(0).toLowerCase() + taskId.slice(1);
    if (lowerName === 'documents') { 
    lowerName = 'документы';
    }
    if (lowerName === 'storyboard') { 
        lowerName = 'раскадровку';
        }
    if (lowerName === 'color') {
        lowerName = 'цветокоррекцию';
        }
    if (lowerName === 'sound') {
        lowerName = 'озвучку';
        }
    if (lowerName === 'cg') {
        lowerName = 'CG';
        }
    if (lowerName === 'edit') {
        lowerName = 'монтаж';
        }
    if (lowerName === 'props') { 
        lowerName = 'реквизит';
            }
    if (lowerName === 'wardrobe') {
        lowerName = 'костюмы';
        }
    if (lowerName === 'location') {
        lowerName = 'локацию';
        }
    if (lowerName === 'casting') {
        lowerName = 'кастинг';
        }
    if (lowerName === 'ai') {
        lowerName = 'AI-генерации';
        }
    // Контейнер ссылок
    linksEl.innerHTML = ''; 
    if (taskId === 'location') {
        linksEl.innerHTML = ''; // очищаем контейнер
      
        if (isProducer && editTaskMode) {
          // Режим редактирования: показываем <label> и <input> на одной строке
          const container = document.createElement('div');
          container.style.display = 'flex';
          container.style.alignItems = 'center';
      
          const label = document.createElement('label');
          label.textContent = 'Адрес: ';
          label.style.marginRight = '8px';
      
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.value = address || '';
          inp.style.flex = '1';
          inp.addEventListener('input', e =>
            updateProcessedProject(projectName, taskId, { address: e.target.value })
          );
      
          container.appendChild(label);
          container.appendChild(inp);
          linksEl.appendChild(container);
        } else {
          // Режим просмотра: один <p> с текстом
          const p = document.createElement('p');
          p.textContent = `Адрес: ${address || ''}`;
          linksEl.appendChild(p);
        }
      
        // Блок фото (тот же код)
        const pPhoto = document.createElement('p');
        pPhoto.textContent = 'Фото:';
        linksEl.appendChild(pPhoto);
      
        const img = document.createElement('img');
        img.className = 'photo-preview';
        if (photo) img.src = photo;
        linksEl.appendChild(img);
      
        if (isProducer && editTaskMode) {
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
          linksEl.appendChild(fileInp);
        }
      }
      
    else if (taskId === 'casting') {
      const container = document.createElement('div');
      container.className = 'casting-container';
      container.innerHTML = '<h3>Фото согласованных актёров</h3>';
      const list = document.createElement('div');
      photos.forEach((src,i) => {
        const block = document.createElement('div');
        block.className = 'photo-block';
        block.innerHTML = `<img src="${src}" class="photo-preview"/>`;
        if (isProducer && editTaskMode) {
          const btn = document.createElement('button');
          btn.textContent = '×';
          btn.addEventListener('click', () => {
            const arr = [...photos];
            arr.splice(i,1);
            updateProcessedProject(projectName, 'casting', { photos: arr });
            renderTaskDetail(taskId, projectName);
          });
          block.appendChild(btn);
        }
        list.appendChild(block);
      });
      if (isProducer && editTaskMode) {
        const addBtn = document.createElement('button');
        addBtn.textContent = 'Добавить фото';
        addBtn.addEventListener('click', () => fileInp.click());
        const fileInp = document.createElement('input');
        fileInp.type = 'file';
        fileInp.accept = 'image/*';
        fileInp.multiple = true;
        fileInp.style.display = 'none';
        fileInp.addEventListener('change', async e => {
          const filesData = await Promise.all(Array.from(e.target.files).map(f => new Promise(res => {
            const r = new FileReader();
            r.onload = () => res(r.result);
            r.readAsDataURL(f);
          })));
          updateProcessedProject(projectName, 'casting', { photos: [...photos, ...filesData].slice(0,5) });
          renderTaskDetail(taskId, projectName);
        });
        container.appendChild(addBtn);
        container.appendChild(fileInp);
      }
      container.appendChild(list);
      linksEl.appendChild(container);
    } else {
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
    }
  }
  
  function renderTasks(proj) {
    console.log('работает фнукция renderTasks')
    const grid = document.getElementById('tasksGrid');
    grid.innerHTML = '';
    editTasksBtn = document.getElementById('editTasksBtn');
    saveTasksBtn = document.getElementById('saveTasksBtn');
    if (isProducer) {
        editTasksBtn.style.display = ''
        saveTasksBtn.style.display = ''
    }
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
        ${date ? `<span class="task-date">${date}` : ''}
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
    console.log('работает фнукция enableStatusEdit')
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
    console.log('работает фнукция saveStatusEdit')
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
//document.addEventListener('DOMContentLoaded', loadProjects)