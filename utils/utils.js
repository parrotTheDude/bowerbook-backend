const crypto = require('crypto');
const postmark = require('postmark');

const client = new postmark.ServerClient(process.env.POSTMARK_SERVER_TOKEN);

// Generate a random 6-character alphanumeric verification code
const generateVerificationCode = () => crypto.randomBytes(3).toString('hex').toUpperCase();

// Strong Password Regex Validation
const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

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

// Booking Confirmation Email
const sendBookingConfirmation = async (to, serviceName, date, businessName) => {
  const subject = `Booking Confirmed: ${serviceName}`;
  const text = `Your booking for ${serviceName} at ${businessName} on ${date} is confirmed.`;
  await sendEmail(to, subject, text);
};

// Payment Receipt Email
const sendPaymentReceipt = async (to, amount, serviceName) => {
  const subject = `Payment Receipt - ${serviceName}`;
  const text = `Thank you for your payment of $${amount} for ${serviceName}.`;
  await sendEmail(to, subject, text);
};

// Booking Reminder Email (24 hours before)
const sendBookingReminder = async (to, serviceName, date) => {
  const subject = `Reminder: Your Booking for ${serviceName}`;
  const text = `This is a reminder about your booking for ${serviceName} on ${date}.`;
  await sendEmail(to, subject, text);
};

// Booking Cancellation Email
const sendCancellationEmail = async (to, serviceName, date) => {
  const subject = `Booking Canceled: ${serviceName}`;
  const text = `Your booking for ${serviceName} on ${date} has been canceled.`;
  await sendEmail(to, subject, text);
};

module.exports = {
  sendBookingConfirmation,
  sendPaymentReceipt,
  sendBookingReminder,
  sendCancellationEmail,
};

module.exports = { generateVerificationCode, sendEmail, strongPasswordRegex };