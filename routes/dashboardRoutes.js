const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// Get Business Owner Dashboard
router.get('/', authMiddleware, roleMiddleware(['business_owner']), async (req, res) => {
  try {
    // Find the business owned by the logged-in user
    const business = await prisma.tenant.findFirst({
      where: { ownerId: req.user.id },
      include: { services: true, bookings: true }
    });

    if (!business) {
      return res.status(404).json({ message: 'No business found for this user.' });
    }

    // Get all confirmed and pending bookings
    const bookings = await prisma.booking.findMany({
      where: { tenantId: business.id, status: { in: ['pending', 'confirmed', 'completed'] } },
      include: { service: true, user: true }
    });

    // Count total unique customers
    const totalCustomers = await prisma.booking.groupBy({
      by: ['userId'],
      where: { tenantId: business.id }
    });

    // Count total revenue from completed bookings
    const totalRevenue = await prisma.booking.aggregate({
      where: { tenantId: business.id, status: 'completed' },
      _sum: { service: { select: { price: true } } }
    });

    // Get total services offered
    const totalServices = await prisma.service.count({
      where: { tenantId: business.id }
    });

    // Get most popular services (sorted by number of bookings)
    const popularServices = await prisma.service.findMany({
      where: { tenantId: business.id },
      include: { bookings: true },
      orderBy: { bookings: { _count: 'desc' } },
      take: 5 // Limit to top 5
    });

    // Get booking status summary
    const bookingSummary = await prisma.booking.groupBy({
      by: ['status'],
      where: { tenantId: business.id },
      _count: { _all: true }
    });

    // Monthly Revenue Breakdown (Last 6 Months)
    const monthlyRevenue = await prisma.booking.groupBy({
      by: ['date'],
      where: {
        tenantId: business.id,
        status: 'completed',
        date: { gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) }
      },
      _sum: { service: { select: { price: true } } }
    });

    res.json({
      businessName: business.name,
      totalRevenue: totalRevenue._sum.price || 0,
      totalCustomers: totalCustomers.length || 0,
      totalServices,
      upcomingBookings: bookings.filter(b => b.status === 'pending' || b.status === 'confirmed'),
      completedBookings: bookings.filter(b => b.status === 'completed'),
      bookingSummary,
      mostPopularServices: popularServices,
      monthlyRevenue
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;