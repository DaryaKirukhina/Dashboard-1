require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { fork } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// Путь к файлу со статусами
const STATUS_FILE   = path.join(__dirname, 'processed_projects.json');
const PROJECTS_FILE = path.join(__dirname, 'projects_with_clients.json');
const OUTPUT_FILE   = path.join(__dirname, 'output.json');

// Разрешаем парсить JSON-тела
app.use(express.json({ limit: '10mb' }));

// Отдаём статику из папки public
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/projects', (_, res) => res.sendFile(PROJECTS_FILE));
app.get('/api/statuses', (_, res) => res.sendFile(STATUS_FILE));
app.get('/api/output',   (_, res) => res.sendFile(OUTPUT_FILE));


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