const axios = require('axios');

async function testApi() {
    try {
        console.log('Testing: https://api.genelpara.com/json/?list=doviz&sembol=all');
        const res = await axios.get('https://api.genelpara.com/json/?list=doviz&sembol=all');
        console.log('Status:', res.status);
        console.log('Data Preview:', JSON.stringify(res.data).substring(0, 500));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
    }
}

testApi();
