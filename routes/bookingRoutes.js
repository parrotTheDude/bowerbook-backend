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

// Cancel a single booking
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { user: true, service: true }
    });

    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    // Ensure only the owner of the booking or a business owner can cancel
    const business = await prisma.tenant.findFirst({ where: { id: booking.tenantId, ownerId: req.user.id } });

    if (req.user.id !== booking.userId && !business) {
      return res.status(403).json({ message: 'You do not have permission to cancel this booking.' });
    }

    await prisma.booking.delete({ where: { id: req.params.id } });

    res.json({ message: 'Booking canceled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Cancel all future recurring bookings
router.delete('/recurring/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { user: true, service: true }
    });

    if (!booking || !booking.recurrence) {
      return res.status(400).json({ message: 'This is not a recurring booking.' });
    }

    // Ensure only the booking owner or business owner can cancel
    const business = await prisma.tenant.findFirst({ where: { id: booking.tenantId, ownerId: req.user.id } });

    if (req.user.id !== booking.userId && !business) {
      return res.status(403).json({ message: 'You do not have permission to cancel this booking.' });
    }

    await prisma.booking.deleteMany({
      where: {
        userId: booking.userId,
        serviceId: booking.serviceId,
        date: { gte: new Date(booking.date) }
      }
    });

    res.json({ message: 'All future recurring bookings have been canceled.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Upcoming & Past Bookings for a Customer
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const upcomingBookings = await prisma.booking.findMany({
      where: { userId: req.user.id, date: { gte: new Date() } },
      include: { service: true }
    });

    const pastBookings = await prisma.booking.findMany({
      where: { userId: req.user.id, date: { lt: new Date() } },
      include: { service: true }
    });

    res.json({ upcomingBookings, pastBookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reschedule Booking
router.put('/reschedule/:id', authMiddleware, async (req, res) => {
  const { newDate } = req.body;

  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id, userId: req.user.id },
      data: { date: new Date(newDate) },
    });

    res.json({ message: 'Booking rescheduled successfully', booking });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;