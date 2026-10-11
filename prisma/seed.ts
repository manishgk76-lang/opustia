import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { hashPassword } from '../apps/api/src/utils/password';

const prisma = new PrismaClient();

const categories = [
  { name: 'Plumbing', icon: '🔧' },
  { name: 'Electrical', icon: '⚡' },
  { name: 'AC Repair', icon: '❄️' },
  { name: 'Mobile Repair', icon: '📱' },
  { name: 'Laptop Repair', icon: '💻' },
  { name: 'Appliance Repair', icon: '🏠' },
  { name: 'Mechanic', icon: '🚗' },
  { name: 'Carpentry', icon: '🪚' },
  { name: 'Painting', icon: '🎨' },
  { name: 'Cleaning', icon: '✨' },
];

const demoUsers: Array<{ id: string; name: string; email: string; role: Role }> = [
  { id: 'u_customer_demo', name: 'Aarav Mehta', email: 'customer@opustia.demo', role: 'CUSTOMER' },
  { id: 'u_pro_demo', name: 'Ravi Kumar', email: 'pro@opustia.demo', role: 'PROFESSIONAL' },
  { id: 'u_admin_demo', name: 'Opustia Admin', email: 'admin@opustia.demo', role: 'ADMIN' },
  { id: 'u_neha_demo', name: 'Neha Singh', email: 'neha@opustia.demo', role: 'PROFESSIONAL' },
  { id: 'u_arjun_demo', name: 'Arjun Tech', email: 'arjun@opustia.demo', role: 'PROFESSIONAL' },
];

async function main() {
  for (const category of categories) {
    const slug = category.name.toLowerCase().replace(/ /g, '-');
    await prisma.category.upsert({ where: { slug }, update: { icon: category.icon }, create: { name: category.name, slug, icon: category.icon } });
  }

  const passwordHash = await hashPassword('demo123');
  for (const user of demoUsers) {
    await prisma.user.upsert({ where: { email: user.email }, update: { id: user.id, name: user.name, role: user.role, passwordHash }, create: { ...user, passwordHash } });
  }

  const profiles = [
    { id: 'p1', userId: 'u_pro_demo', category: 'plumbing', businessName: 'Ravi Home Services', rating: 4.8, reviewsCount: 126, completedJobs: 324, onTime: 96, verified: true, priceFrom: 399, latitude: 12.9719, longitude: 77.6412, serviceArea: 'Indiranagar, Bengaluru', description: 'Reliable plumbing and home maintenance with transparent pricing.' },
    { id: 'p2', userId: 'u_neha_demo', category: 'ac-repair', businessName: 'CoolCare AC Experts', rating: 4.9, reviewsCount: 88, completedJobs: 210, onTime: 98, verified: true, priceFrom: 499, latitude: 12.9352, longitude: 77.6245, serviceArea: 'Koramangala, Bengaluru', description: 'Same-day AC service, installation and gas refill.' },
    { id: 'p3', userId: 'u_arjun_demo', category: 'mobile-repair', businessName: 'Arjun Mobile Lab', rating: 4.7, reviewsCount: 64, completedJobs: 180, onTime: 93, verified: true, priceFrom: 299, latitude: 12.9121, longitude: 77.6446, serviceArea: 'HSR Layout, Bengaluru', description: 'Screen, battery and software repairs at your doorstep.' },
  ];

  for (const profile of profiles) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: profile.category } });
    const { category: _slug, ...fields } = profile;
    await prisma.professional.upsert({ where: { id: profile.id }, update: { ...fields, categoryId: category.id }, create: { ...fields, categoryId: category.id } });
  }

  console.log(`Seeded ${categories.length} categories, ${demoUsers.length} demo users, and ${profiles.length} professional profiles.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
