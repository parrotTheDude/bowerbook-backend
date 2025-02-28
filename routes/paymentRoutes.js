const express = require('express');
const Stripe = require('stripe');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');
const { sendPaymentReceipt } = require('../utils/utils');

const prisma = new PrismaClient();
const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('❌ STRIPE_SECRET_KEY is missing from .env file');
  }

  router.post('/create-checkout-session', authMiddleware, async (req, res) => {
    const { bookingId } = req.body;
  
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { service: true, tenant: true }
      });
  
      if (!booking) return res.status(404).json({ message: 'Booking not found' });
  
      if (!booking.tenant.stripeAccountId) {
        return res.status(400).json({ message: 'Business does not have a connected Stripe account.' });
      }
  
      // Set your platform fee (in cents)
      const platformFee = Math.round(booking.service.price * 0.05 * 100); // 5% Fee
  
      // Create a Stripe Checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'aud',
              product_data: { name: booking.service.name },
              unit_amount: Math.round(booking.service.price * 100),
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
        metadata: { bookingId: booking.id },
        payment_intent_data: {
          application_fee_amount: platformFee, // ✅ Platform fee
          transfer_data: {
            destination: booking.tenant.stripeAccountId, // ✅ Business receives the payment
          },
        },
      });
  
      res.json({ sessionId: session.id, url: session.url });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });

// Create a Stripe Connect Account
router.post('/create-stripe-account', authMiddleware, roleMiddleware(['business_owner']), async (req, res) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  
      if (!user) return res.status(404).json({ message: 'User not found' });
  
      // Check if user already has a Stripe account
      const existingBusiness = await prisma.tenant.findFirst({
        where: { ownerId: req.user.id }
      });
  
      if (!existingBusiness) return res.status(400).json({ message: 'No business found for this user.' });
  
      if (existingBusiness.stripeAccountId) {
        return res.json({ message: 'Stripe account already connected', stripeAccountId: existingBusiness.stripeAccountId });
      }
  
      // Create a Stripe Connect account
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',  // Change this based on your region
        email: user.email,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
  
      // Store the Stripe Account ID in the database
      await prisma.tenant.update({
        where: { id: existingBusiness.id },
        data: { stripeAccountId: account.id },
      });
  
      // Generate an onboarding link
      const accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.FRONTEND_URL}/dashboard`,
        return_url: `${process.env.FRONTEND_URL}/dashboard`,
        type: 'account_onboarding',
      });
  
      res.json({ message: 'Stripe account created', stripeAccountId: account.id, onboardingUrl: accountLink.url });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }
  });

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
  
    try {
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const bookingId = session.metadata.bookingId;
  
        // Update booking status to "paid"
        const booking = await prisma.booking.update({
          where: { id: bookingId },
          data: { status: 'paid' },
          include: { user: true, service: true },
        });
  
        console.log(`✅ Booking ${bookingId} marked as paid.`);
  
        // Send payment receipt email
        await sendPaymentReceipt(booking.user.email, booking.service.price, booking.service.name);
      }
  
      res.json({ received: true });
    } catch (error) {
      console.error('❌ Webhook Error:', error.message);
      res.status(400).json({ error: 'Webhook handler error' });
    }
  });

module.exports = router;