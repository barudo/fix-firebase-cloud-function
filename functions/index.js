/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */


// const logger = require("firebase-functions/logger");

const {onRequest} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions/v2");
const {api} = require(`./server.js`);

/* set the global options
specifying that your function depends on
certain secrets (MAILGUN_API_KEY and MAILGUN_DOMAIN).
*/
setGlobalOptions({
  secrets: ["MAILGUN_API_KEY", "MAILGUN_DOMAIN"],
});

/* https.onRequest(api) is used to deploy your Express
app as a Firebase HTTP Function. The api is imported
from your server.js, which contains the Express app. */
exports.sendEmailFunction = onRequest({invoker: "public"}, api);

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
