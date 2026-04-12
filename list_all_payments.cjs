const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function check() {
    try {
        await mongoose.connect(mongoURI);
        const allPayments = await mongoose.connection.db.collection('payments').find().toArray();
        console.log(`Total payments: ${allPayments.length}`);
        allPayments.forEach(p => {
            console.log(`- ID: ${p._id}, userId: ${p.userId}, Title: ${p.title}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
