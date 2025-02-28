const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware, isBusinessOwner } = require('../middleware/roleMiddleware');
const { sendBookingConfirmation, sendBookingReminder, sendCancellationEmail } = require('../utils/utils');

const prisma = new PrismaClient();
const router = express.Router();

// Create a Booking (Supports Recurring)
router.post('/', authMiddleware, async (req, res) => {
  const { tenantId, serviceId, date, recurrence } = req.body;

  try {
    const service = await prisma.service.findUnique({ where: { id: serviceId } });
    const business = await prisma.tenant.findUnique({ where: { id: tenantId } });

    if (!service || !business) return res.status(404).json({ message: 'Service or business not found' });

    let bookings = [];
    let currentDate = new Date(date);

    for (let i = 0; i < 12; i++) { // Limit recurring bookings to 12 future events
      bookings.push({
        tenantId,
        userId: req.user.id,
        serviceId,
        date: new Date(currentDate),
        status: 'pending',
        recurrence: recurrence || null,
      });

      if (recurrence === 'weekly') {
        currentDate.setDate(currentDate.getDate() + 7);
      } else if (recurrence === 'monthly') {
        currentDate.setMonth(currentDate.getMonth() + 1);
      } else {
        break; // Stop if it's a one-time booking
      }
    }

    // Save all bookings in the database
    const createdBookings = await prisma.booking.createMany({ data: bookings });

    // Send confirmation email for the first booking
    await sendBookingConfirmation(req.user.email, service.name, date, business.name);

    res.json({ message: 'Booking(s) created successfully', bookings: createdBookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get User's Bookings
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({ where: { userId: req.params.userId } });

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Business Bookings
router.get('/tenant/:tenantId', authMiddleware, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({ where: { tenantId: req.params.tenantId } });

    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Booking Status
router.put('/:id', authMiddleware, async (req, res) => {
  const { status } = req.body;

  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status },
    });

    res.json({ message: 'Booking updated successfully', booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel Booking (Send Cancellation Email)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, include: { service: true, user: true } });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    await prisma.booking.delete({ where: { id: req.params.id } });

    // Send cancellation email
    await sendCancellationEmail(booking.user.email, booking.service.name, booking.date);

    res.json({ message: 'Booking canceled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;