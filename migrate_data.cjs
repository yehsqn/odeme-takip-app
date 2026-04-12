const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';
const orphanUserId = '69564cd3a6785f67c3c88322'; // The ID found to have 46 payments

async function migrate(targetEmail) {
    try {
        console.log(`Connecting to DB...`);
        await mongoose.connect(mongoURI);

        // 1. Find target user
        const targetUser = await mongoose.connection.db.collection('users').findOne({ email: targetEmail });
        if (!targetUser) {
            console.error(`User with email ${targetEmail} not found!`);
            process.exit(1);
        }

        const targetId = targetUser._id;
        console.log(`Target User Found: ${targetEmail} (ID: ${targetId})`);

        const collections = [
            'payments', 'dailyincomes', 'banks', 'incomes',
            'expenses', 'checks', 'promissorynotes', 'creditcards', 'annualplans'
        ];

        for (const collName of collections) {
            const result = await mongoose.connection.db.collection(collName).updateMany(
                { userId: orphanUserId }, // Match string ID or ObjectId if it was saved as string
                { $set: { userId: targetId } }
            );

            // Also try matching as ObjectId just in case
            const resultObj = await mongoose.connection.db.collection(collName).updateMany(
                { userId: new mongoose.Types.ObjectId(orphanUserId) },
                { $set: { userId: targetId } }
            );

            const modifiedCount = result.modifiedCount + resultObj.modifiedCount;
            if (modifiedCount > 0) {
                console.log(`✓ Migrated ${modifiedCount} records in ${collName}`);
            }
        }

        console.log('\nMigration complete!');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
    console.log('Usage: node migrate_data.cjs <target_email>');
    process.exit(1);
}

migrate(email);
