// Sample data for local development: `npm run db:seed`. Safe to run more than once.
//
// Two bakeries, so the multi-bakery screens have something to show. Sweet Crumbs has a
// full cake builder linked to stock; Mama's Oven only sells ready-made cakes.
import { prisma, type Prisma } from "../src/lib/prisma.js";

type ProductSeed = Omit<Prisma.ProductCreateManyInput, "bakeryId">;

type OptionSeed = { name: string; price?: number; value?: string; serves?: number; stock?: string };
type GroupSeed = {
  kind: "SHAPE" | "TIERS" | "SIZE" | "FLAVOUR" | "ICING_COLOUR" | "DECORATION";
  name: string;
  multiple?: boolean;
  required?: boolean;
  options: OptionSeed[];
};

const sweetCrumbsGroups: GroupSeed[] = [
  { kind: "SHAPE", name: "Shape", required: true, options: [{ name: "Round", value: "ROUND" }, { name: "Square", value: "SQUARE" }] },
  {
    kind: "TIERS",
    name: "Tiers",
    required: true,
    options: [
      { name: "1 tier", value: "1" },
      { name: "2 tiers", value: "2", price: 30000 },
      { name: "3 tiers", value: "3", price: 60000 },
    ],
  },
  {
    kind: "SIZE",
    name: "Size",
    required: true,
    options: [
      { name: "1 kg", price: 60000, serves: 8 },
      { name: "2 kg", price: 110000, serves: 16 },
      { name: "3 kg", price: 160000, serves: 24 },
      { name: "4 kg+", price: 210000, serves: 32 },
    ],
  },
  {
    kind: "FLAVOUR",
    name: "Flavour",
    required: true,
    options: [
      { name: "Vanilla" },
      { name: "Chocolate", price: 5000 },
      { name: "Red velvet", price: 10000 },
      { name: "Marble", price: 5000 },
    ],
  },
  {
    kind: "ICING_COLOUR",
    name: "Icing colour",
    required: true,
    options: [
      { name: "Vanilla cream", value: "#FBEFD9" },
      { name: "Blush pink", value: "#F5B8C9" },
      { name: "Lilac", value: "#CDB8E8" },
      { name: "Sky blue", value: "#A8CBEA" },
      { name: "Mint", value: "#BCE2C6" },
      { name: "Butter yellow", value: "#F6DC8F" },
      { name: "Chocolate", value: "#7A4A33" },
      { name: "Ruby red", value: "#C23A48" },
    ],
  },
  {
    kind: "DECORATION",
    name: "Decorations",
    multiple: true,
    options: [
      { name: "Pearls", value: "pearls", price: 10000, stock: "Sugar pearls" },
      { name: "Fresh flowers", value: "flowers", price: 15000, stock: "Fresh roses" },
      { name: "Sprinkles", value: "sprinkles", price: 5000, stock: "Rainbow sprinkles" },
      { name: "Candles", value: "candles", price: 5000, stock: "Birthday candles" },
      // Out of stock in the seed data, so the app hides it.
      { name: "Edible gold leaf", value: "gold", price: 20000, stock: "Edible gold leaf" },
    ],
  },
];

const sweetCrumbsStock = [
  { name: "Edible gold leaf", unit: "sheets", quantity: 0, lowAt: 5 },
  { name: "Fresh roses", unit: "stems", quantity: 6, lowAt: 10 },
  { name: "Rainbow sprinkles", unit: "g", quantity: 300, lowAt: 500 },
  { name: "Sugar pearls", unit: "kg", quantity: 1.5, lowAt: 0.5 },
  { name: "Birthday candles", unit: "packs", quantity: 24, lowAt: 5 },
  { name: "White fondant", unit: "kg", quantity: 4, lowAt: 2 },
  // Not linked to any option: private records only.
  { name: "Cake boards, 30 cm", unit: "pcs", quantity: 20, lowAt: 5 },
  { name: "Cake boxes", unit: "pcs", quantity: 35, lowAt: 10 },
];

