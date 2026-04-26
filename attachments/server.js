const admin = require("firebase-admin");
const express = require("express");
const mailgun = require("mailgun-js");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

admin.initializeApp();

const corsOptions = {
  origin: "*", // Allow all origins
};

const app = express();

// apply CORS globbaly. You no longer need to include it elsewhere
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

const upload = multer(
    {
      storage: multer.memoryStorage(), limits: {fileSize: 1024 * 1024 * 5},
    });

// Enable CORS for preflight OPTIONS request for this route
app.options("/api/send-email");

app.post("/api/send-email", upload.single("file"), (req, res, next) => {
  // Log the parsed form data and file information
  logger.info("Parsed body: ", JSON.stringify(req.body));
  if (req.file) {
    logger.info("Parsed file: ", req.file.originalname);
  } else {
    logger.info("No file uploaded.");
  }

  // Proceed to the next middleware or request handler
  next();
}, (req, res) => {
  const {name, email, message} = req.body;
  logger.info(JSON.stringify({name, email, message}));

  // const mg = mailgun({
  //  apiKey: defineSecret("MAILGUN_API_KEY").value(),
  //  domain: defineSecret("MAILGUN_DOMAIN").value(),
  // });

  const apiKeySecret = defineSecret("MAILGUN_API_KEY");
  const apiKey = apiKeySecret.value();
  const domainSecret = defineSecret("MAILGUN_DOMAIN");
  const domain = domainSecret.value();

  if (apiKey) {
    logger.info("Successfully retrieved MAILGUN_API_KEY");
  } else {
    logger.error("Failed to retrieve MAILGUN_API_KEY");
  }
  if (domain) {
    logger.info("Successfully retrieved MAILGUN_DOMAIN");
  } else {
    logger.error("Failed to retrieve MAILGUN_DOMAIN");
  }

  const mg = mailgun({
    apiKey,
    domain,
  });

  // logger.info(name, email, message);

  let attachment;
  if (req.file) {
    attachment = new mg.Attachment({
      filename: req.file.originalname,
      data: req.file.buffer,
    });
  }

  const data = {
    from: email,
    to: "sadilek@gmail.com",
    subject: `New Message from ${name}`,
    html: `<p>${message}</p>`,
    ...(attachment && {attachment}),
  };

  /* future: refactor callback into async/await for improved readability */
  mg.messages().send(data, (error, body) => {
    if (error) {
      console.log(error);

      if (!res.headersSent) {
        res.status(500).send({message: error.message});
      }
    }

    if (!res.headersSent) {
      res.send({message: "Email sent succesfully!"});
    }
  });
});

exports.api = app;
