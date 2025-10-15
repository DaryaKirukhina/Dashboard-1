require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { fork } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

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

async function isAddressedToProducer(text, producerName) {
    const prompt = `
Определи, является ли следующее сообщение вопросом, адресованным продюсеру.
Имя продюсера: "${producerName}"
Сообщение: """${text}"""
Отвечайте только "YES" или "NO".`;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });
    const answer = response.choices[0].message.content.trim().toUpperCase();
    console.log('LLM answer:', answer);
    return answer.startsWith('YES');
}

const responseState = new Map(); 
const hopChatId = 489599665; //Денис

async function handleNewMessage(msg) {
  try {
    // 1. Определяем projectId
    const { data: chat } = await supabase.from('chats')
      .select('project_id').eq('telegram_chat_id', msg.telegram_chat_id).maybeSingle();
    if (!chat) return;
    const projectId = chat.project_id;

    // 2. Получаем проектные данные
    const { data: proj } = await supabase.from('projects')
      .select('client_id,producer_id,project_name')
      .eq('project_id', projectId).maybeSingle();
    if (!proj) return;
    const { client_id, producer_id, project_name } = proj;

    // 3. Данные клиента и продюсера
    const { data: client } = await supabase.from('clients')
      .select('client_chat_id,client_name').eq('client_id', client_id).maybeSingle();
    const { data: producer } = await supabase.from('producers')
      .select('producer_tg_chat_id,producer_name').eq('producer_id', producer_id).maybeSingle();
    if (!client || !producer) return;

    const isClient = msg.sender_id === client.client_chat_id;
    const isProducer = msg.sender_id === producer.producer_tg_chat_id;
    const text = msg.message_text || '';
    const firstName = producer.producer_name.split(' ')[0];
    //const producerUsername = producer.producer_tg_chat_id && `@${producer.tg_username}`;  когда будет username

    const isAddressed = await isAddressedToProducer(msg.message_text, firstName);
    console.log({ text, isClient, isProducer, isAddressed });
    

    // Логируем сообщение
    const senderName = isClient
      ? client.client_name
      : isProducer
        ? producer.producer_name
        : `ID ${msg.sender_id}`;
    const role = isClient ? 'клиент' : isProducer ? 'продюсер' : 'неизвестно';

    console.log(`Сообщение от "${senderName}" (${role}) в проекте "${project_name}": "${msg.message_text}"`);
    
    if (isClient && isAddressed) {
    console.log('✅ Условие выполнено, заходим внутрь блока запуска таймеров');
    const { data: settings } = await supabase.from('client_settings')
      .select('response_time_work').eq('client_id', client_id).maybeSingle();
      if (!settings) {
        console.log('⚠ Настройки клиента не найдены');
        return;
      }

    const initialDelay = settings.response_time_work * 60 * 1000;
    const repeatDelay = 10 * 60 * 1000
    console.log('⚙ Настройки клиента:', settings);
    const prev = responseState.get(projectId);
      if (prev) clearTimeout(prev.timerId);
      
    const state = {
        count: 0,
        clientName: client.client_name,
        chatId: client.client_chat_id,
        producerId: producer.producer_tg_chat_id,
        projectName: project_name,
        timerId: null
      };
      // Функция напоминания
    const reminder = async () => {
        state.count += 1;
        console.log(state.count)
        console.log(`функция reminder`)
        if (state.count === 1) {
            console.log(`Запуск первого таймера (${initialDelay/60000} мин) для проекта ${state.projectName}`);
          } else if (state.count === 2) {
            console.log(`Запуск второго таймера (${repeatDelay/60000} мин) для проекта ${state.projectName}`);
          } else if (state.count === 3) {
            console.log(`Запуск третьего таймера (${repeatDelay/60000} мин) для проекта ${state.projectName}`);
          }
        if (state.count <= 2) {
          // Напоминание продюсеру
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              chat_id: 489599665,
              text: `⚠️Проект "${project_name}". Пожалуйста, ответьте клиенту ${state.clientName}`
            })
          });
          console.log(`Напоминание продюсеру #${state.count} для проекта "${project_name}"`);
          state.timerId = setTimeout(reminder, repeatDelay);
          responseState.set(projectId, state)
        } else {
          // Третье напоминание — HOP
          await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({
              chat_id: hopChatId,
              text: `🚨 Проект "${project_name}": продюсер не ответил клиенту ${state.clientName}`
            })
          });
          console.log(`Уведомлен по проекту "${project_name}"`);
          // Не планируем дальше
          responseState.delete(projectId);
        }
      };
    
      // Запускаем первый таймер
      state.timerId = setTimeout(reminder, initialDelay);
      responseState.set(projectId, state);
    
    }
    // 6. Если продюсер — отменяем
    if (isProducer && responseState.has(projectId)) {
      clearTimeout(responseState.get(projectId).timerId);
      responseState.delete(projectId);
      console.log(`Таймер для проекта "${project_name}" сброшен — продюсер ответил`);
    }

  } catch (err) {
    console.error('Ошибка в handleNewMessage:', err);
  }
}

let lastTimestamp = null;
async function initLastTimestamp() {
    const { data, error } = await supabase
      .from('messages')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    lastTimestamp = data?.timestamp || new Date().toISOString();
    console.log('Инициализирован lastTimestamp =', lastTimestamp);
  }

async function pollMessages() {
    try {
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .gt('timestamp', lastTimestamp)
        .order('timestamp', { ascending: true });
  
      if (error) throw error;
      if (msgs.length) {
        for (const msg of msgs) {
          await handleNewMessage(msg);
        }
        lastTimestamp = msgs[msgs.length - 1].timestamp;
      }
    } catch (e) {
      console.error('Ошибка pollMessages:', e);
    }
  }
initLastTimestamp().then(() => {
    setInterval(pollMessages, 15 * 1000);
  }).catch(console.error);

  app.post('/api/check-client', async (req, res) => {
    const { telegram_id } = req.body;
    if (!telegram_id) {
      return res.status(400).json({ error: 'telegram_id required' });
    }
  
    const { data, error } = await supabase
      .from('clients')
      .select('client_id')
      .eq('client_chat_id', telegram_id)
      .maybeSingle();
  
    if (error) {
      console.error('check-client error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
  
    if (!data) {
      return res.json({ exists: false });
    }
  
    return res.json({ exists: true, client_id: data.client_id });
  });
  app.post('/api/check-settings', async (req, res) => {
    const { client_id } = req.body;
    if (!client_id) {
      return res.status(400).json({ error: 'client_id required' });
    }
  
    const { data, error } = await supabase
      .from('client_settings')
      .select('client_id', { count: 'exact' })
      .eq('client_id', client_id)
      .limit(1);
  
    if (error) {
      console.error('check-settings error:', error);
      return res.status(500).json({ error: 'Database error' });
    }
  
    const exists = data.length > 0;
    return res.json({ exists });
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