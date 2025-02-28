const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authLimiter, verificationLimiter } = require('../middleware/rateLimit');
const { generateVerificationCode, sendEmail, strongPasswordRegex } = require('../utils/utils');
const authMiddleware = require('../middleware/authMiddleware');
require('dotenv').config();

const prisma = new PrismaClient();
const router = express.Router();

/** 
 * =============================
 * AUTHENTICATION ROUTES
 * =============================
 */

// Register User
router.post('/register', authLimiter, [
  body('name').notEmpty().withMessage('Name is required'),
  body('last_name').notEmpty().withMessage('Last name is required'),
  body('email').isEmail().withMessage('Invalid email'),
  body('password').matches(strongPasswordRegex).withMessage(
    'Password must be at least 8 characters, include an uppercase letter, a lowercase letter, a number, and a special character'
  ),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, last_name, email, password } = req.body;

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS));
    const user = await prisma.user.create({
      data: { name, last_name, email, password: hashedPassword }
    });

    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'User registered successfully', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Invalid email'),
  body('password').notEmpty().withMessage('Password is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // If the user doesn't exist, send a redirect response
    if (!user) {
      return res.status(302).json({
        message: 'User not found. Redirecting to account creation...',
        redirectUrl: '/register'  // Change this to the actual front-end registration page
      });
    }

    // If the user exists, check the password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ message: 'Login successful', token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

/** 
 * =============================
 * PROFILE MANAGEMENT ROUTES
 * =============================
 */

// Get Current User
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, last_name: true, email: true, createdAt: true }
    });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Update User
router.put('/update', authMiddleware, [
  body('name').optional().notEmpty().withMessage('Name cannot be empty'),
  body('password').optional().matches(strongPasswordRegex).withMessage(
    'Password must be at least 8 characters, include an uppercase letter, a lowercase letter, a number, and a special character'
  ),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, password } = req.body;
  try {
    const updatedData = { ...(name && { name }) };

    if (password) {
      updatedData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updatedData,
    });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete User
router.delete('/delete', authMiddleware, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.user.id } });
    res.json({ message: 'User account deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/** 
 * =============================
 * PASSWORD ROUTES
 * =============================
 */
router.post('/forgot-password', [
  body('email').isEmail().withMessage('Invalid email format'),
], async (req, res) => {
  const { email } = req.body;
  const token = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 mins expiry

  try {
    await prisma.passwordResetToken.deleteMany({ where: { user: { email } } });

    await prisma.passwordResetToken.create({
      data: {
        token,
        expiresAt,
        user: { connect: { email } },
      },
    });

    await sendEmail(email, 'Password Reset', `Use this token to reset your password: ${token}`);

    res.json({ message: 'Password reset token sent' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/reset-password', [
  body('email').isEmail().withMessage('Invalid email format'),
  body('token').notEmpty().withMessage('Token is required'),
  body('newPassword').matches(strongPasswordRegex)
    .withMessage('Password must be at least 8 characters, include an uppercase letter, a lowercase letter, a number, and a special character'),
], async (req, res) => {
  const { email, token, newPassword } = req.body;

  try {
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: { user: { email }, token },
    });

    if (!resetToken || resetToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS));
    await prisma.user.update({
      where: { email },
      data: { password: hashedPassword },
    });

    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });

    res.json({ message: 'Password reset successful' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/** 
 * =============================
 * EMAIL VERIFICATION ROUTES
 * =============================
 */

router.post('/request-verification', [
  body('email').isEmail().withMessage('Invalid email format'),
], async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the email is already registered
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(200).json({ redirectToLogin: true });
    }

    // Generate a verification code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

    await prisma.verificationToken.deleteMany({ where: { user: { email } } });

    await prisma.verificationToken.create({
      data: {
        token: code,
        expiresAt,
        user: { connectOrCreate: { where: { email }, create: { email } } },
      },
    });

    // Send the verification email
    await sendEmail(email, "Your Verification Code", `Your verification code is: ${code}`);

    res.json({ message: "Verification code sent" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify Code
router.post('/verify-code', [
  body('email').isEmail().withMessage('Invalid email format'),
  body('code').isLength({ min: 6, max: 6 }).withMessage('Invalid verification code'),
], async (req, res) => {
  const { email, code } = req.body;

  try {
    const verificationToken = await prisma.verificationToken.findFirst({
      where: { user: { email }, token: code },
      include: { user: true },
    });

    if (!verificationToken || verificationToken.expiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    await prisma.user.update({ where: { email }, data: { email_verified_at: new Date() } });
    await prisma.verificationToken.delete({ where: { id: verificationToken.id } });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Complete Registration
router.post('/complete-registration', [
  body('email').isEmail().withMessage('Invalid email format'),
  body('name').notEmpty().withMessage('Name is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(strongPasswordRegex).withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, name, password } = req.body;

  try {
    // Check if the email is verified
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.email_verified_at) {
      return res.status(400).json({ message: 'Email is not verified' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS));

    // Update the user with their name and password
    await prisma.user.update({
      where: { email },
      data: { name, password: hashedPassword },
    });

    res.json({ message: 'Registration completed successfully' });

  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/resend-verification', [
  body('email').isEmail().withMessage('Invalid email format'),
], async (req, res) => {
  const { email } = req.body;
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

  try {
    // Check if the user is already registered
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser && existingUser.password) {
      return res.status(400).json({ message: 'This email is already registered. Please log in.' });
    }

    // Delete any existing verification token for this email
    await prisma.verificationToken.deleteMany({
      where: { user: { email } }
    });

    // Create a new verification token
    await prisma.verificationToken.create({
      data: {
        token: code,
        expiresAt,
        user: {
          connectOrCreate: {
            where: { email },
            create: { email }
          }
        },
      },
    });

    // Send new verification email
    await sendEmail(email, 'Your New Verification Code', `Your new verification code is: ${code}\nIt expires in 1 hour.`);

    res.json({ message: 'New verification code sent' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/select-role', authMiddleware, async (req, res) => {
  const { role } = req.body;

  if (!["business_owner", "customer"].includes(role)) {
    return res.status(400).json({ message: "Invalid role selection." });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { role },
    });

    let redirectUrl = role === "business_owner" ? "/create-business" : "/dashboard";

    res.json({ message: `Role selected: ${role}`, redirectUrl });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;