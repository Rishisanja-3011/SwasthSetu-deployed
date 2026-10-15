require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const labRoutes = require('./routes/labRoutes');
const seedRoutes = require('./routes/seedRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const authRoutes = require('./routes/authRoutes');
const providerRoutes = require('./routes/providerRoutes');
const patientRoutes = require('./routes/patientRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// Routes
app.use('/api/lab', labRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/patient', patientRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'VaaniDoc - Lab Module API & Bounded Access Guard',
    timestamp: new Date(),
  });
});

// Start Server
async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`=======================================================`);
  console.log(`  VaaniDoc Lab Module Server running on port ${PORT}`);
    console.log(`  API Base: http://localhost:${PORT}/api/lab`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`=======================================================`);
  });
}

startServer().catch((error) => {
  console.error(`[VaaniDoc] Server startup failed: ${error.message}`);
  process.exitCode = 1;
});
