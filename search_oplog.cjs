const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function searchOplog() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoURI);

        // Switch to local database where oplog usually resides
        const localDb = mongoose.connection.client.db('local');
        const oplog = localDb.collection('oplog.rs');

        console.log('Searching for DELETE operations in oplog...');

        // Look for delete operations in the payments collection
        // ns: 'OdemeTakipDB.payments', op: 'd' (delete)
        const deletes = await oplog.find({
            ns: 'OdemeTakipDB.payments',
            op: 'd'
        }).sort({ ts: -1 }).limit(100).toArray();

        if (deletes.length > 0) {
            console.log(`Found ${deletes.length} recent delete operations.`);
            // Unfortunately, oplog 'd' records only contain the _id of the deleted document
            // unless it was a full document replacement or other specific conditions.
            console.log('Sample delete keys:', JSON.stringify(deletes.slice(0, 5), null, 2));
        } else {
            console.log('No recent delete operations found in oplog for payments collection.');
        }

        // Try to look for INSERT missions as well, in case they were recently inserted then lost
        const inserts = await oplog.find({
            ns: 'OdemeTakipDB.payments',
            op: 'i'
        }).sort({ ts: -1 }).limit(100).toArray();

        if (inserts.length > 0) {
            const cemre = inserts.filter(i => JSON.stringify(i.o).includes('CEMRE'));
            console.log(`Found ${cemre.length} inserts with 'CEMRE' in the oplog.`);
            if (cemre.length > 0) {
                console.log('Restoring data from oplog inserts...');
                // Here we could extract doc from i.o and re-insert
                cemre.forEach(i => console.log('Data:', JSON.stringify(i.o)));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Failed to access oplog:', err.message);
        if (err.message.includes('not authorized')) {
            console.log('Note: Oplog access is restricted on M0/Free Tier MongoDB Atlas clusters.');
        }
        process.exit(1);
    }
}

searchOplog();
