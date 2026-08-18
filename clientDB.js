const mongoose = require('mongoose');

let clientConnection = null;

function initClientDB(uri) {
    if (!uri) {
        console.warn('⚠️ CLIENT_MONGODB_URI not set. Admin will not be able to read client data.');
        return null;
    }

    clientConnection = mongoose.createConnection(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    clientConnection.on('connected', () => {
        console.log('✅ Connected to client database');
    });

    clientConnection.on('error', (err) => {
        console.error('❌ Client database connection error:', err);
    });

    return clientConnection;
}

function getClientConnection() {
    return clientConnection;
}

module.exports = { initClientDB, getClientConnection };
