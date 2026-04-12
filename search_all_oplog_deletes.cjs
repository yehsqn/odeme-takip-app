const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function searchAllOplogDeletes() {
    try {
        await mongoose.connect(mongoURI);
        const localDb = mongoose.connection.client.db('local');
        const oplog = localDb.collection('oplog.rs');

        console.log('Searching all DELETE operations today...');

        // Today's date in wall format
        const today = new Date().toISOString().split('T')[0];

        const deletes = await oplog.find({
            op: 'd',
            wall: { $gte: new Date(today) }
        }).sort({ ts: -1 }).toArray();

        console.log(`Found ${deletes.length} delete operations today.`);

        deletes.forEach((d, i) => {
            console.log(`- [${d.wall}] NS: ${d.ns}, ID: ${d.o._id}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

searchAllOplogDeletes();