async function seedSweetCrumbs() {
  const bakery = await prisma.bakery.upsert({
    where: { slug: "sweet-crumbs" },
    create: {
      slug: "sweet-crumbs",
      name: "Sweet Crumbs Bakery",
      about: "Custom cakes for every celebration",
      phone: "0772 000 000",
      address: "Kisaasi Road, Kampala",
      city: "Kampala",
      deliveryAreas: ["Kisaasi", "Ntinda", "Kyanja", "Bukoto", "Naalya"],
      deliveryFee: 5000,
      mobileMoneyNumber: "0772 000 000",
      customCakesPerDay: 4,
      customNoticeDays: 4,
      closedWeekdays: [7],
      handoverTimes: ["09:00", "11:30", "14:00", "17:00"],
      occasions: ["Birthday", "Wedding", "Introduction", "Graduation", "Baby shower", "Anniversary", "Other"],
      isPublished: true,
    },
    update: {
      handoverTimes: ["09:00", "11:30", "14:00", "17:00"],
      occasions: ["Birthday", "Wedding", "Introduction", "Graduation", "Baby shower", "Anniversary", "Other"],
    },
  });
  if ((await prisma.product.count({ where: { bakeryId: bakery.id } })) > 0) return bakery;

  await prisma.product.createMany({
    data: ([
      { name: "Vanilla sponge cake", category: "CAKE", price: 60000, description: "Classic vanilla", sizeLabel: "1 kg", serves: 8, leadTimeDays: 2, customisable: true },
      { name: "Chocolate fudge cake", category: "CAKE", price: 75000, description: "Rich chocolate", sizeLabel: "1 kg", serves: 8, leadTimeDays: 2, customisable: true },
      { name: "Red velvet cake", category: "CAKE", price: 85000, description: "With cream cheese icing", sizeLabel: "1 kg", serves: 8, leadTimeDays: 2, customisable: true },
      { name: "Lemon drizzle cake", category: "CAKE", price: 65000, description: "Lemon glaze", sizeLabel: "1 kg", serves: 8, leadTimeDays: 2 },
      { name: "Cupcakes, box of 6", category: "CUPCAKE", price: 25000, description: "Choice of frosting", leadTimeDays: 1 },
      { name: "Banana bread", category: "BREAD", price: 15000, description: "One loaf", leadTimeDays: 1 },
      { name: "Number candles", category: "EXTRA", price: 5000, description: "Gold, 0 to 9", leadTimeDays: 0, isActive: false },
    ] satisfies ProductSeed[]).map((p) => ({ ...p, bakeryId: bakery.id })),
  });

  await prisma.stockItem.createMany({ data: sweetCrumbsStock.map((s) => ({ ...s, bakeryId: bakery.id })) });
  const stock = new Map(
    (await prisma.stockItem.findMany({ where: { bakeryId: bakery.id } })).map((s) => [s.name, s.id]),
  );

  for (const [position, group] of sweetCrumbsGroups.entries()) {
    await prisma.optionGroup.create({
      data: {
        bakeryId: bakery.id,
        kind: group.kind,
        name: group.name,
        multiple: group.multiple ?? false,
        required: group.required ?? false,
        position,
        options: {
          create: group.options.map((o, i) => ({
            name: o.name,
            price: o.price ?? 0,
            value: o.value,
            serves: o.serves,
            position: i,
            stockItemId: o.stock ? stock.get(o.stock) : undefined,
          })),
        },
      },
    });
  }
  return bakery;
}

async function seedMamasOven() {
  const bakery = await prisma.bakery.upsert({
    where: { slug: "mamas-oven" },
    update: {
      handoverTimes: ["10:00", "13:00", "16:00"],
      occasions: ["Birthday", "Bridal Shower", "Corporate Event", "Graduation", "Baby shower", "Other"],
    },
    create: {
      slug: "mamas-oven",
      name: "Mama’s Oven",
      about: "Home style cakes and bread",
      city: "Kampala",
      address: "Bukoto, Kampala",
      deliveryAreas: ["Bukoto", "Ntinda", "Kamwokya"],
      deliveryFee: 7000,
      customCakesPerDay: 2,
      customNoticeDays: 7,
      handoverTimes: ["10:00", "13:00", "16:00"],
      occasions: ["Birthday", "Bridal Shower", "Corporate Event", "Graduation", "Baby shower", "Other"],
      isPublished: true,
    },
  });
  if ((await prisma.product.count({ where: { bakeryId: bakery.id } })) === 0) {
    await prisma.product.createMany({
      data: ([
        { name: "Carrot cake", category: "CAKE", price: 70000, sizeLabel: "1 kg", serves: 8, leadTimeDays: 2 },
        { name: "Chocolate cake", category: "CAKE", price: 72000, sizeLabel: "1 kg", serves: 8, leadTimeDays: 2 },
        { name: "Brown bread", category: "BREAD", price: 8000, leadTimeDays: 1 },
      ] satisfies ProductSeed[]).map((p) => ({ ...p, bakeryId: bakery.id })),
    });
  }
  return bakery;
}

async function main() {
  const sweetCrumbs = await seedSweetCrumbs();
  await seedMamasOven();

  // Matches VITE_DEV_USER=dev-staff in dashboard/.env.example (the dev auth bypass prefixes ids with "dev:").
  const staff = await prisma.user.upsert({
    where: { firebaseUid: "dev:dev-staff" },
    update: {},
    create: { firebaseUid: "dev:dev-staff", name: "Dev Staff", email: "dev-staff@example.com", emailVerified: true },
  });
  await prisma.bakeryMember.upsert({
    where: { bakeryId_userId: { bakeryId: sweetCrumbs.id, userId: staff.id } },
    update: {},
    create: { bakeryId: sweetCrumbs.id, userId: staff.id, role: "OWNER" },
  });

  console.log("Seeded Sweet Crumbs Bakery and Mama’s Oven, with dev-staff as the Sweet Crumbs owner");
}

main().finally(() => prisma.$disconnect());
