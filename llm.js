// llm.js

const fs = require('fs');
const OpenAI = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

const projects = require('./projects_with_clients.json');

const TASK_FIELDS = {
    documents: ['doc', 'act', 'docs_status'],
    storyboard: ['storyboard_client', 'storyboard_cult', 'storyboard_next_step'],
    ai: ['aigen_client', 'aigen_cult', 'aigen_next_steps'],
    casting: ['casting_client', 'casting_cult', 'casting_next_step'],
    location: ['location_client', 'location_cult', 'location_next_step'],
    props: ['props_client', 'props_cult', 'props_next_step'],
    wardrobe: ['clothes_client', 'clothes_cult', 'clothes_next_step'],
    editing: ['editing_client', 'editing_cult', 'editing_next_step'],
    voice: ['vo_client', 'vo_cult', 'vo_next_step'],
    music: ['music_client', 'music_cult', 'music_next_step'],
    color: ['colorgrading_client', 'colorgrading_cult', 'colorgrading_next_step'],
    photos: ['photos_client', 'photos_cult', 'photos_next_step'],
    cg: ['cg_client', 'cg_cult', 'cg_next_step']
  };
async function parseTaskStatus(taskName, values) {
    const now = new Date();
    const today = now.toLocaleDateString('ru-RU', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric'
  });
  console.log(`parseTaskStatus: start "${taskName}"`);
  const prompt = `
Текущая дата: ${today}

У тебя есть данные для задачи "${taskName}":
${values.map(v => `- ${v.field}: ${v.text}`).join('\n')}


Определи:
1) статус: один из ["Утверждено","В работе","Ждёт согласования⚠️","На доработке"]
2) дату статуса в формате DD.MM.YYYY (если в тексте есть дата)

Ответь строго в формате JSON:
{"status":"...","date":"..."}
`;

  let resp;
  try {
    resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    });
  } catch (e) {
    console.error(`Ошибка API для "${taskName}":`, e);
    throw e;
  }

  let content = resp.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Нет ответа от модели для "${taskName}"`);
  }
  console.log(`parseTaskStatus: raw response for "${taskName}":`, content);

  const lines = content.split('\n');
  const filtered = lines.filter((line, idx) => {
    if (idx === 0 && line.trim().startsWith('```')) return false
    if (idx === lines.length - 1 && line.trim().startsWith('```')) return false;
    return true;
  });

  content = filtered.join('\n').trim();
  console.log(`cleaned content for "${taskName}":`, content);

  const parsed = JSON.parse(content);
  console.log(`parsed for "${taskName}":`, parsed);
  return parsed;
}

async function processProject(proj) {
  console.log(`\nprocessProject: "${proj.project_name}"`);
  const summary = {
    project_name: proj.project_name,
    stage: proj.stage
  };

  for (const [taskKey, fields] of Object.entries(TASK_FIELDS)) {
    const values = fields
      .filter(f => proj[f])
      .map(f => ({ field: f, text: proj[f] }));

    if (!values.length) {
      summary[taskKey] = { status: null, date: null };
      continue;
    }
    try {
      summary[taskKey] = await parseTaskStatus(taskKey, values);
    } catch (e) {
      summary[taskKey] = { status: null, date: null };
    }
  }

  return summary;
}

async function runLlm() {
  console.log('main: start processing', projects.length, 'projects');
  const output = [];
  for (const proj of projects) {
    try {
      const result = await processProject(proj);
      output.push(result);
    } catch (e) {
      console.error('main: error processing project', proj.project_name, e);
    }
  }
  fs.writeFileSync('./processed_projects.json', JSON.stringify(output, null, 2), 'utf-8');
  console.log('main: saved processed_projects.json');
}

runLlm().catch(e => {
  console.error('Unhandled error in main:', e);
  process.exit(1);
});
