const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function listNamespaces() {
    try {
        await mongoose.connect(mongoURI);
        const localDb = mongoose.connection.client.db('local');
        const oplog = localDb.collection('oplog.rs');

        console.log('Listing unique namespaces (ns) in last 1000 oplog entries...');
        const entries = await oplog.find({}).sort({ ts: -1 }).limit(1000).toArray();

        const namespaces = new Set();
        entries.forEach(e => {
            if (e.ns) namespaces.add(e.ns);
        });

        console.log('Unique namespaces:');
        Array.from(namespaces).sort().forEach(ns => console.log(`- ${ns}`));

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

listNamespaces();
