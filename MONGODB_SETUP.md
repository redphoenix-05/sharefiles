# MongoDB Setup Guide

You have two options for MongoDB:

## Option 1: MongoDB Atlas (Cloud) - RECOMMENDED ✅

**No installation needed! Uses a free cloud database.**

### Steps:

1. **Create Free Account**
   - Go to https://www.mongodb.com/cloud/atlas/register
   - Sign up for a free account

2. **Create a Free Cluster**
   - Click "Create" to create a new cluster
   - Choose the **FREE** tier (M0 Sandbox)
   - Select a cloud provider and region close to you
   - Click "Create Cluster" (takes 3-5 minutes)

3. **Create Database User**
   - Go to "Database Access" in the left sidebar
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and password (save these!)
   - Set privileges to "Read and write to any database"
   - Click "Add User"

4. **Whitelist Your IP**
   - Go to "Network Access" in the left sidebar
   - Click "Add IP Address"
   - Click "Allow Access from Anywhere" (for development)
   - Click "Confirm"

5. **Get Connection String**
   - Go to "Database" in the left sidebar
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string (looks like: `mongodb+srv://...`)

6. **Update .env file**
   - Open `backend/.env`
   - Replace the MONGODB_URI with your connection string
   - Replace `<password>` with your actual password
   - Example:
   ```
   MONGODB_URI=mongodb+srv://myuser:mypassword123@cluster0.abc123.mongodb.net/sharefiles?retryWrites=true&w=majority
   ```

7. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```

---

## Option 2: Local MongoDB Installation

### Windows:

1. **Download MongoDB Community Server**
   - Go to https://www.mongodb.com/try/download/community
   - Download Windows version (.msi installer)
   - Choose "Complete" installation
   - Install as a Windows Service

2. **Add to PATH (if needed)**
   - MongoDB bin folder: `C:\Program Files\MongoDB\Server\7.0\bin`
   - Add to System Environment Variables PATH

3. **Start MongoDB**
   ```powershell
   # MongoDB should auto-start as a service
   # Or manually:
   net start MongoDB
   ```

4. **Verify**
   ```bash
   mongod --version
   ```

### macOS (using Homebrew):
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

### Linux (Ubuntu/Debian):
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

---

## Which Option Should I Choose?

| Feature | MongoDB Atlas | Local MongoDB |
|---------|---------------|---------------|
| Setup Time | 5 minutes | 15-30 minutes |
| Installation | None needed | Required |
| Internet Required | Yes | No |
| Free Tier | 512MB storage | Unlimited |
| Best For | Quick start, beginners | Production, offline work |

**For getting started quickly: Use MongoDB Atlas (Option 1)** ✅

---

## Troubleshooting

### Atlas Connection Issues:
- Make sure you replaced `<password>` in the connection string
- Check if your IP is whitelisted in Network Access
- Ensure the database user has correct permissions

### Local MongoDB Issues:
- Check if MongoDB service is running: `net start MongoDB`
- Verify installation: `mongod --version`
- Check if port 27017 is available

---

## Next Steps

Once MongoDB is set up:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

Your app will be ready at http://localhost:3000!
