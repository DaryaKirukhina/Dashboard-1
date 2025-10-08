const { google } = require('googleapis');
const credentials = require('./service-account-key.json');

async function getFolderContents(folderId) {
  // Настройка аутентификации
  const auth = new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/drive.readonly']
  );
  const drive = google.drive({ version: 'v3', auth });

  try {
    // Запрос содержимого папки
    const res = await drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, mimeType, webViewLink)',
      pageSize: 1000,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      orderBy: 'folder,name'
    });

    const items = res.data.files || [];
    if (items.length === 0) {
      console.log(`Папка ${folderId} пуста`);
      return { folders: [], files: [] };
    }

    // Разделяем на папки и файлы
    const folders = items.filter(i => i.mimeType === 'application/vnd.google-apps.folder');
    const files   = items.filter(i => i.mimeType !== 'application/vnd.google-apps.folder');

    return { folders, files };
  } catch (err) {
    console.error('Ошибка при получении содержимого папки:', err);
    throw err;
  }
}

(async () => {
  try {
    const parentFolderId = '1_C-Lt8bXGDMA2isFbRAGBVlRCNuheG-H'; 
    const { folders } = await getFolderContents(parentFolderId);
    console.log('Найденные подпапки:');
    folders.forEach(f => console.log(`• ${f.name} (ID: ${f.id})`));

    if (folders.length === 0) return;
    
    // 2) Выбираем конкретную подпапку и получаем её содержимое
    const childFolderId = '1yUNYe_XAtvp_seciU53VbLaHehvCmD2k'; // либо вручную подставьте нужный ID
    const { folders: subfolders, files } = await getFolderContents(childFolderId);

    console.log(`\nСодержимое подпапки ${childFolderId}:`);
    if (subfolders.length) {
      console.log('📁 ПОДПАПКИ:');
      subfolders.forEach(f => console.log(`  • ${f.name} (ID: ${f.id})`));
    }
    if (files.length) {
      console.log('📄 ФАЙЛЫ:');
      files.forEach(f => console.log(`  • ${f.name} — ${f.webViewLink}`));
    }
    const projectFolder = subfolders.find(f => f.name.startsWith('2 - Project'));
    if (!projectFolder) {
      console.error('Папка "2 - Project" не найдена');
      return;
    }
    const { folders: subfolders2, files: files2 } = await getFolderContents(projectFolder.id);
    console.log(`\nСодержимое папки "${projectFolder.name}" (ID: ${projectFolder.id}):`);
    if (subfolders2.length) {
      console.log('📁 ПОДПАПКИ:');
      subfolders2.forEach(f => console.log(`  • ${f.name} (ID: ${f.id})`));
    }
    const needed = ['01 - Script', '03 - Casting', '04 - Wardrobe', '05 - Locations', '06 - Props'];
    for (const name of needed) {
        const folder = subfolders2.find(f => f.name === name);
        if (!folder) {
          console.warn(`Папка ${name} не найдена`);
          continue;
        }
        // Получаем содержимое нужной папки
        const { files } = await getFolderContents(folder.id);
        console.log(`\nФайлы в папке "${folder.name}" (ID: ${folder.id}):`);
        if (files.length === 0) {
          console.log('  (папка пуста)');
        } else {
          files.forEach(file => {
            console.log(`  • ${file.name} — ${file.webViewLink}`);
          });
        }
      }
  } catch (err) {
    console.error(err);
  }
})();
