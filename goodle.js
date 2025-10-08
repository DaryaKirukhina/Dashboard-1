const { google } = require('googleapis');
const fs = require('fs');
const credentials = require('./service-account-key.json');
require('dotenv').config();

const DRIVE_SCOPE = [process.env.DRIVE_SCOPE];
const PARENT_FOLDER_ID = process.env.PARENT_FOLDER_ID
const TARGET_SUBFOLDERS = [
  '01 - Script',
  '03 - Casting',
  '04 - Wardrobe',
  '06 - Props',
  '07 - Edit',
  '08 - CG',
  '09 - Color',
  '10 - Sound',
  '11 - Music'
];

async function getDriveClient() {
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    DRIVE_SCOPE
  );
  return google.drive({ version: 'v3', auth });
}

async function getFolderContents(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'files(id, name, mimeType, webViewLink)',
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  });
  const items = res.data.files || [];
  return {
    folders: items.filter(i => i.mimeType === 'application/vnd.google-apps.folder'),
    files:   items.filter(i => i.mimeType !== 'application/vnd.google-apps.folder')
  };
}

(async () => {
    try {
      const drive = await getDriveClient();
  
      // Получаем топ-уровневые папки
      const { folders: topFolders } = await getFolderContents(drive, PARENT_FOLDER_ID);
      const output = [];
  
      for (const top of topFolders) {
        const entry = {
          parentName: top.name,
          parentId: top.id,
          subfolders: [],
          projectContents: {}
        };
  
        // Список папок внутри top
        const { folders: directSub } = await getFolderContents(drive, top.id);
        entry.subfolders = directSub.map(sf => ({ name: sf.name, id: sf.id }));
  
        // Ищем папку "2 - Project"
        const projectFolder = directSub.find(sf => sf.name === '2 - Project');
        if (projectFolder) {
          const { folders: projectSub } = await getFolderContents(drive, projectFolder.id);
  
          for (const target of TARGET_SUBFOLDERS) {
            const tf = projectSub.find(ps => ps.name === target);
            if (!tf) {
              entry.projectContents[target] = [];
              continue;
            }
  
            // Получаем содержимое tf
            const { folders: innerFolders, files: innerFiles } = await getFolderContents(drive, tf.id);
  
            let items = [];
  
            if (['01 - Script', '03 - Casting', '04 - Wardrobe', '06 - Props'].includes(target)) {
              // Для этих разделов берём файлы внутри tf
              items = innerFiles.map(f => ({ name: f.name, webViewLink: f.webViewLink }));
            } else {
              // Для разделов Edit, CG, Color, Sound, Music — берём только for_clients
              const clientsFolder = innerFolders.find(f => f.name.toLowerCase() === 'for_clients');
              if (clientsFolder) {
                items = [{ name: clientsFolder.name, webViewLink: clientsFolder.webViewLink }];
              }
            }
  
            entry.projectContents[target] = items;
          }
        }
  
        output.push(entry);
      }
  
      fs.writeFileSync('output5.json', JSON.stringify(output, null, 2), 'utf-8');
      console.log('Результат сохранён в output5.json');
    } catch (err) {
      console.error('Ошибка в процессе:', err);
    }
  })();
  