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

const mailOptions = {
  from: '"SurakshaVault Admin" <yashshukla609@gmail.com>',
  to: 'yashshukla609@gmail.com',
  subject: 'Test Email Verification',
  text: 'This is a test email to verify SMTP functionality.',
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.log("SMTP Send Error:", error);
  } else {
    console.log("Email sent successfully: " + info.response);
  }
});
