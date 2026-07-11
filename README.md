# ShareFiles - MERN File Sharing Application

A secure file sharing application built with the MERN stack that allows users to share files using 4-digit PIN codes.

## Features

- 📤 **Upload Files**: Upload files up to 50MB
- 📥 **Download Files**: Download files using a 4-digit PIN
- 🔒 **Secure**: PIN-based authentication for file access
- ⏰ **Auto-Expiry**: Files automatically expire after 24 hours
- 🎨 **Modern UI**: Beautiful interface built with Tailwind CSS
- 📱 **Responsive**: Works on all devices

## Tech Stack

### Frontend
- React 19
- Tailwind CSS
- Axios

### Backend
- Node.js
- Express
- MongoDB
- Multer (file uploads)
- Mongoose

## Prerequisites

Before running this application, make sure you have:
- Node.js (v14 or higher)
- MongoDB installed and running locally
- npm or yarn package manager

## Installation

### 1. Clone the repository
```bash
cd sharefiles
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd ../frontend
npm install
```

### 4. Configure Environment Variables
Create a `.env` file in the backend folder (already created) and update if needed:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/sharefiles
NODE_ENV=development
```

## Running the Application

### 1. Start MongoDB
Make sure MongoDB is running on your system:
```bash
mongod
```

### 2. Start the Backend Server
```bash
cd backend
npm run dev
# or
npm start
```
The backend server will run on http://localhost:5000

### 3. Start the Frontend Development Server
Open a new terminal:
```bash
cd frontend
npm start
```
The frontend will run on http://localhost:3000

## Usage

### Sending a File
1. Click on the "Send File" tab
2. Drag and drop a file or click "Browse Files" to select a file
3. Click "Upload File"
4. You'll receive a 4-digit PIN - share this PIN with the recipient

### Receiving a File
1. Click on the "Receive File" tab
2. Enter the 4-digit PIN you received
3. Click "Verify PIN"
4. If valid, file information will be displayed
5. Click "Download File" to download

## API Endpoints

### Upload File
```
POST /api/upload
Content-Type: multipart/form-data
Body: file (form-data)
Response: { success: true, pin: "1234", filename: "...", size: ... }
```

### Get File Info
```
GET /api/file/:pin
Response: { success: true, filename: "...", size: ..., mimetype: "...", createdAt: "..." }
```

### Download File
```
GET /api/download/:pin
Response: File download
```

### Health Check
```
GET /api/health
Response: { status: "OK", message: "Server is running" }
```

## Project Structure

```
sharefiles/
├── backend/
│   ├── models/
│   │   └── File.js          # MongoDB File schema
│   ├── uploads/             # Uploaded files directory
│   ├── .env                 # Environment variables
│   ├── .gitignore
│   ├── package.json
│   └── server.js            # Express server
│
└── frontend/
    ├── public/
    ├── src/
    │   ├── components/
    │   │   ├── Upload.js    # File upload component
    │   │   └── Download.js  # File download component
    │   ├── App.js           # Main app component
    │   ├── index.js
    │   └── index.css        # Tailwind CSS
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

## Security Features

- File size validation (50MB limit)
- 4-digit PIN generation
- Unique PIN for each file
- Automatic file expiration after 24 hours
- CORS protection

## Future Enhancements

- [ ] Email notifications
- [ ] Password protection for files
- [ ] Multiple file upload
- [ ] File compression
- [ ] Download statistics
- [ ] User authentication
- [ ] Cloud storage integration (AWS S3, Azure Blob)

## License

MIT

## Author

Your Name

---

Made with ❤️ using MERN Stack
