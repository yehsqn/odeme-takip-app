const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function countByUser() {
    try {
        await mongoose.connect(mongoURI);
        const db = mongoose.connection.db;

        // Check if payments collection exists
        const collections = await db.listCollections({ name: 'payments' }).toArray();
        if (collections.length === 0) {
            console.log('Collection payments does not exist.');
            process.exit(1);
        }

        const stats = await db.collection('payments').aggregate([
            { $group: { _id: '$userId', count: { $sum: 1 } } }
        ]).toArray();

        console.log('Payment counts by userId:');
        stats.forEach(s => {
            console.log(`- userId: ${s._id} (${typeof s._id}), count: ${s.count}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

countByUser();
