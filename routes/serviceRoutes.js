const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
require('dotenv').config();

const prisma = new PrismaClient();
const router = express.Router();

// Create a Service
router.post('/', authMiddleware, async (req, res) => {
  const { tenantId, name, description, price, duration } = req.body;

  try {
    const service = await prisma.service.create({
      data: { tenantId, name, description, price, duration },
    });

    res.json({ message: 'Service created successfully', service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Services for a Business
router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const services = await prisma.service.findMany({ where: { tenantId: req.params.tenantId } });

    res.json(services);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Service
router.put('/:id', authMiddleware, async (req, res) => {
  const { name, description, price, duration } = req.body;

  try {
    const service = await prisma.service.update({
      where: { id: req.params.id },
      data: { name, description, price, duration },
    });

    res.json({ message: 'Service updated successfully', service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Service
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.service.delete({ where: { id: req.params.id } });

    res.json({ message: 'Service deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;