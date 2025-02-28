const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware, isBusinessOwner } = require('../middleware/roleMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// Create a Business (Only Business Owners)
router.post('/', authMiddleware, roleMiddleware(['business_owner']), async (req, res) => {
  const { name, type } = req.body;

  try {
    const existingBusiness = await prisma.tenant.findFirst({ where: { ownerId: req.user.id } });

    if (existingBusiness) {
      return res.status(400).json({ message: 'You already own a business.' });
    }

    const business = await prisma.tenant.create({
      data: {
        name,
        type,
        ownerId: req.user.id,
      },
    });

    res.json({ message: 'Business created successfully', business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Business (Anyone)
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

// Update Business (Only Business Owners of the Business)
router.put('/:id', authMiddleware, roleMiddleware(['business_owner']), isBusinessOwner, async (req, res) => {
  const { name } = req.body;

  try {
    const business = await prisma.tenant.update({
      where: { id: req.params.id },
      data: { name },
    });

    res.json({ message: 'Business updated successfully', business });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Business (Only Business Owners of the Business)
router.delete('/:id', authMiddleware, roleMiddleware(['business_owner']), isBusinessOwner, async (req, res) => {
  try {
    await prisma.tenant.delete({ where: { id: req.params.id } });

    res.json({ message: 'Business deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;