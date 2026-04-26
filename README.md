# Fix Nodejs Firebase Cloud Function that sends email with Multer/Mailgun

## Job Description

We have a simple landing page with a contact form where users can send us an email with an attachment. When the email form is submitted, a `fetch` method sends a `POST` request to a RESTful API. The API is hosted as a Firebase Cloud Function and uses Multer to receive the form data and Mailgun to send the actual email. The designated API route does not properly receive multipart form data at this time. We need you to fix that for us.

We were able to get everything working locally before migrating the API to a Firebase Cloud Function. Once migrated, however, the functionality stopped working. We are testing it by simply sending `POST` requests via Postman directly to the Cloud Function. We run the function in emulator mode in order to test it.

The code is included in the attachments. The `index.js` file is just a general entry point. The real code you need to see is in the `server.js` file. It is a simple NodeJS/ExpressJS server that provides a `POST` route. The `/api/send-email` route is the culprit. Anytime we send form data to this route, the `name`, `email`, and `message` variables are undefined because no data seems to be attached to the `req.body` item. We do not understand why because the Multer middleware is supposed to enable the receiving of multipart form data.

There is a third file attachment showing a screenshot of the Postman `POST` request. The response is saying that `from` is missing because the `req.body` was empty and the `from` variable could not subsequently be assigned.

I need someone that understands Firebase Cloud Functions and Multer to fix this quickly. If you can spot the issue in the files, please respond with:

> Let me fix that for you!

Many thanks!

## Acceptance Criteria

- Critical: `/api/send-email` route correctly receives `multipart/form-data`, including `name`, `email`, `message`, and file attachment.
- Critical: Uploaded files are processed and attached to the email via Mailgun.
- Critical: Emails are sent successfully using Mailgun with the provided API key and domain.
- Critical: Function works when deployed as a Firebase Cloud Function and can be tested locally in emulator mode.
- Critical: The `POST` request body is correctly parsed so that `req.body` contains `name`, `email`, and `message`.
- Critical: Response returns appropriate success or error messages in JSON format.

## Fix Implemented

The `/api/send-email` route was updated to work correctly in Firebase Cloud Functions.

Firebase Cloud Functions exposes the original request payload through `req.rawBody`. Multer expects to read from a normal live request stream, so it can fail to populate `req.body` and `req.file` after the app is deployed as a Firebase HTTP function.

The fix replaces Multer with `busboy` for multipart parsing. The route now parses `multipart/form-data` from `req.rawBody`, extracts the `name`, `email`, `message`, and `recipient` fields, reads the uploaded file into a buffer, and attaches that file to the Mailgun email.

The route also now:

- Validates that the request is `multipart/form-data`.
- Returns `400` JSON errors for invalid requests or missing required fields.
- Returns `500` JSON errors for Mailgun or server failures.
- Returns a JSON success response when the email is sent.
- Uses Firebase secrets for `MAILGUN_API_KEY` and `MAILGUN_DOMAIN`.
- Sends from `postmaster@MAILGUN_DOMAIN` and sets the form submitter as `Reply-To`.
- Runs on the Node.js 22 Firebase Functions runtime.

## Local Testing

Create `functions/.secret.local` for emulator testing:

```env
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=your_mailgun_domain
```

Start the emulator from the project root:

```bash
firebase emulators:start --only functions
```

Test with Insomnia using:

```text
POST http://127.0.0.1:5001/fix-firebase-cloud-function/us-central1/sendEmailFunction/api/send-email
```

Use a `Multipart Form` body with these fields:

```text
name       Text
email      Text
message    Text
recipient  Text
file       File
```

Do not manually set the `Content-Type` header. Insomnia will set the multipart boundary automatically.

## Deployment

Set the production Firebase secrets:

```bash
firebase functions:secrets:set MAILGUN_API_KEY
firebase functions:secrets:set MAILGUN_DOMAIN
```

Deploy the function:

```bash
firebase deploy --only functions
```
