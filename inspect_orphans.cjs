const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function inspect() {
    try {
        await mongoose.connect(mongoURI);
        const orphanPayments = await mongoose.connection.db.collection('payments').find({
            userId: new mongoose.Types.ObjectId('69564cd3a6785f67c3c88322')
        }).limit(5).toArray();

        console.log('Orphan Payments Sample (for userId: 69564cd3a6785f67c3c88322):');
        console.log(JSON.stringify(orphanPayments, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

inspect();
