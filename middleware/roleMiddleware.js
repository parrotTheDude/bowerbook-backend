const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const roleMiddleware = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user || !requiredRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// Middleware to ensure a business owner can only manage their own business
const isBusinessOwner = async (req, res, next) => {
  try {
    const business = await prisma.tenant.findFirst({
      where: { id: req.params.id, ownerId: req.user.id }
    });

    if (!business) {
      return res.status(403).json({ message: 'Access denied. You do not own this business.' });
    }

    next();
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { roleMiddleware, isBusinessOwner };