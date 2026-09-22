const { connectDB } = require('../src/config/db');

async function update() {
  const db = await connectDB();
  const currentSettings = await db.collection('settings').findOne({ key: 'store_settings' });
  const val = currentSettings ? currentSettings.value : {};
  val.name = 'NURAH by TY';
  val.tagline = 'Nurah by TY / Al Anwar Clothes';
  val.address = 'M.A. Jinnah Road, Iqbal Cloth Market, Shop # M101/1, Karachi, Pakistan';
  val.phone = '03363925950';
  val.whatsapp = '+923363925950';

  await db.collection('settings').updateOne(
    { key: 'store_settings' },
    { $set: { key: 'store_settings', value: val, updatedAt: new Date() } },
    { upsert: true }
  );

  console.log('✓ Successfully updated store_settings in MongoDB Atlas to NURAH by TY / Al Anwar Clothes');
  process.exit(0);
}

update().catch(err => {
  console.error(err);
  process.exit(1);
});
