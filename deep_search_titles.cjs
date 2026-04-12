const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function deepSearch() {
    try {
        await mongoose.connect(mongoURI);
        const db = mongoose.connection.db;

        const targetTitles = ['CEMRE HIRDAVAT', 'İLKAYALAR', 'CEMRE', 'İLKAY'];
        console.log(`Deep searching for titles: ${targetTitles.join(', ')}`);

        const collections = await db.listCollections().toArray();

        for (const col of collections) {
            console.log(`Checking collection: ${col.name}...`);
            const allDocs = await db.collection(col.name).find({}).toArray();

            const matches = allDocs.filter(doc => {
                const title = (doc.title || '').toUpperCase();
                return targetTitles.some(t => title.includes(t));
            });

            if (matches.length > 0) {
                console.log(`\n!!! FOUND ${matches.length} matches in '${col.name}' !!!`);
                matches.forEach(m => {
                    console.log(`- Title: ${m.title}, userId: ${m.userId}, ID: ${m._id}`);
                    console.log(`  Full Data: ${JSON.stringify(m)}`);
                });
            }
        }

        console.log('\nSearch completed.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

deepSearch();
