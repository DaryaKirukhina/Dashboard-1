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
  '05 - Locations',
  '06 - Props'
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

    const { folders: topFolders } = await getFolderContents(drive, PARENT_FOLDER_ID);

    const output = [];

    for (const top of topFolders) {
      const entry = {
        parentName: top.name,
        parentId: top.id,
        subfolders: [],
        projectContents: {}  // сюда попадут ссылки из 2 - Project папки
      };

      const { folders: directSub } = await getFolderContents(drive, top.id);
      entry.subfolders = directSub.map(sf => ({
        name: sf.name,
        id: sf.id
      }));

      const projectFolder = directSub.find(sf => sf.name === '2 - Project');
      if (projectFolder) {
        const { folders: projectSub } = await getFolderContents(drive, projectFolder.id);
        for (const target of TARGET_SUBFOLDERS) {
          const tf = projectSub.find(ps => ps.name === target);
          if (!tf) continue;
          const { files } = await getFolderContents(drive, tf.id);
          entry.projectContents[target] = files.map(f => ({
            name: f.name,
            webViewLink: f.webViewLink
          }));
        }
      }

      output.push(entry);
    }

    fs.writeFileSync('output.json', JSON.stringify(output, null, 2), 'utf-8');
    console.log('Результат сохранён в output.json');
  } catch (err) {
    console.error('Ошибка в процессе:', err);
  }
})();
