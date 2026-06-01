/**
 * ============================================================
 *  REC Lost & Found — Backend Server
 *  Vivek | Ramgarh Engineering College
 * ============================================================
 *  APIs integrated:
 *   - Auth        : JWT + bcrypt
 *   - Items       : MongoDB via Mongoose
 *   - File Upload : Multer → Cloudinary
 *   - Email       : Nodemailer (Gmail SMTP)
 *   - AI Chat     : Anthropic Claude API (proxy)
 *   - Maps        : Google Maps key served to frontend
 * ============================================================
 */

require('dotenv').config();

const express      = require('express');
const mongoose     = require('mongoose');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const multer       = require('multer');
const cors         = require('cors');
const path         = require('path');
const Anthropic    = require('@anthropic-ai/sdk');
const nodemailer   = require('nodemailer');
const cloudinary   = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Cloudinary Config ──────────────────────────────────────
cloudinary.config({
  cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
  api_key    : process.env.CLOUDINARY_API_KEY,
  api_secret : process.env.CLOUDINARY_API_SECRET,
});

const cloudStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder        : 'rec-lost-found',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 800, crop: 'limit' }],
  },
});
const upload = multer({ storage: cloudStorage, limits: { files: 5 } });

// ── MongoDB Connection ─────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅  MongoDB connected'))
  .catch(err => console.error('❌  MongoDB error:', err));

// ── Schemas & Models ───────────────────────────────────────
const userSchema = new mongoose.Schema({
  name      : { type: String, required: true },
  email     : { type: String, required: true, unique: true, lowercase: true },
  password  : { type: String, required: true },
  rollNumber: { type: String, default: '' },
  role      : { type: String, enum: ['student', 'staff', 'admin'], default: 'student' },
}, { timestamps: true });

