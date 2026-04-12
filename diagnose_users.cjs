const mongoose = require('mongoose');

const mongoURI = 'mongodb+srv://yehsqn:yehsan1907efe42pbag10kdb17@cluster0.cbct0mv.mongodb.net/OdemeTakipDB?retryWrites=true&w=majority';

async function diagnose() {
    try {
        await mongoose.connect(mongoURI);
        const users = await mongoose.connection.db.collection('users').find().toArray();
        console.log('Users:');
        users.forEach(u => {
            console.log(`- Email: ${u.email}, ID: ${u._id}`);
        });

        const paymentCounts = await mongoose.connection.db.collection('payments').aggregate([
            { $group: { _id: "$userId", count: { $sum: 1 } } }
        ]).toArray();

        console.log('\nPayment counts per userId:');
        paymentCounts.forEach(pc => {
            console.log(`- UserID: ${pc._id}, Count: ${pc.count}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

diagnose();
