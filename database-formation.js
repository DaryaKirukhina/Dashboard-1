const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function runDb() {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        *,
        client1:clients!projects_client_id_fkey(
          client_id,
          client_name,
          client_chat_id
        ),
        client2:clients!projects_client2_fkey(
          client_id,
          client_name,
          client_chat_id
        ),
        client3:clients!projects_client3_fkey(
          client_id,
          client_name,
          client_chat_id
        ),
        producer_id:producers!projects_producer_id_fkey(
          producer_id,
          producer_name,
          producer_tg_chat_id
        ),
        producer2:producers!projects_producer2_fkey(
          producer_id,
          producer_name,
          producer_tg_chat_id
        ),
        producer3:producers!projects_producer3_fkey(
          producer_id,
          producer_name,
          producer_tg_chat_id

        )
      `);

    if (error) {
      console.error('Supabase error:', error);
      return;
    }

    const filePath = './public/projects_with_clients.json';
    fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf-8');

    console.log(`Данные сохранены в файл: ${filePath}`);
  } catch (err) {
    console.error('Unexpected error:', err);
  }
};
runDb().catch(console.error);
