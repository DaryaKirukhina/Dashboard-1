// scheduler.js

const cron = require('node-cron');
const path = require('path');
const { fork } = require('child_process');

// Helper to run a script via fork
function runScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    console.log(`Запуск ${scriptName} в`, new Date());
    const proc = fork(scriptPath, { silent: true });
    proc.on('exit', code => {
      if (code === 0) {
        console.log(`${scriptName} выполнен успешно`);
        resolve();
      } else {
        reject(new Error(`${scriptName} завершился с кодом ${code}`));
      }
    });
    proc.on('error', err => {
      reject(err);
    });
  });
}

console.log('Scheduler запущен в', new Date());

cron.schedule('*/4 * * * *', async () => {
    console.log('Cron triggered в', new Date());
  try {
    await runScript('database-formation.js');
    await runScript('llm.js');
    await runScript('google.js');
    console.log('Все скрипты выполнены в', new Date());
  } catch (err) {
    console.error('Ошибка при выполнении скриптов:', err);
  }
}, {
  timezone: 'Europe/Moscow'
});
