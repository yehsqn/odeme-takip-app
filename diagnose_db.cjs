const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function diagnose() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('Connected!');

        const collections = [
            'users', 'payments', 'settings', 'dailyincomes', 'banks', 'incomes',
            'expenses', 'checks', 'promissorynotes', 'creditcards', 'annualplans'
        ];

        for (const collName of collections) {
            const count = await mongoose.connection.db.collection(collName).countDocuments();
            console.log(`Collection: ${collName} - Count: ${count}`);

            if (count > 0) {
                const sample = await mongoose.connection.db.collection(collName).findOne();
                console.log(`  Sample userId: ${sample.userId} (Type: ${typeof sample.userId})`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Diagnosis failed:', err);
        process.exit(1);
    }
}

diagnose();
