const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
require('dotenv').config();

const prisma = new PrismaClient();
const router = express.Router();

// Create a Booking
router.post('/', authMiddleware, roleMiddleware(['business_owner']), async (req, res) => {
  const { tenantId, serviceId, date } = req.body;

  try {
    const booking = await prisma.booking.create({
      data: {
        tenantId,
        userId: req.user.id,
        serviceId,
        date: new Date(date),
        status: 'pending',
      },
    });

    res.json({ message: 'Booking created successfully', booking });
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

// Cancel Booking
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.booking.delete({ where: { id: req.params.id } });

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;