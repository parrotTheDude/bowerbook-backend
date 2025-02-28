const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function generateRecurringBookings() {
  console.log('🔄 Checking for recurring bookings...');

  const recurringBookings = await prisma.booking.findMany({
    where: {
      recurrence: { not: null },
      status: { in: ['confirmed', 'completed'] },
    },
  });

  for (const booking of recurringBookings) {
    const { recurrence, date, tenantId, userId, serviceId } = booking;
    let nextDate = new Date(date);

    if (recurrence === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (recurrence === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else {
      continue;
    }

    // Check if the next occurrence already exists
    const existingBooking = await prisma.booking.findFirst({
      where: { tenantId, userId, serviceId, date: nextDate }
    });

    if (!existingBooking) {
      await prisma.booking.create({
        data: { tenantId, userId, serviceId, date: nextDate, status: 'pending', recurrence },
      });
      console.log(`📅 New recurring booking created for ${userId} on ${nextDate}`);
    }
  }
}

generateRecurringBookings()
  .catch(error => console.error('❌ Error generating recurring bookings:', error))
  .finally(() => prisma.$disconnect());