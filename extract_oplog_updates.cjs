const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function extractUpdates() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoURI);

        const localDb = mongoose.connection.client.db('local');
        const oplog = localDb.collection('oplog.rs');

        console.log('Listing the 46 recent updates on payments...');
        const updates = await oplog.find({
            ns: 'OdemeTakipDB.payments',
            op: 'u'
        }).sort({ ts: -1 }).limit(100).toArray();

        updates.forEach((u, i) => {
            console.log(`\nUpdate ${i + 1}:`);
            console.log(`- Query: ${JSON.stringify(u.o)}`);
            console.log(`- Data: ${JSON.stringify(u.o2)}`); // In updates, o2 is usually the query, o is the update doc
            // Actually in MongoDB 4.2+, it might be different. Let's dump the whole entry.
            console.log(`- Full: ${JSON.stringify(u)}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

extractUpdates();
