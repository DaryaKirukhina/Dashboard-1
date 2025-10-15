require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { fork } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

// инициализация Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY  // используйте ключ с правами на запись
);

app.use(express.json());

// Путь к файлу со статусами
const STATUS_FILE   = path.join(__dirname,'public',  'processed_projects.json');
const PROJECTS_FILE = path.join(__dirname,'public',  'projects_with_clients.json');
const OUTPUT_FILE   = path.join(__dirname,'public',  'output.json');

// Разрешаем парсить JSON-тела
app.use(express.json({ limit: '10mb' }));

// Отдаём статику из папки public
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/projects', (_,res)=> {
    res.sendFile(path.join(__dirname,'public','projects_with_clients.json'));
  });
app.get('/api/statuses', (_,res)=> {
    res.sendFile(path.join(__dirname,'public','processed_projects.json'));
  });
app.get('/api/output', (_,res)=> {
    res.sendFile(path.join(__dirname,'public','output.json'));
  });
app.get('/api/processed-projects', async (req, res) => {
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Ошибка чтения файла статусов:', err);
    res.status(500).json({ error: 'Не удалось загрузить статусы' });
  }
});

// Эндпоинт для сохранения статусов
app.put('/api/processed-projects', async (req, res) => {
  const updated = req.body;
  if (!Array.isArray(updated)) {
    return res.status(400).json({ error: 'Ожидается массив объектов' });
  }
  try {
    await fs.writeFile(STATUS_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    res.json({ message: 'Статусы успешно сохранены' });
  } catch (err) {
    console.error('Ошибка записи файла статусов:', err);
    res.status(500).json({ error: 'Не удалось сохранить статусы' });
  }
});


app.put('/api/projects', async (req, res) => {
    const updatedProjects = req.body;
    if (!Array.isArray(updatedProjects)) {
      return res.status(400).json({ error: 'Ожидается массив проектов' });
    }
    try {
      await fs.writeFile(PROJECTS_FILE, JSON.stringify(updatedProjects, null, 2), 'utf-8');
      res.json({ message: 'Проекты успешно сохранены' });
    } catch (err) {
      console.error('Ошибка записи файла проектов:', err);
      res.status(500).json({ error: 'Не удалось сохранить проекты' });
    }
  });
  app.post('/api/onboarding', async (req, res) => {
    const row = req.body;
    const chatId = row.client_id;
  
    try {
      // 1. Находим real client_id
      const { data: clientRec, error: clientErr } = await supabase
        .from('clients')
        .select('client_id')
        .eq('client_chat_id', chatId)
        .maybeSingle();
      if (clientErr || !clientRec) {
        return res.status(404).json({ error: 'Клиент не найден' });
      }
      const realClientId = clientRec.client_id;
  
      // 2. Находим project_id
      const { data: projArray } = await supabase
        .from('projects')
        .select('project_id, producer_id')
        .eq('client_id', realClientId);
      if (!projArray || projArray.length === 0) {
        return res.status(404).json({ error: 'Проект не найден' });
      }
      const { project_id: projectId, producer_id: producerId } = projArray[0];
  
      // 3. Находим tg_chat_id продюсера
      const { data: prodRec, error: prodErr } = await supabase
        .from('producers')
        .select('producer_tg_chat_id')
        .eq('producer_id', producerId)
        .maybeSingle();
      if (prodErr || !prodRec) {
        return res.status(404).json({ error: 'Продюсер не найден' });
      }
      const producerChatId = prodRec.producer_tg_chat_id;
      const { data: clientData } = await supabase
      .from('clients')
      .select('client_name')
      .eq('client_chat_id', chatId)
      .maybeSingle();
      const clientName = clientData?.client_name || `ID ${realClientId}`;

      const { data: projectData } = await supabase
      .from('projects')
      .select('project_name')
      .eq('project_id', projectId)
      .maybeSingle();
      const projectName = projectData?.project_name || `#${projectId}`;

      const lines = [];

      // 4. Сохраняем настройки (upsert)
      const settings = {
        client_id: realClientId,
        project_id: projectId,
        status_frequency_day: row.status_frequency_day,
        status_frequency_time: row.status_frequency_time,
        format_status: row.format_status,
        response_time_work: row.response_time_work,
        response_time_off: row.response_time_off,
        weekend: row.weekend,
        testing: row.testing,
        quiet_from: row.quiet_from,
        quiet_to: row.quiet_to,
        approval_time: row.approval_time
      };
    lines.push('✅ Новый статус от клиента ' + clientName +
    ` (проект ${projectName}):`);
    lines.push('');
    lines.push('- Частота статусов: ' +
    (settings.status_frequency_day === 'daily'
        ? 'ежедневно'
        : settings.status_frequency_day.split(',').join(', ')
    ) +
    ` в ${settings.status_frequency_time}`);
    lines.push('- Формат: ' + settings.format_status + ' статус');
    lines.push('- Время ответа (рабочие часы): ' +
    settings.response_time_work + ' мин');
    lines.push('- Время ответа (выходные): ' +
    settings.response_time_off + ' мин');
    lines.push('- Тихий режим: с ' +
    settings.quiet_from.split('+')[0] + // нормальный вид без зоны
    ` до ` +
    settings.quiet_to.split('+')[0]);
    lines.push('- Писать в выходные: ' +
    (settings.weekend === 'urgent' ? 'да, если срочно' : 'нет'));
    lines.push('- Время согласования: ' +
    { '24h':'24 часа', '48h':'48 часов', 'day':'В течение дня' }[settings.approval_time]);
    lines.push('- Бета-тест: ' +
    { 'yes':'да', 'later':'возможно позже', 'no':'нет' }[settings.testing]);

    const message = lines.join('\n');

      await supabase
        .from('client_settings')
        .upsert(settings, { onConflict: ['client_id'] });
      // 6. Отправляем сообщение боту
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: 489599665, text: message, parse_mode: 'Markdown' })
      });
  
      res.json({ message: 'Настройки сохранены и продюсер уведомлен' });
  
    } catch (err) {
      console.error('Ошибка в /api/onboarding:', err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  });
  
  
function runScript(name) {
    return new Promise((resolve, reject) => {
      const proc = fork(path.join(__dirname, name));
      proc.on('exit', code => code === 0 ? resolve() : reject(new Error(`${name} exited ${code}`)));
      proc.on('error', reject);
    });
  }
cron.schedule( "0 3 * * *", async () => {
    console.log('Cron запуск в', new Date());
    try {
      await runScript('database-formation.js');
      await runScript('llm.js');
      await runScript('google.js');
      console.log('Cron завершён в', new Date());
    } catch (err) {
      console.error('Ошибка в cron:', err);
    }
  }, { timezone: 'Europe/Moscow' });
  
  // Запуск сервера
  app.listen(port, () => {
    console.log(`Server запущен на http://0.0.0.0:${port}`);
  });