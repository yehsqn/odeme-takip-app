const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function searchOplogUpdates() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoURI);

        const localDb = mongoose.connection.client.db('local');
        const oplog = localDb.collection('oplog.rs');

        console.log('Searching for UPDATE operations in oplog for payments...');

        // Look for update operations
        const updates = await oplog.find({
            ns: 'OdemeTakipDB.payments',
            op: 'u'
        }).sort({ ts: -1 }).limit(200).toArray();

        console.log(`Found ${updates.length} recent update operations.`);

        for (const entry of updates) {
            if (JSON.stringify(entry).includes('69564cd3a6785f67c3c88322')) {
                console.log('!!! FOUND UPDATE MATCHING OLD USER ID !!!');
                console.log(JSON.stringify(entry, null, 2));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

searchOplogUpdates();
