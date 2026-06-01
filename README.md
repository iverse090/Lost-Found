# 🎓 REC Lost & Found Platform
**Built by Vivek— Ramgarh Engineering College**

A full-stack Lost & Found web application for campus use. Students and staff can report lost/found items, claim ownership, and reward finders — all powered by MongoDB, Cloudinary, Claude AI, and Gmail.

---

## 📁 Project Structure

```
rec-lost-found/
├── public/
│   └── index.html          ← Full frontend (single file)
├── .vscode/
│   ├── extensions.json     ← Recommended VS Code extensions
│   └── launch.json         ← Debug configuration
├── server.js               ← Express backend (all APIs)
├── package.json
├── .env.example            ← Copy to .env and fill in values
├── .gitignore
├── api-tests.http          ← Test all APIs in VS Code
└── README.md
```

---

## ⚡ Quick Start (5 minutes)

### Step 1 — Install VS Code Extensions

Open VS Code, press `Ctrl+Shift+P` → type **"Show Recommended Extensions"** → install all.

Key extensions you need:
| Extension | Purpose |
|---|---|
| **ESLint** | JavaScript linting |
| **Prettier** | Code formatting |
| **DotENV** | .env file highlighting |
| **MongoDB for VS Code** | Browse your database |
| **REST Client** | Test APIs (open api-tests.http) |
| **Error Lens** | Inline error display |

### Step 2 — Install Node.js

Download from https://nodejs.org (choose LTS version, minimum 18.x)

Verify installation:
```bash
node --version   # should show v18.x or higher
npm --version
```

### Step 3 — Install Project Dependencies

