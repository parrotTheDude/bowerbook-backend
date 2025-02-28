const { PrismaClient } = require('@prisma/client');
const { sendBookingReminder } = require('../utils/utils');

const prisma = new PrismaClient();

async function sendReminders() {
  console.log('⏳ Checking for upcoming bookings...');
  const upcomingBookings = await prisma.booking.findMany({
    where: {
      date: { gte: new Date(), lte: new Date(new Date().setHours(new Date().getHours() + 24)) },
      status: 'confirmed',
    },
    include: { user: true, service: true },
  });

  for (const booking of upcomingBookings) {
    await sendBookingReminder(booking.user.email, booking.service.name, booking.date);
    console.log(`📧 Reminder sent for booking ${booking.id}`);
  }
}

sendReminders()
  .catch((error) => {
    console.error('❌ Error sending reminders:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });