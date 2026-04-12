const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function searchOplogCommands() {
    try {
        await mongoose.connect(mongoURI);
        const localDb = mongoose.connection.client.db('local');
        const oplog = localDb.collection('oplog.rs');

        console.log('Searching all COMMAND operations today...');
        const today = new Date().toISOString().split('T')[0];

        const commands = await oplog.find({
            op: 'c',
            wall: { $gte: new Date(today) }
        }).sort({ ts: -1 }).toArray();

        console.log(`Found ${commands.length} command operations today.`);

        commands.forEach((c, i) => {
            console.log(`- [${c.wall}] NS: ${c.ns}, CMD: ${JSON.stringify(c.o)}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }
}

searchOplogCommands();
