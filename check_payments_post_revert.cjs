const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function check() {
    try {
        await mongoose.connect(mongoURI);
        const users = await mongoose.connection.db.collection('users').find().toArray();
        console.log('Users:');
        users.forEach(u => console.log(`- ${u.email}: ${u._id}`));

        const paymentStats = await mongoose.connection.db.collection('payments').aggregate([
            { $group: { _id: "$userId", count: { $sum: 1 } } }
        ]).toArray();

        console.log('\nPayment stats:');
        paymentStats.forEach(s => console.log(`- UserID: ${s._id} (Type: ${typeof s._id}), Count: ${s.count}`));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
