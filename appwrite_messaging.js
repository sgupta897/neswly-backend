const sdk = require('node-appwrite');

let client = null;
let messaging = null;

function initAppwrite() {
    if (client) return;
    
    // Values should ideally come from process.env
    const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!projectId || !apiKey) {
        console.warn('WARNING: Appwrite Project ID or API Key is missing. Push notifications disabled.');
        return;
    }

    client = new sdk.Client();
    client
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    messaging = new sdk.Messaging(client);
    console.log('Appwrite Server SDK initialized successfully.');
}

async function sendNewsNotification(title, body) {
    if (!messaging) {
        console.log('Cannot send notification, Appwrite is not initialized.');
        return;
    }

    try {
        // Appwrite messaging API: createTopicMessage or general createMessage
        // Note: You must create a Topic with ID 'news_flashes' in the Appwrite Console
        const message = await messaging.createMessage(
            sdk.ID.unique(),      // messageId
            title,                // title
            body,                 // body
            [],                   // targets (can be topic ID)
            [],                   // users
            ['news_flashes']      // topics
        );
        console.log('Successfully sent Appwrite push notification:', message.$id);
    } catch (error) {
        console.error('Error sending Appwrite push notification:', error);
    }
}

module.exports = {
    initAppwrite,
    sendNewsNotification
};
