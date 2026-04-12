const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function search() {
    try {
        await mongoose.connect(mongoURI);
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        console.log(`Searching for 'CEMRE HIRDAVAT' in all collections...`);

        for (const col of collections) {
            const results = await db.collection(col.name).find({
                $or: [
                    { title: /CEMRE HIRDAVAT/i },
                    { customer: /CEMRE HIRDAVAT/i },
                    { name: /CEMRE HIRDAVAT/i },
                    { description: /CEMRE HIRDAVAT/i }
                ]
            }).toArray();

            if (results.length > 0) {
                console.log(`\n[FOUND] In collection '${col.name}': ${results.length} records`);
                console.log(JSON.stringify(results, null, 2).slice(0, 1000) + '...');
            }
        }

        console.log('\nSearch complete.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

search();
