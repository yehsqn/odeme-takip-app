const fs = require('fs');

const backupPath = 'C:\\Users\\yehsqn\\AppData\\Roaming\\odeme-takip\\backups\\Backup_2026-01-09T17-00-00-928Z.json';
const targetUserId = '69564cd3a6785f67c3c88322';

try {
    const data = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    const payments = data.payments || data.collections?.payments || [];

    const matches = payments.filter(p => p.userId === targetUserId);
    console.log(`Found ${matches.length} payments for userId ${targetUserId} in backup.`);

    if (matches.length > 0) {
        console.log('Sample titles:');
        matches.slice(0, 5).forEach(p => console.log(`- ${p.title}`));
    }
} catch (err) {
    console.error(err);
}
