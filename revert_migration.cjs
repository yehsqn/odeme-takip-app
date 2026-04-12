const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';
const orphanUserId = '69564cd3a6785f67c3c88322';

async function revert(targetEmail) {
    try {
        console.log(`Connecting to DB...`);
        await mongoose.connect(mongoURI);

        const targetUser = await mongoose.connection.db.collection('users').findOne({ email: targetEmail });
        if (!targetUser) {
            console.error(`User with email ${targetEmail} not found!`);
            process.exit(1);
        }

        const targetId = targetUser._id;
        console.log(`Reverting data from User: ${targetEmail} (ID: ${targetId}) back to ${orphanUserId}`);

        const collections = [
            'payments', 'dailyincomes', 'banks', 'incomes',
            'expenses', 'checks', 'promissorynotes', 'creditcards', 'annualplans'
        ];

        for (const collName of collections) {
            const result = await mongoose.connection.db.collection(collName).updateMany(
                { userId: targetId },
                { $set: { userId: new mongoose.Types.ObjectId(orphanUserId) } }
            );

            if (result.modifiedCount > 0) {
                console.log(`✓ Reverted ${result.modifiedCount} records in ${collName}`);
            }
        }

        console.log('\nRevert complete!');
        process.exit(0);
    } catch (err) {
        console.error('Revert failed:', err);
        process.exit(1);
    }
}

revert('yehsqn4@gmail.com');
