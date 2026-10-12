import 'dotenv/config';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`🚀 GeoDelivery API listening on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});