const fs = require('fs');
const path = require('path');

const searchStrings = ['CEMRE', 'ILKAY', 'HIRDAVAT'];
const userDataPath = path.join(process.env.APPDATA, 'odeme-takip');

function searchInFile(filePath) {
    try {
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
            const files = fs.readdirSync(filePath);
            files.forEach(file => searchInFile(path.join(filePath, file)));
        } else if (stats.isFile()) {
            // Skip large binary files if needed, but for rescue we check all
            const content = fs.readFileSync(filePath, 'utf8');
            searchStrings.forEach(str => {
                if (content.includes(str)) {
                    console.log(`\n!!! MATCH FOUND !!!`);
                    console.log(`String: ${str}`);
                    console.log(`File: ${filePath}`);
                    // Print context
                    const index = content.indexOf(str);
                    console.log(`Context: ...${content.slice(Math.max(0, index - 50), index + 50)}...`);
                }
            });
        }
    } catch (err) {
        // Ignore errors for locked files etc
    }
}

console.log(`Searching for ${searchStrings.join(', ')} in ${userDataPath}...`);
searchInFile(userDataPath);
console.log('Search finished.');
