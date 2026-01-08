const axios = require('axios');

async function testApi() {
    try {
        console.log("Testing truncgil...");
        const res = await axios.get('https://finans.truncgil.com/today.json');
        console.log("Response:", res.data.USD); // Check USD structure
    } catch (e) {
        console.log("Error:", e.message);
    }
}

testApi();
