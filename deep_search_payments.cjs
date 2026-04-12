const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function check() {
    try {
        await mongoose.connect(mongoURI);
        const count = await mongoose.connection.db.collection('payments').countDocuments();
        console.log(`Total payments in collection: ${count}`);

        const all = await mongoose.connection.db.collection('payments').find().toArray();
        all.forEach(p => {
            console.log(`- Title: ${p.title}, userId: ${p.userId} (${typeof p.userId})`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
