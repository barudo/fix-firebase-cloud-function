const admin = require("firebase-admin");
const express = require("express");
const mailgun = require("mailgun-js");
const cors = require("cors");
const busboyFactory = require("busboy");
const {defineSecret} = require("firebase-functions/params");
const logger = require("firebase-functions/logger");

admin.initializeApp();

const mailgunApiKey = defineSecret("MAILGUN_API_KEY");
const mailgunDomain = defineSecret("MAILGUN_DOMAIN");

const corsOptions = {
  origin: "*", // Allow all origins
};

const app = express();

// apply CORS globbaly. You no longer need to include it elsewhere
app.use(cors(corsOptions));
app.use(express.urlencoded({extended: false}));
app.use(express.json());

const parseMultipartForm = (req) =>
  new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const busboy = busboyFactory({
      headers: req.headers,
      limits: {
        fileSize: 1024 * 1024 * 5,
        files: 1,
      },
    });

    busboy.on("field", (fieldname, value) => {
      fields[fieldname] = value;
    });

    busboy.on("file", (fieldname, file, info) => {
      const chunks = [];
      const {filename, mimeType} = info;

      file.on("data", (data) => chunks.push(data));
      file.on("limit", () => {
        reject(new Error("File size must be 5MB or less."));
      });
      file.on("end", () => {
        if (!filename) {
          return;
        }

        files.push({
          fieldname,
          originalname: filename,
          mimetype: mimeType,
          buffer: Buffer.concat(chunks),
        });
      });
    });

    busboy.on("error", reject);
    busboy.on("finish", () => {
      resolve({
        body: fields,
        file: files[0],
      });
    });

    if (req.rawBody) {
      busboy.end(req.rawBody);
      return;
    }

    req.pipe(busboy);
  });

// Enable CORS for preflight OPTIONS request for this route
app.options("/api/send-email", (req, res) => {
  res.status(204).send("");
});

app.post("/api/send-email", async (req, res) => {
  try {
    if (!req.is("multipart/form-data")) {
      return res.status(400).json({
        message: "Request must be multipart/form-data.",
      });
    }

    const {body, file} = await parseMultipartForm(req);
    const {name, email, message, recipient} = body;

    logger.info("Parsed body", {name, email, message, recipient});
    if (file) {
      logger.info("Parsed file", {
        filename: file.originalname,
        mimetype: file.mimetype,
        size: file.buffer.length,
      });
    } else {
      logger.info("No file uploaded.");
    }

    if (!name || !email || !message || !recipient) {
      return res.status(400).json({
        message:
          "Missing required form fields: name, email, message, and recipient.",
      });
    }

    const apiKey = mailgunApiKey.value();
    const domain = mailgunDomain.value();

    if (!apiKey || !domain) {
      logger.error("Mailgun secrets are not configured.");
      return res.status(500).json({
        message: "Email service is not configured.",
      });
    }

    const mg = mailgun({
      apiKey,
      domain,
    });

    let attachment;
    if (file) {
      attachment = new mg.Attachment({
        filename: file.originalname,
        data: file.buffer,
      });
    }

    const data = {
      "from": `${name} <postmaster@${domain}>`,
      "to": recipient,
      "subject": `New Message from ${name}`,
      "html": `<p>${message}</p>`,
      "h:Reply-To": email,
      ...(attachment && {attachment}),
    };

    mg.messages().send(data, (error) => {
      if (error) {
        logger.error("Mailgun send failed", error);
        return res.status(error.statusCode || 500).json({
          message: "Mailgun rejected the email.",
          error: error.message,
        });
      }

      return res.json({message: "Email sent successfully!"});
    });
  } catch (error) {
    logger.error("Failed to process send-email request", error);
    return res.status(500).json({message: error.message});
  }
});

exports.api = app;
