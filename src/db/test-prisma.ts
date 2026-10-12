import { prisma } from './prisma.js';

async function main() {
  console.log('🔌 Testing Prisma Client...');

  const restaurantCount = await prisma.restaurant.count();
  const driverCount = await prisma.driver.count();
  const orderCount = await prisma.order.count();

  console.log(`   restaurants: ${restaurantCount}`);
  console.log(`   drivers:     ${driverCount}`);
  console.log(`   orders:      ${orderCount}`);

  // Typed query: grab one restaurant
  const sample = await prisma.restaurant.findFirst({
    select: { id: true, name: true, address: true, createdAt: true },
  });
  console.log('   sample restaurant:', sample);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Prisma test failed:', err);
  process.exit(1);
});