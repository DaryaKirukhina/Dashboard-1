import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  console.log('Cron job started at:', new Date());
  try {
    await execAsync('node database-formation.js');
    await execAsync('node llm.js');
    await execAsync('node google.js');
    console.log('Cron job completed at:', new Date());
    res.status(200).json({ message: 'Cron job completed successfully' });
  } catch (error) {
    console.error('Cron job error:', error);
    res.status(500).json({ message: 'Cron job failed', error: error.message });
  }
}
