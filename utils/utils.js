const crypto = require('crypto');
const postmark = require('postmark');

const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN);

// Generate a random 6-character alphanumeric verification code
const generateVerificationCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

// Send email using Postmark
const sendEmail = async (to, subject, text) => {
  try {
    await client.sendEmail({
      From: process.env.EMAIL_FROM,
      To: to,
      Subject: subject,
      TextBody: text,
    });
  } catch (error) {
    console.error('Error sending email via Postmark:', error.message);
  }
};

// Strong Password Regex Validation
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

module.exports = { generateVerificationCode, sendEmail, strongPasswordRegex };