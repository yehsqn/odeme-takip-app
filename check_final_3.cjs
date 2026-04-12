const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function check() {
    try {
        await mongoose.connect(mongoURI);
        const db = mongoose.connection.db;

        const payments = await db.collection('payments').find().toArray();
        console.log(`Current payments in DB (${payments.length}):`);
        payments.forEach(p => {
            console.log(`- Title: ${p.title}, userId: ${p.userId}, Amount: ${p.amount}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
