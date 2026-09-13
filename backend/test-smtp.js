const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: 'yashshukla609@gmail.com',
    pass: 'cslquvkzjlhwoygc',
  },
});

transporter.verify(function (error, success) {
  if (error) {
    console.log("SMTP Verification Error:", error);
  } else {
    console.log("SMTP Server is ready to take our messages");
  }
});
