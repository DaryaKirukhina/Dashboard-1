const express = require('express');
const path = require('path');
const fs = require('fs').promises;  // промисифицированный fs
const app = express();
const port = process.env.PORT || 3000;

// Путь к файлу со статусами
const STATUS_FILE = path.join(__dirname, 'public', 'processed_projects.json');
const PROJECTS_FILE = path.join(__dirname, 'public', 'projects_with_clients.json');

// Разрешаем парсить JSON-тела
app.use(express.json());

// Отдаём статику из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Эндпоинт для получения статусов
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

// Запуск сервера
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