Open terminal in VS Code (`Ctrl+`` ` ```) and run:
```bash
npm install
```

This installs: Express, Mongoose, bcryptjs, jsonwebtoken, multer, Cloudinary, Nodemailer, Anthropic SDK, nodemon.

### Step 4 — Create Your .env File

```bash
# In VS Code terminal:
cp .env.example .env
```

Then open `.env` and fill in all the values (see API Setup below).

### Step 5 — Start the Server

```bash
npm run dev        # development (auto-restarts on changes)
# OR
npm start          # production
```

Open your browser at **http://localhost:3000** ✅

---

## 🔑 API Setup Guide

You need **5 external services**. All have free tiers sufficient for a college project.

---

### 1. 🍃 MongoDB Atlas (Database) — FREE

**What it does:** Stores all items, users, and claims permanently.

**Setup:**
1. Go to https://cloud.mongodb.com and create a free account
2. Click **"Build a Database"** → Choose **FREE (M0 Shared)**
3. Select any region → Click **Create**
4. Under **Security → Database Access** → Add a new database user
   - Username: `rec_admin`
   - Password: generate a strong password (save it!)
   - Role: **Read and Write to any database**
5. Under **Security → Network Access** → Add IP Address → **Allow Access from Anywhere** (0.0.0.0/0)
6. Under **Deployment → Database** → Click **Connect** → **Drivers**
   - Copy the connection string — it looks like:
   ```
   mongodb+srv://rec_admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
7. Replace `<password>` with your actual password and add your database name:
   ```
   mongodb+srv://rec_admin:yourpassword@cluster0.xxxxx.mongodb.net/rec-lost-found?retryWrites=true&w=majority
   ```
8. Paste this into `.env` as `MONGODB_URI`

**In VS Code:** Install "MongoDB for VS Code" extension → Connect using the same URI to browse your database visually.

---

### 2. 🤖 Anthropic Claude API (AI Chatbot) — PAID (very cheap)

**What it does:** Powers the AI chatbot assistant on the platform.

**Setup:**
1. Go to https://console.anthropic.com and create an account
2. Go to **API Keys** → **Create Key**
3. Copy the key (starts with `sk-ant-api03-...`)
4. Paste into `.env` as `ANTHROPIC_API_KEY`

**Cost:** ~$0.003 per 1000 tokens. For a college project, usage will be minimal ($1–2/month max).

**How it works in the app:**
- Frontend sends chat messages to `POST /api/chat` on your server
- Your server (with the API key securely stored) forwards to Anthropic
- Response is streamed back to the user
- The API key is **never exposed to the browser**

---

### 3. ☁️ Cloudinary (Image Storage) — FREE

**What it does:** Stores and serves all uploaded photos for lost/found items.

**Setup:**
1. Go to https://cloudinary.com and sign up (free)
2. From the **Dashboard**, copy:
   - **Cloud Name** → paste as `CLOUDINARY_CLOUD_NAME`
   - **API Key** → paste as `CLOUDINARY_API_KEY`
   - **API Secret** → paste as `CLOUDINARY_API_SECRET`

**Free tier:** 25 GB storage + 25 GB bandwidth/month — more than enough.

**How it works:** When a user uploads a photo, `multer` + `multer-storage-cloudinary` automatically uploads it to Cloudinary and returns a URL. That URL is saved in MongoDB and served to the frontend.

---

### 4. 📧 Gmail / Nodemailer (Email Notifications) — FREE

**What it does:** Sends emails when items are posted, claimed, or rewards are sent.

**Setup:**
1. Use your Gmail account (create a new one for the project if you want)
2. Enable 2-Step Verification on your Google Account:
   - Go to https://myaccount.google.com → Security → 2-Step Verification → Turn On
3. Create an App Password:
   - Google Account → Security → 2-Step Verification → **App passwords** (at the bottom)
   - Select app: **Mail** | Select device: **Other** → type "REC Lost Found"
   - Click **Generate** → Copy the 16-character password (format: `xxxx xxxx xxxx xxxx`)
4. In `.env`:
   ```
   EMAIL_USER=youremail@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   ```

> ⚠️ Use the **App Password**, NOT your normal Gmail password.

---

### 5. 🗺️ Google Maps (Campus Map) — FREE

**What it does:** Shows an embedded map of the campus with lost/found hotspots.

**Setup:**
1. Go to https://console.cloud.google.com
2. Create a new project → name it "REC Lost Found"
3. Go to **APIs & Services → Library**
4. Enable these APIs:
   - **Maps JavaScript API**
   - **Maps Embed API**
5. Go to **APIs & Services → Credentials** → **Create Credentials → API Key**
6. Copy the key → paste as `GOOGLE_MAPS_API_KEY` in `.env`
7. (Optional) Restrict the key to your domain for security

**Free tier:** 28,000 map loads/month — plenty for a college platform.

---

## 🔐 JWT Secret

Generate a strong random secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
Copy the output → paste as `JWT_SECRET` in `.env`

---

## 🧪 Testing APIs in VS Code

1. Open `api-tests.http`
2. Install the **REST Client** extension
3. Click **"Send Request"** above any block to test that endpoint
4. After logging in, copy the `token` from the response and paste it at the top of the file where it says `@token = PASTE_YOUR_JWT_TOKEN_HERE`

---

## 🐛 Debugging in VS Code

1. Press `F5` or go to **Run → Start Debugging**
2. Select **"Run Server (Debug)"**
3. Set breakpoints by clicking the line numbers in `server.js`
4. The integrated terminal shows server logs

---

## 🚀 Features

| Feature | Stack |
|---|---|
| User Registration & Login | JWT + bcrypt |
| Report Lost Item (with photos) | MongoDB + Cloudinary |
| Report Found Item (with photos) | MongoDB + Cloudinary |
| Search & Filter Listings | MongoDB queries |
| Item Detail Modal | Frontend JS |
| 4-Step Claim Verification | Frontend wizard + backend |
| Email Notifications | Nodemailer + Gmail |
| Reward System (UPI/Bank/Cash) | Email notification flow |
| AI Chatbot Assistant | Anthropic Claude API |
| Campus Map with Hotspots | Google Maps Embed API |
| My Profile / My Reports | JWT auth + MongoDB |
| Responsive Mobile UI | Pure CSS |

---

## 📋 Complete .env Reference

```env
PORT=3000
APP_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/rec-lost-found
JWT_SECRET=your_64_char_random_hex_string
ANTHROPIC_API_KEY=sk-ant-api03-your_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your@gmail.com
EMAIL_PASS=xxxx xxxx xxxx xxxx
GOOGLE_MAPS_API_KEY=AIzaSy_your_key
```

---

## ❓ Common Issues

| Problem | Fix |
|---|---|
| `Cannot find module` | Run `npm install` |
| MongoDB connection fails | Check URI, whitelist IP 0.0.0.0/0 in Atlas |
| Emails not sending | Use App Password, not normal Gmail password |
| Images not uploading | Verify Cloudinary API key and secret |
| Chatbot not responding | Check ANTHROPIC_API_KEY in .env |
| Port 3000 already in use | Change `PORT=3001` in .env |

---

## 👥 Vivek

Built for Ramgarh Engineering College | 2025
Contact: 1213@gmail.com | 📞 546565656
