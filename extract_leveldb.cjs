const fs = require('fs');
const path = require('path');

const logPath = path.join(process.env.APPDATA, 'odeme-takip', 'Local Storage', 'leveldb', '000003.log');

try {
    const buffer = fs.readFileSync(logPath);
    let str = '';
    for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i];
        if (char >= 32 && char <= 126) {
            str += String.fromCharCode(char);
        } else {
            if (str.length > 4) {
                if (str.includes('CEMRE') || str.includes('HIRDAVAT') || str.includes('ILKAY')) {
                    console.log(`FOUND: ${str}`);
                }
            }
            str = '';
        }
    }
} catch (err) {
    console.error(err);
}
