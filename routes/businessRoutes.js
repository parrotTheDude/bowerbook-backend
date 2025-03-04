const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/authMiddleware');
const { roleMiddleware, isBusinessOwner } = require('../middleware/roleMiddleware');

const prisma = new PrismaClient();
const router = express.Router();

// Create a Business (Only Business Owners)
router.post('/', authMiddleware, async (req, res) => {
  console.log("🛠️ Creating business for user:", req.user.id);

  try {
    // Fetch the latest user data from the database
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      console.error("❌ User not found in database:", req.user.id);
      return res.status(404).json({ message: "User not found." });
    }

    console.log("🔍 User role:", user.role); // Log role to debug

    if (user.role !== "business_owner") {
      console.error("❌ Access denied: User is not a business owner.");
      return res.status(403).json({ message: "Access denied. Insufficient permissions." });
    }

    const { name, type } = req.body;

    // Ensure the user does not already have a business
    const existingBusiness = await prisma.tenant.findFirst({ where: { ownerId: req.user.id } });

    if (existingBusiness) {
      return res.status(400).json({ message: "You already own a business." });
    }

    // Create the business
    const business = await prisma.tenant.create({
      data: {
        name,
        type,
        ownerId: req.user.id,
      },
    });

    console.log("✅ Business created successfully:", business);
    res.json({ message: "Business created successfully", business });
  } catch (error) {
    console.error("❌ Server Error:", error);
    res.status(500).json({ message: "Server error" });
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