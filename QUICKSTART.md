# Quick Start Guide

## Prerequisites Check
- [ ] Node.js installed (check: `node --version`)
- [ ] MongoDB installed and running (check: `mongod --version`)
- [ ] npm or yarn installed (check: `npm --version`)

## Step-by-Step Setup

### 1. Start MongoDB
Open a terminal and start MongoDB:
```bash
mongod
```
Keep this terminal open.

### 2. Start Backend Server
Open a new terminal:
```bash
cd backend
npm run dev
```
You should see:
- "Server running on port 5000"
- "MongoDB connected successfully"

Keep this terminal open.

### 3. Start Frontend
Open another new terminal:
```bash
cd frontend
npm start
```
Your browser should automatically open to http://localhost:3000

## Testing the Application

### Test Upload:
1. Go to "Send File" tab
2. Select a file (< 50MB)
3. Click "Upload File"
4. Note the 4-digit PIN displayed

### Test Download:
1. Go to "Receive File" tab
2. Enter the PIN from step 3 above
3. Click "Verify PIN"
4. Click "Download File"

## Troubleshooting

### Backend won't start:
- Make sure MongoDB is running
- Check if port 5000 is available
- Verify .env file exists in backend folder

### Frontend won't start:
- Check if port 3000 is available
- Try: `npm install` in frontend folder

### Can't upload files:
- Check backend is running on port 5000
- Check uploads folder exists in backend
- Verify file is under 50MB

### Can't download files:
- Verify the PIN is correct
- Check if file hasn't expired (24 hours)
- Make sure backend is running

## Common Commands

### Backend:
```bash
cd backend
npm start          # Start server
npm run dev        # Start with nodemon (auto-restart)
```

### Frontend:
```bash
cd frontend
npm start          # Start development server
npm run build      # Create production build
```

## Environment Variables

Backend `.env` file (already created):
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sharefiles
NODE_ENV=development
```

## Default URLs
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- Health Check: http://localhost:5000/api/health

---

🎉 You're all set! Happy file sharing!
