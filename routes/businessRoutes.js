const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
require('dotenv').config();

const prisma = new PrismaClient();
const router = express.Router();

// Create a Business
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user || user.role !== 'business_owner') {
      return res.status(403).json({ message: 'Only business owners can create a business.' });
    }

    const existingBusiness = await prisma.tenant.findFirst({ where: { ownerId: user.id } });
    if (existingBusiness) {
      return res.status(400).json({ message: 'You already own a business.' });
    }

    const business = await prisma.tenant.create({ data: { name, ownerId: user.id } });

    res.json({ message: 'Business created successfully', business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Business by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const business = await prisma.tenant.findUnique({
      where: { id: req.params.id },
      include: { services: true, bookings: true }
    });

    if (!business) return res.status(404).json({ message: 'Business not found' });

    res.json(business);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Business
router.put('/:id', authMiddleware, async (req, res) => {
  const { name } = req.body;

  try {
    const business = await prisma.tenant.update({
      where: { id: req.params.id, ownerId: req.user.id },
      data: { name },
    });

    res.json({ message: 'Business updated successfully', business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Business
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id, ownerId: req.user.id } });

    res.json({ message: 'Business deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;