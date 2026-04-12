const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function searchOplogDeletesDeep() {
    try {
        await mongoose.connect(mongoURI);
        const localDb = mongoose.connection.client.db('local');
        const oplog = localDb.collection('oplog.rs');

        console.log('Searching last 1000 oplog entries for ANY delete operations...');

        const deletes = await oplog.find({
            op: 'd'
        }).sort({ ts: -1 }).limit(1000).toArray();

        console.log(`Found ${deletes.length} delete operations in the last 1000 entries.`);

        // Group by collection (ns)
        const stats = {};
        deletes.forEach(d => {
            stats[d.ns] = (stats[d.ns] || 0) + 1;
            if (d.ns === 'OdemeTakipDB.payments' && i < 10) {
                console.log(`- [${d.wall}] NS: ${d.ns}, ID: ${d.o._id}`);
            }
        });

        console.log('\nStats by namespace:');
        console.log(JSON.stringify(stats, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

searchOplogDeletesDeep();