const itemSchema = new mongoose.Schema({
  refId      : { type: String, unique: true },
  type       : { type: String, enum: ['lost', 'found'], required: true },
  name       : { type: String, required: true },
  category   : { type: String, required: true },
  description: { type: String, required: true },
  location   : { type: String, required: true },
  date       : { type: String, required: true },
  status     : { type: String, enum: ['active', 'claimed', 'closed'], default: 'active' },
  reward     : { type: Number, default: 0 },
  photos     : [String],
  holdingAt  : { type: String, default: '' },
  contact    : { type: String, required: true },
  phone      : { type: String, default: '' },
  postedBy   : { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  postedByName: String,
  claimedBy  : { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const claimSchema = new mongoose.Schema({
  itemId    : { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
  itemRefId : String,
  claimantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name      : String,
  rollNumber: String,
  email     : String,
  proofDesc : String,
  proofFile : String,
  status    : { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

const User  = mongoose.model('User', userSchema);
const Item  = mongoose.model('Item', itemSchema);
const Claim = mongoose.model('Claim', claimSchema);

// ── Helpers ────────────────────────────────────────────────
function genRefId() {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `REC-${year}-${rand}`;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,  // App password, NOT your Gmail password
  },
});

async function sendMail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"REC Lost & Found" <${process.env.EMAIL_USER}>`,
      to, subject, html,
    });
    console.log(`📧  Email sent to ${to}`);
  } catch (err) {
    console.error('Email error:', err.message);
  }
}

// ── Auth Middleware ────────────────────────────────────────
function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ══════════════════════════════════════════════════════════
//  AUTH ROUTES
// ══════════════════════════════════════════════════════════

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password, rollNumber } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are required' });

    if (await User.findOne({ email }))
      return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, rollNumber });
    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Welcome email
    await sendMail(email, 'Welcome to REC Lost & Found!', `
      <h2>Welcome, ${name}! 👋</h2>
      <p>Your account has been created on the Ramgarh Engineering College Lost & Found platform.</p>
      <p>Start by <a href="${process.env.APP_URL}">browsing listings</a> or reporting a lost/found item.</p>
      <br/><p>— Vivek</p>
    `);

    res.status(201).json({ token, user: { id: user._id, name, email, rollNumber } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(400).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, rollNumber: user.rollNumber } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authRequired, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// ══════════════════════════════════════════════════════════
//  ITEMS ROUTES
// ══════════════════════════════════════════════════════════

// GET /api/items  — search + filter
app.get('/api/items', async (req, res) => {
  try {
    const { type, category, status, q, sort = 'newest', page = 1, limit = 20 } = req.query;
    const filter = {};
    if (type && type !== 'all')     filter.type     = type;
    if (category && category !== 'all') filter.category = category;
    if (status && status !== 'all') filter.status   = status;
    if (q) filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
    ];
    const sortMap = { newest: { createdAt: -1 }, oldest: { createdAt: 1 }, reward: { reward: -1 } };
    const items = await Item.find(filter)
      .sort(sortMap[sort] || { createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Item.countDocuments(filter);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/items/:id
app.get('/api/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('postedBy', 'name email');
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/items/lost
app.post('/api/items/lost', authRequired, upload.array('photos', 5), async (req, res) => {
  try {
    const { name, category, description, location, date, reward, phone } = req.body;
    const photos = req.files ? req.files.map(f => f.path) : [];
    const item = await Item.create({
      refId: genRefId(), type: 'lost', name, category, description, location, date,
      reward: Number(reward) || 0, photos,
      contact: req.user.email, phone,
      postedBy: req.user.id, postedByName: req.user.name,
    });
    await sendMail(req.user.email, `Lost Item Reported — ${item.refId}`, `
      <h2>Your lost item has been posted 📦</h2>
      <p><strong>Item:</strong> ${name}</p>
      <p><strong>Reference ID:</strong> ${item.refId}</p>
      <p><strong>Location:</strong> ${location}</p>
      <p>Share this ID with anyone who may have found your item.</p>
      <br/><p>— Vivek</p>
    `);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/items/found
app.post('/api/items/found', authRequired, upload.array('photos', 5), async (req, res) => {
  try {
    const { name, category, description, location, date, holdingAt, phone } = req.body;
    const photos = req.files ? req.files.map(f => f.path) : [];
    const item = await Item.create({
      refId: genRefId(), type: 'found', name, category, description, location, date,
      holdingAt, photos, contact: req.user.email, phone,
      postedBy: req.user.id, postedByName: req.user.name,
    });
    await sendMail(req.user.email, `Found Item Posted — ${item.refId}`, `
      <h2>Thank you for posting a found item 🔍</h2>
      <p><strong>Item:</strong> ${name}</p>
      <p><strong>Reference ID:</strong> ${item.refId}</p>
      <p>The owner will be able to contact you through the platform to claim it.</p>
      <br/><p>— Vivek</p>
    `);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/items/:id  (owner or admin)
app.delete('/api/items/:id', authRequired, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.postedBy.toString() !== req.user.id)
      return res.status(403).json({ error: 'Not authorised' });
    await item.deleteOne();
    res.json({ message: 'Item deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/items/user/mine  — logged in user's items
app.get('/api/items/user/mine', authRequired, async (req, res) => {
  const items = await Item.find({ postedBy: req.user.id }).sort({ createdAt: -1 });
  res.json(items);
});

// ══════════════════════════════════════════════════════════
//  CLAIMS ROUTES
// ══════════════════════════════════════════════════════════

// POST /api/claims
app.post('/api/claims', authRequired, upload.single('proofFile'), async (req, res) => {
  try {
    const { itemRefId, name, rollNumber, proofDesc } = req.body;
    const item = await Item.findOne({ refId: itemRefId });
    if (!item) return res.status(404).json({ error: 'Item not found with that reference ID' });
    if (item.status === 'claimed') return res.status(400).json({ error: 'This item has already been claimed' });

    const claim = await Claim.create({
      itemId: item._id, itemRefId, claimantId: req.user.id,
      name, rollNumber, email: req.user.email, proofDesc,
      proofFile: req.file ? req.file.path : '',
    });

    // Notify the finder
    if (item.contact) {
      await sendMail(item.contact, `Someone claimed your found item — ${itemRefId}`, `
        <h2>A claim has been submitted 📋</h2>
        <p><strong>Item:</strong> ${item.name}</p>
        <p><strong>Claimant:</strong> ${name} (${req.user.email})</p>
        <p>Please verify the claim and hand over the item if satisfied.</p>
        <br/><p>— Vivek</p>
      `);
    }
    // Notify the claimant
    await sendMail(req.user.email, `Claim Submitted — ${itemRefId}`, `
      <h2>Your claim has been received ✅</h2>
      <p>We have notified the finder of your claim for <strong>${item.name}</strong>.</p>
      <p>They will contact you at this email address to arrange return.</p>
      <br/><p>— Vivek</p>
    `);

    res.status(201).json({ message: 'Claim submitted', claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/claims/:id/approve  (item poster approves)
app.patch('/api/claims/:id/approve', authRequired, async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);
    if (!claim) return res.status(404).json({ error: 'Claim not found' });
    claim.status = 'approved';
    await claim.save();
    await Item.findByIdAndUpdate(claim.itemId, { status: 'claimed', claimedBy: claim.claimantId });
    await sendMail(claim.email, `Your claim has been approved! — ${claim.itemRefId}`, `
      <h2>Great news — your claim is approved! 🎉</h2>
      <p>Please collect your item and consider sending a reward to the finder.</p>
      <br/><p>— Vivek</p>
    `);
    res.json({ message: 'Claim approved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  REWARD ROUTE
// ══════════════════════════════════════════════════════════

// POST /api/rewards
app.post('/api/rewards', authRequired, async (req, res) => {
  try {
    const { itemRefId, amount, method, upiId, accountNumber, ifsc, message } = req.body;
    const item = await Item.findOne({ refId: itemRefId }).populate('postedBy', 'email name');
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // In production: integrate a payment gateway (Razorpay / Stripe) here
    // For now we just notify both parties by email
    const finderEmail = item.type === 'found' ? item.contact : null;
    if (finderEmail) {
      await sendMail(finderEmail, `You've received a reward! — ${itemRefId}`, `
        <h2>Someone sent you a reward 🎁</h2>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>Method:</strong> ${method}</p>
        ${method === 'upi' ? `<p><strong>Your UPI:</strong> ${upiId}</p>` : ''}
        ${method === 'bank' ? `<p><strong>Account:</strong> ${accountNumber} | IFSC: ${ifsc}</p>` : ''}
        ${message ? `<p><strong>Message:</strong> "${message}"</p>` : ''}
        <p>Thank you for your honesty!</p>
      `);
    }
    await sendMail(req.user.email, `Reward Sent — ${itemRefId}`, `
      <h2>Your reward has been recorded ✅</h2>
      <p>₹${amount} reward noted for item ${itemRefId}.</p>
      <p>The finder will be notified to complete the payment.</p>
    `);

    res.json({ message: 'Reward notification sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  AI CHATBOT PROXY  (Claude API)
// ══════════════════════════════════════════════════════════

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages))
      return res.status(400).json({ error: 'messages array required' });

    const response = await anthropic.messages.create({
      model     : 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system    : `You are a helpful assistant for the Ramgarh Engineering College (REC) Lost & Found platform, built by Vivek. Help students and staff with: reporting lost/found items, the verification and claim process, reward system, and general campus lost & found questions. Be concise, warm, and helpful. The platform lets users: report lost items, post found items, verify and claim items, and send rewards.`,
      messages,
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  CONFIG ENDPOINT (send public keys to frontend)
// ══════════════════════════════════════════════════════════

app.get('/api/config', (req, res) => {
  res.json({ googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '' });
});

// ══════════════════════════════════════════════════════════
//  HEALTH CHECK
// ══════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀  Server running at http://localhost:${PORT}`);
  console.log(`📋  API docs: http://localhost:${PORT}/api/health\n`);
});
