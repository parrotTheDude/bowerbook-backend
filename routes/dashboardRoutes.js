const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log("🔍 Fetching dashboard data for user:", req.user.id);

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      console.error("❌ User not found:", req.user.id);
      return res.status(404).json({ message: "User not found" });
    }

    let response = { user };

    if (user.role === "business_owner") {
      console.log("📊 Fetching business data...");
      const business = await prisma.tenant.findFirst({
        where: { ownerId: user.id },
        include: { services: true, bookings: true },
      });

      if (!business) {
        console.error("❌ No business found for owner:", user.id);
        return res.status(404).json({ message: "No business found for this user." });
      }

      console.log("📅 Fetching bookings...");
      const bookings = await prisma.booking.findMany({
        where: { tenantId: business.id },
        include: { service: true, user: true },
      });

      console.log("💰 Calculating revenue...");
      const totalRevenue = await prisma.booking.aggregate({
        where: { tenantId: business.id, status: "completed" },
        _sum: { service: { select: { price: true } } },
      });

      console.log("👥 Counting customers...");
      const totalCustomers = await prisma.booking.groupBy({
        by: ["userId"],
        where: { tenantId: business.id },
      });

      console.log("📈 Fetching monthly revenue breakdown...");
      const monthlyRevenue = await prisma.booking.groupBy({
        by: ["date"],
        where: {
          tenantId: business.id,
          status: "completed",
          date: { gte: new Date(new Date().setMonth(new Date().getMonth() - 6)) },
        },
        _sum: { service: { select: { price: true } } },
      });

      response.business = {
        name: business.name,
        totalRevenue: totalRevenue._sum.price || 0,
        totalCustomers: totalCustomers.length || 0,
        monthlyRevenue,
      };

      console.log("✅ Successfully fetched business dashboard data.");
    } else if (user.role === "customer") {
      console.log("📅 Fetching customer bookings...");
      const bookings = await prisma.booking.findMany({
        where: { userId: user.id },
        include: { service: true, tenant: true },
      });

      console.log("✅ Successfully fetched customer dashboard data.");
      response.bookings = bookings;
    }

    res.json(response);
  } catch (error) {
    console.error("❌ Server Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;