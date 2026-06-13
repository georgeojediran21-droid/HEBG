﻿require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { Server } = require('socket.io');

// Security modules
let cookieParser;
let rateLimit;
try {
  cookieParser = require('cookie-parser');
} catch (e) {
  console.warn('cookie-parser not installed, using fallback');
}
try {
  rateLimit = require('express-rate-limit');
} catch (e) {
  console.warn('express-rate-limit not installed, using fallback');
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-this-password';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-long-random-secret';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
const NODE_ENV = process.env.NODE_ENV || 'development';
const io = new Server(server, {
  cors: {
    origin: [ALLOWED_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
  }
});
let liveAdminSocketId = null;

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Rate limiting configuration
const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '10'); // Increased to 10 attempts
const LOGIN_WINDOW_MS = parseInt(process.env.LOGIN_WINDOW_MS || '300000'); // Reduced to 5 minutes (300,000ms)

const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(rootDir, 'uploads');
const chatUploadsDir = path.join(uploadsDir, 'chat');
const profilesDir = path.join(uploadsDir, 'profiles'); // New: Directory for profile pictures
const sermonsFile = path.join(dataDir, 'sermons.json');
const submissionsFile = path.join(dataDir, 'submissions.json');
const usersFile = path.join(dataDir, 'users.json');
const messagesFile = path.join(dataDir, 'messages.json');
const liveStreamFile = path.join(dataDir, 'liveStream.json');
const adminConfigFile = path.join(dataDir, 'admin.json');

const adminProfileImageFile = path.join(dataDir, 'admin_profile.json'); // New: Store admin profile image URL
const allowedTypes = {
  audio: {
    folder: 'audio',
    mime: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac', 'audio/ogg'],
    ext: ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
  },
  pdf: {
    folder: 'pdf',
    mime: ['application/pdf'],
    ext: ['.pdf']
  },
  video: {
    folder: 'video',
    mime: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    ext: ['.mp4', '.webm', '.ogv', '.mov']
  }
};

fs.mkdirSync(dataDir, { recursive: true });
for (const type of Object.values(allowedTypes)) {
  fs.mkdirSync(path.join(uploadsDir, type.folder), { recursive: true });
}
fs.mkdirSync(chatUploadsDir, { recursive: true });
if (!fs.existsSync(sermonsFile)) {
  fs.writeFileSync(sermonsFile, '[]\n');
}
if (!fs.existsSync(submissionsFile)) {
  fs.writeFileSync(submissionsFile, JSON.stringify({ contacts: [], prayers: [], registrations: [], newsletters: [] }, null, 2));
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, '[]\n');
}
if (!fs.existsSync(messagesFile)) {
  fs.writeFileSync(messagesFile, '[]\n');
}
if (!fs.existsSync(liveStreamFile)) {
  fs.writeFileSync(liveStreamFile, JSON.stringify({ isLive: false, title: '', description: '', streamUrl: '' }, null, 2));
}
if (!fs.existsSync(adminConfigFile)) {
  const { salt, hash } = hashPassword(ADMIN_PASSWORD);
  fs.writeFileSync(adminConfigFile, JSON.stringify({ username: ADMIN_USERNAME, passwordHash: hash, passwordSalt: salt }, null, 2));
}
if (!fs.existsSync(adminProfileImageFile)) { // New
  fs.writeFileSync(adminProfileImageFile, JSON.stringify({ profileImageUrl: null }, null, 2));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security Middleware: Add security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' fonts.googleapis.com cdn.jsdelivr.net; font-src fonts.googleapis.com fonts.gstatic.com cdn.jsdelivr.net; img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com https://www.transparenttextures.com; media-src 'self' blob:; frame-src 'self' https://www.youtube.com https://player.vimeo.com; connect-src 'self' http://localhost:3000 http://127.0.0.1:3000");
  next();
});

// CORS with whitelist
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow localhost for development, restrict in production
  const allowedOrigins = [ALLOWED_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'];

  if (NODE_ENV === 'development' && origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', 'null');
  }

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Rate limiting middleware for login endpoint
const loginLimiter = rateLimit ? rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: MAX_LOGIN_ATTEMPTS,
  message: 'Too many login attempts, please try again later.',
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => NODE_ENV === 'development',
}) : (req, res, next) => next(); // Fallback if package not installed
app.use('/uploads', express.static(uploadsDir));

const publicPages = {
  '/': 'index.html',
  '/index.html': 'index.html',
  '/sermons.html': 'sermons.html',
  '/admin.html': 'admin.html',
  '/sql-lab.html': 'sql-lab.html',
  '/join.html': 'join.html',
  '/login.html': 'login.html',
  '/member.html': 'member.html',
  '/contact.html': 'contact.html',
  '/prayer.html': 'Prayer.html',
  '/Prayer.html': 'Prayer.html',
  '/vegetarian.html': 'vegetarian.html'
};

app.get(Object.keys(publicPages), (req, res) => {
  res.sendFile(path.join(rootDir, publicPages[req.path]));
});

app.get('/style.css', (req, res) => {
  res.sendFile(path.join(rootDir, 'style.css'));
});

app.get('/dashboard-chat.js', (req, res) => {
  res.sendFile(path.join(rootDir, 'dashboard-chat.js'));
});

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const type = req.body.type;
    const config = allowedTypes[type];

    if (!config) {
      return cb(new Error('Choose audio, pdf, or video before uploading.'));
    }

    cb(null, path.join(uploadsDir, config.folder));
  },
  filename(req, file, cb) {
    const safeName = path
      .basename(file.originalname, path.extname(file.originalname))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'sermon';
    const ext = path.extname(file.originalname).toLowerCase();

    cb(null, `${Date.now()}-${safeName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 500  // 500MB max
  },
  fileFilter(req, file, cb) {
    const type = req.body.type;
    const config = allowedTypes[type];
    const ext = path.extname(file.originalname).toLowerCase();

    // Validate type
    if (!config) {
      return cb(new Error('Invalid sermon type.'));
    }

    // Strict MIME type and extension validation
    if (!config.mime.includes(file.mimetype) || !config.ext.includes(ext)) {
      return cb(new Error(`Only valid ${type} files are allowed. Invalid MIME type or extension.`));
    }

    // Prevent double extensions (e.g., file.php.mp3)
    const doubleExtMatch = file.originalname.toLowerCase().match(/\.(\w+)\.\w+$/);
    if (doubleExtMatch && !['.tar', '.gz'].includes(doubleExtMatch[0].substring(0, 4))) {
      return cb(new Error('Files with multiple extensions are not allowed.'));
    }

    // Whitelist allowed extensions strictly
    const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.pdf', '.mp4', '.webm', '.ogv', '.mov'];
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(new Error('This file extension is not allowed.'));
    }

    cb(null, true);
  }
});

const chatUpload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, chatUploadsDir);
    },
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = path
        .basename(file.originalname, ext)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'chat-file';

      cb(null, `${Date.now()}-${safeName}${ext}`);
    }
  }),
  limits: {
    fileSize: 1024 * 1024 * 25
  },
  fileFilter(req, file, cb) {
    const allowedMime = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/webm',
      'audio/ogg',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'text/plain'
    ];

    if (!allowedMime.includes(file.mimetype)) {
      return cb(new Error('This chat attachment type is not allowed.'));
    }

    cb(null, true);
  }
});

const profileStorage = multer.diskStorage({ // New: Multer storage for profile pictures
  destination(req, file, cb) {
    const targetDir = path.join(profilesDir, req.auth.type === 'admin' ? 'admin' : 'users');
    fs.mkdirSync(targetDir, { recursive: true }); // Ensure directory exists
    cb(null, targetDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path
      .basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'profile';
    const userId = req.auth.type === 'admin' ? 'admin' : req.user.id;
    cb(null, `${userId}-${safeName}${ext}`);
  }
});

const profileUpload = multer({ // New: Multer instance for profile pictures
  storage: profileStorage,
  limits: {
    fileSize: 1024 * 1024 * 5 // 5MB max
  },
  fileFilter(req, file, cb) {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMime.includes(file.mimetype)) {
      return cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed for profile pictures.'));
    }
    cb(null, true);
  }
});

// End new multer for profile pictures


function readSermons() {
  try {
    return JSON.parse(fs.readFileSync(sermonsFile, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    console.error('Could not read sermons data:', error);
    return [];
  }
}

function writeSermons(sermons) {
  fs.writeFileSync(sermonsFile, JSON.stringify(sermons, null, 2));
}

function readSubmissions() {
  try {
    const emptySubmissions = { contacts: [], prayers: [], registrations: [], newsletters: [] };
    const savedSubmissions = JSON.parse(fs.readFileSync(submissionsFile, 'utf8').replace(/^\uFEFF/, ''));

    return {
      contacts: Array.isArray(savedSubmissions.contacts) ? savedSubmissions.contacts : emptySubmissions.contacts,
      prayers: Array.isArray(savedSubmissions.prayers) ? savedSubmissions.prayers : emptySubmissions.prayers,
      registrations: Array.isArray(savedSubmissions.registrations) ? savedSubmissions.registrations : emptySubmissions.registrations,
      newsletters: Array.isArray(savedSubmissions.newsletters) ? savedSubmissions.newsletters : emptySubmissions.newsletters
    };
  } catch (error) {
    console.error('Could not read submissions data:', error);
    return { contacts: [], prayers: [], registrations: [], newsletters: [] };
  }
}

function writeSubmissions(submissions) {
  fs.writeFileSync(submissionsFile, JSON.stringify(submissions, null, 2));
}

function readUsers() {
  try {
    const users = JSON.parse(fs.readFileSync(usersFile, 'utf8').replace(/^\uFEFF/, ''));
    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error('Could not read users data:', error);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function readLiveStream() {
  try {
    const liveStream = JSON.parse(fs.readFileSync(liveStreamFile, 'utf8').replace(/^\uFEFF/, ''));
    return {
      isLive: Boolean(liveStream.isLive),
      title: cleanText(liveStream.title, 200),
      description: cleanText(liveStream.description, 1000),
      streamUrl: cleanText(liveStream.streamUrl, 500),
      streamType: liveStream.streamType === 'audio' ? 'audio' : 'video',
      startedAt: liveStream.startedAt || null
    };
  } catch (error) {
    console.error('Could not read live stream data:', error);
    return { isLive: false, title: '', description: '', streamUrl: '', streamType: 'video', startedAt: null };
  }
}

function writeLiveStream(liveStream) {
  fs.writeFileSync(liveStreamFile, JSON.stringify(liveStream, null, 2));
}

io.on('connection', (socket) => {
  socket.on('admin-live-ready', () => {
    liveAdminSocketId = socket.id;
    socket.broadcast.emit('admin-live-ready');
  });

  socket.on('viewer-live-ready', () => {
    if (!liveAdminSocketId) {
      socket.emit('admin-live-unavailable');
      return;
    }

    io.to(liveAdminSocketId).emit('viewer-live-ready', { viewerId: socket.id });
  });

  socket.on('live-offer', ({ viewerId, offer }) => {
    if (!viewerId || !offer) return;
    io.to(viewerId).emit('live-offer', { adminId: socket.id, offer });
  });

  socket.on('live-answer', ({ adminId, answer }) => {
    if (!adminId || !answer) return;
    io.to(adminId).emit('live-answer', { viewerId: socket.id, answer });
  });

  socket.on('live-ice-candidate', ({ targetId, candidate }) => {
    if (!targetId || !candidate) return;
    io.to(targetId).emit('live-ice-candidate', { fromId: socket.id, candidate });
  });

  socket.on('admin-live-ended', () => {
    if (liveAdminSocketId === socket.id) {
      liveAdminSocketId = null;
    }
    socket.broadcast.emit('admin-live-ended');
  });

  socket.on('disconnect', () => {
    if (liveAdminSocketId === socket.id) {
      liveAdminSocketId = null;
      socket.broadcast.emit('admin-live-ended');
    }
  });
});

function readAdminConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(adminConfigFile, 'utf8').replace(/^\uFEFF/, '')); // Existing admin config
    const profile = JSON.parse(fs.readFileSync(adminProfileImageFile, 'utf8').replace(/^\uFEFF/, '')); // New: Read admin profile image URL
    return config && typeof config.username === 'string' ? { ...config, profileImageUrl: profile.profileImageUrl } : null; // New: Merge profile image URL
  } catch (error) {
    console.error('Could not read admin config:', error);
    // Fallback to default values if file is missing or corrupted
    return null;
  }
}

function writeAdminConfig(config) {
  fs.writeFileSync(adminConfigFile, JSON.stringify(config, null, 2));
}
function writeAdminConfigWithProfile(config) { // New: Separate function to write admin config and profile image
  const { username, passwordHash, passwordSalt, profileImageUrl, resetToken, resetExpires } = config;
  const out = { username, passwordHash, passwordSalt };
  if (resetToken) out.resetToken = resetToken;
  if (resetExpires) out.resetExpires = resetExpires;
  fs.writeFileSync(adminConfigFile, JSON.stringify(out, null, 2));
  fs.writeFileSync(adminProfileImageFile, JSON.stringify({ profileImageUrl }, null, 2));
}
function readMessages() {
  try {
    const messages = JSON.parse(fs.readFileSync(messagesFile, 'utf8').replace(/^\uFEFF/, ''));
    return Array.isArray(messages) ? messages : [];
  } catch (error) {
    console.error('Could not read messages data:', error);
    return [];
  }
}

function writeMessages(messages) {
  fs.writeFileSync(messagesFile, JSON.stringify(messages, null, 2));
}

function getParticipantIdFromAuth(req) {
  return req.auth.type === 'admin' ? 'admin' : req.user.id;
}

function getDirectConversationId(firstId, secondId) {
  return `direct:${[firstId, secondId].sort().join(':')}`;
}

function getConversationParticipants(conversationId) {
  if (conversationId === 'group:main') return ['admin', 'members'];
  if (!conversationId.startsWith('direct:')) return [];
  return conversationId.split(':').slice(1);
}

function canAccessConversation(req, conversationId) {
  if (conversationId === 'group:main') return true;
  const participantId = getParticipantIdFromAuth(req);
  const participants = getConversationParticipants(conversationId);

  return participants.length === 2 && participants.includes(participantId);
}

function getSenderFromRequest(req) {
  return req.auth.type === 'admin'
    ? { id: 'admin', fullName: 'Admin', role: 'admin' }
    : { id: req.user.id, fullName: req.user.fullName, role: req.user.role || 'member' };
}

function getChatAttachment(file) {
  if (!file) return null;

  const type = file.mimetype.startsWith('image/')
    ? 'image'
    : file.mimetype.startsWith('audio/')
      ? 'audio'
      : file.mimetype.startsWith('video/')
        ? 'video'
        : 'file';

  return {
    type,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/uploads/chat/${file.filename}`
  };
}

function getChatConversations(req) {
  const users = readUsers().sort((a, b) => a.fullName.localeCompare(b.fullName));
  const participantId = getParticipantIdFromAuth(req);
  const messages = readMessages();
  const lastMessageFor = (conversationId) => messages
    .filter((message) => (message.conversationId || 'group:main') === conversationId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;

  const conversations = [{
    id: 'group:main',
    type: 'group',
    name: 'Ministry Group',
    subtitle: 'All admins and registered members',
    avatar: 'MG',
    participants: ['admin', ...users.map((user) => user.id)],
    lastMessage: lastMessageFor('group:main')
  }];

  if (req.auth.type === 'admin') {
    users.forEach((user) => {
      const id = getDirectConversationId('admin', user.id);
      conversations.push({
        id,
        type: 'direct',
        name: user.fullName,
        subtitle: `${user.email} - ${user.status || 'member'}`,
        avatar: user.fullName.slice(0, 2).toUpperCase(),
        participants: ['admin', user.id],
        lastMessage: lastMessageFor(id)
      });
    });
  } else {
    conversations.push({
      id: getDirectConversationId('admin', req.user.id),
      type: 'direct',
      name: 'Admin',
      subtitle: 'Private ministry support',
      avatar: 'AD',
      participants: ['admin', req.user.id],
      lastMessage: lastMessageFor(getDirectConversationId('admin', req.user.id))
    });

    users
      .filter((user) => user.id !== req.user.id)
      .forEach((user) => {
        const id = getDirectConversationId(participantId, user.id);
        conversations.push({
          id,
          type: 'direct',
          name: user.fullName,
          subtitle: user.status === 'approved' ? 'Approved member' : 'Registered member',
          avatar: user.fullName.slice(0, 2).toUpperCase(),
          participants: [participantId, user.id],
          lastMessage: lastMessageFor(id)
        });
      });
  }

  return conversations;
}

function getStoredAdminConfig() {
  const config = readAdminConfig();
  if (config && config.username && config.passwordHash && config.passwordSalt) {
    return config; // Now includes profileImageUrl
  }
  return { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, profileImageUrl: null }; // Default profileImageUrl
}

function isValidAdminPassword(password, config) {
  if (config && config.passwordHash && config.passwordSalt) {
    return verifyPassword(password, config);
  }
  return timingSafeStringEqual(password, config.password || '');
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeLoginValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isSafeLoginValue(value, maxLength) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function timingSafeStringEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  if (actualBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

function getLoginAttempt(req) {
  const key = getClientIp(req);
  const now = Date.now();
  const attempt = loginAttempts.get(key);

  if (!attempt || now > attempt.expiresAt) {
    const freshAttempt = { count: 0, expiresAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(key, freshAttempt);
    return { key, attempt: freshAttempt };
  }

  return { key, attempt };
}

function recordFailedLogin(req) {
  const { attempt } = getLoginAttempt(req);
  attempt.count += 1;
}

function clearLoginAttempts(req) {
  loginAttempts.delete(getClientIp(req));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;

  const { hash } = hashPassword(password, user.passwordSalt);
  return timingSafeStringEqual(hash, user.passwordHash);
}

function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function requireSuperAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);

  if (payload && payload.type === 'admin') return next();
  return res.status(403).json({ message: 'Super Admin access required for this action.' });
}

function verifyToken(token) {
  if (!token || !token.includes('.')) return null;

  const [body, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');

  try {
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ message: 'Authentication required.' });

  if (payload.type === 'admin') {
    req.admin = true;
    return next();
  }

  if (payload.type === 'user') {
    const user = readUsers().find((u) => u.id === payload.userId);
    if (user && user.role === 'acting_admin') {
      req.user = user;
      req.admin = true;
      return next();
    }
  }

  return res.status(403).json({ message: 'Admin privileges required.' });
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);

  if (!payload || !['user', 'admin'].includes(payload.type)) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  if (payload.type === 'user') {
    const user = readUsers().find((item) => item.id === payload.userId);
    if (!user) {
      return res.status(401).json({ message: 'Member account not found.' });
    }
    req.user = user;
  }

  req.auth = payload;
  next();
}

function requireUser(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);

  if (!payload || payload.type !== 'user') {
    return res.status(401).json({ message: 'Member login required.' });
  }

  const user = readUsers().find((item) => item.id === payload.userId);
  if (!user) {
    return res.status(401).json({ message: 'Member account not found.' });
  }

  req.user = user;
  next();
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    location: user.location,
    interest: user.interest,
    status: user.status,
    role: user.role,
    profileImageUrl: user.profileImageUrl || null, // New: Include profileImageUrl
    createdAt: user.createdAt
  };
}
app.get('/api/sermons', (req, res) => {
  const sermons = readSermons().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sermons);
});

app.post('/api/contact', (req, res) => {
  const fullName = cleanText(req.body.fullName, 120);
  const email = cleanText(req.body.email, 180);
  const message = cleanText(req.body.message, 2000);

  if (!fullName || !isValidEmail(email) || !message) {
    return res.status(400).json({ message: 'Please provide your name, a valid email, and your message.' });
  }

  const submissions = readSubmissions();
  const contact = {
    id: crypto.randomUUID(),
    fullName,
    email,
    message,
    createdAt: new Date().toISOString()
  };

  submissions.contacts.push(contact);
  writeSubmissions(submissions);

  res.status(201).json({ message: 'Thank you for contacting us. We will get back to you soon.' });
});

app.post('/api/subscribe', (req, res) => {
  const email = cleanText(req.body.email, 180).toLowerCase();

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const submissions = readSubmissions();
  const alreadySubscribed = submissions.newsletters.some((item) => item.email.toLowerCase() === email);

  if (alreadySubscribed) {
    return res.json({ message: 'You are already subscribed to spiritual updates.' });
  }

  submissions.newsletters.push({
    id: crypto.randomUUID(),
    email,
    createdAt: new Date().toISOString()
  });
  writeSubmissions(submissions);

  res.status(201).json({ message: 'You are subscribed to spiritual updates.' });
});

app.post('/api/prayers', (req, res) => {
  const fullName = cleanText(req.body.fullName, 120);
  const email = cleanText(req.body.email, 180);
  const prayerRequest = cleanText(req.body.prayerRequest, 3000);

  if (!fullName || !isValidEmail(email) || !prayerRequest) {
    return res.status(400).json({ message: 'Please provide your name, a valid email, and your prayer request.' });
  }

  const submissions = readSubmissions();
  const prayer = {
    id: crypto.randomUUID(),
    fullName,
    email,
    prayerRequest,
    createdAt: new Date().toISOString()
  };

  submissions.prayers.push(prayer);
  writeSubmissions(submissions);

  res.status(201).json({ message: 'Your prayer request has been submitted. We are praying with you.' });
});

app.post('/api/register', (req, res) => {
  const fullName = cleanText(req.body.fullName, 120);
  const email = cleanText(req.body.email, 180);
  const phone = cleanText(req.body.phone, 60);
  const location = cleanText(req.body.location, 160);
  const interest = cleanText(req.body.interest, 120);
  const message = cleanText(req.body.message, 2000);
  const password = String(req.body.password || '');

  if (!fullName || !isValidEmail(email) || !phone || !location || !interest || password.length < 8) {
    return res.status(400).json({ message: 'Please provide your name, email, phone, location, interest, and a password of at least 8 characters.' });
  }

  const users = readUsers();
  const normalizedEmail = email.toLowerCase();

  if (users.some((user) => user.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ message: 'An account with this email already exists. Please log in instead.' });
  }

  const submissions = readSubmissions();
  const { salt, hash } = hashPassword(password);
  const user = {
    id: crypto.randomUUID(),
    fullName,
    email,
    phone,
    location,
    interest,
    status: 'pending',
    role: 'member',
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString()
  };
  const registration = {
    id: crypto.randomUUID(),
    userId: user.id,
    fullName,
    email,
    phone,
    location,
    interest,
    message,
    status: user.status,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  submissions.registrations.push(registration);
  writeUsers(users);
  writeSubmissions(submissions);

  res.status(201).json({ message: 'Registration received. Your member account is pending admin approval.' });
});

app.post('/api/user/login', (req, res) => {
  const email = cleanText(req.body.email, 180).toLowerCase();
  const password = String(req.body.password || '');
  const user = readUsers().find((item) => item.email.toLowerCase() === email);

  if (!user || !verifyPassword(password, user)) {
    return res.status(401).json({ message: 'Wrong email or password.' });
  }

  const token = signToken({
    type: 'user',
    userId: user.id,
    exp: Date.now() + 1000 * 60 * 60 * 8
  });

  res.json({ token, user: publicUser(user) });
});

app.get('/api/admin/profile', requireAdmin, (req, res) => {
  if (req.user) {
    // Acting Admin (populates from user object)
    return res.json({
      username: req.user.fullName,
      profileImageUrl: req.user.profileImageUrl || null // Ensure profileImageUrl is returned
    });
  }
  
  // Super Admin (username is stored in the token payload)
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const payload = verifyToken(token);
  const adminConfig = getStoredAdminConfig(); // Get the full config including profileImageUrl
  res.json({ username: payload?.username || 'Admin', profileImageUrl: adminConfig.profileImageUrl || null }); // New: return profileImageUrl
});

app.get('/api/user/me', requireUser, (req, res) => {
  res.json(publicUser(req.user));
});

app.get('/api/admin/submissions', requireAdmin, (req, res) => {
  const submissions = readSubmissions();

  res.json({
    contacts: submissions.contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    prayers: submissions.prayers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    registrations: submissions.registrations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    newsletters: submissions.newsletters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  });
});

app.patch('/api/admin/registrations/:id/status', requireAdmin, (req, res) => {
  const status = cleanText(req.body.status, 40);
  const allowedStatuses = ['pending', 'approved'];

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid registration status.' });
  }

  const submissions = readSubmissions();
  const users = readUsers();
  const registration = submissions.registrations.find((item) => item.id === req.params.id);

  if (!registration) {
    return res.status(404).json({ message: 'Registration not found.' });
  }

  registration.status = status;

  if (registration.userId) {
    const user = users.find((item) => item.id === registration.userId);
    if (user) user.status = status;
  }

  writeSubmissions(submissions);
  writeUsers(users);

  res.json({ message: `Registration marked as ${status}.` });
});

app.patch('/api/admin/users/:id/role', requireSuperAdmin, (req, res) => {
  const role = cleanText(req.body.role, 40);
  const allowedRoles = ['member', 'acting_admin'];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: 'Invalid role type.' });
  }

  const users = readUsers();
  const user = users.find((item) => item.id === req.params.id);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  user.role = role;
  writeUsers(users);

  // Also update registration record for UI consistency
  const submissions = readSubmissions();
  const reg = submissions.registrations.find(r => r.userId === user.id);
  if (reg) reg.role = role;
  writeSubmissions(submissions);

  res.json({ message: `User role updated to ${role}.` });
});

app.delete('/api/admin/submissions/:type/:id', requireAdmin, (req, res) => {
  const collectionMap = {
    contacts: 'contacts',
    prayers: 'prayers',
    registrations: 'registrations',
    newsletters: 'newsletters'
  };
  const collectionName = collectionMap[req.params.type];

  if (!collectionName) {
    return res.status(400).json({ message: 'Invalid submission type.' });
  }

  const submissions = readSubmissions();
  const users = readUsers();
  const deletedSubmission = submissions[collectionName].find((item) => item.id === req.params.id);
  const beforeCount = submissions[collectionName].length;
  submissions[collectionName] = submissions[collectionName].filter((item) => item.id !== req.params.id);

  if (submissions[collectionName].length === beforeCount) {
    return res.status(404).json({ message: 'Submission not found.' });
  }

  if (collectionName === 'registrations' && deletedSubmission?.userId) {
    writeUsers(users.filter((user) => user.id !== deletedSubmission.userId));
  }

  writeSubmissions(submissions);
  res.json({ message: 'Submission deleted.' });
});

app.post('/api/admin/login', loginLimiter, (req, res) => {
  const { attempt } = getLoginAttempt(req);

  if (attempt.count >= MAX_LOGIN_ATTEMPTS) {
    return res.status(429).json({ message: 'Too many failed login attempts. Try again in 15 minutes.' });
  }

  const username = normalizeLoginValue(req.body.username);
  const password = normalizeLoginValue(req.body.password);
  const validShape = isSafeLoginValue(username, 80) && isSafeLoginValue(password, 200);
  const adminConfig = getStoredAdminConfig();
  const isValidLogin =
    validShape &&
    timingSafeStringEqual(username, adminConfig.username) &&
    isValidAdminPassword(password, adminConfig);

  if (!isValidLogin) {
    recordFailedLogin(req);
    return res.status(401).json({ message: 'Invalid credentials. Please check your username and password.' });
  }

  clearLoginAttempts(req);

  const token = signToken({
    type: 'admin',
    username,
    exp: Date.now() + 1000 * 60 * 60 * 8
  });

  // Set secure HTTP-only cookie (production use)
  if (NODE_ENV === 'production') {
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 8
    });
  }

  res.json({ token });
});

// Development-friendly password reset: generates a short-lived token and returns it (would be emailed in production)
app.post('/api/admin/request-reset', (req, res) => {
  try {
    const adminConfig = getStoredAdminConfig();
    const token = crypto.randomBytes(20).toString('hex');
    adminConfig.resetToken = token;
    adminConfig.resetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    writeAdminConfigWithProfile(adminConfig);

    return res.json({ message: 'Reset token generated.', token });
  } catch (error) {
    console.error('Could not generate reset token:', error);
    return res.status(500).json({ message: 'Could not generate reset token.' });
  }
});

app.post('/api/admin/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Token and new password (min 8 chars) are required.' });
    }

    const adminConfig = getStoredAdminConfig();
    if (!adminConfig.resetToken || adminConfig.resetToken !== token || Date.now() > (adminConfig.resetExpires || 0)) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    adminConfig.passwordSalt = salt;
    adminConfig.passwordHash = hash;
    delete adminConfig.resetToken;
    delete adminConfig.resetExpires;
    writeAdminConfigWithProfile(adminConfig);

    return res.json({ message: 'Password reset successful.' });
  } catch (error) {
    console.error('Password reset failed:', error);
    return res.status(500).json({ message: 'Password reset failed.' });
  }
});

// Member password reset endpoints (development-friendly)
app.post('/api/user/request-reset', (req, res) => {
  try {
    const email = cleanText(req.body.email || '', 180).toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ message: 'Valid email is required.' });

    const users = readUsers();
    const user = users.find(u => String(u.email || '').toLowerCase() === email);
    if (!user) return res.status(404).json({ message: 'No account found with that email.' });

    const token = crypto.randomBytes(20).toString('hex');
    user.resetToken = token;
    user.resetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
    writeUsers(users);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'HEBG Ministry - Password Reset',
      text: `Shalom, your password reset token is: ${token}\n\nThis token will expire in 15 minutes.`
    };

    await transporter.sendMail(mailOptions);
    return res.json({ message: 'Verification email sent to your Gmail.' });
  } catch (error) {
    console.error('Could not generate user reset token:', error);
    return res.status(500).json({ message: 'Could not generate reset token.' });
  }
});

app.post('/api/user/reset-password', (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ message: 'Token and new password (min 8 chars) are required.' });
    }

    const users = readUsers();
    const user = users.find(u => u.resetToken && u.resetToken === token);
    if (!user || !user.resetExpires || Date.now() > user.resetExpires) {
      return res.status(400).json({ message: 'Invalid or expired reset token.' });
    }

    const { salt, hash } = hashPassword(newPassword);
    user.passwordSalt = salt;
    user.passwordHash = hash;
    delete user.resetToken;
    delete user.resetExpires;
    writeUsers(users);

    return res.json({ message: 'Password reset successful.' });
  } catch (error) {
    console.error('User password reset failed:', error);
    return res.status(500).json({ message: 'Password reset failed.' });
  }
});

app.patch('/api/admin/profile-picture', requireAdmin, profileUpload.single('profileImage'), (req, res) => { // New: Admin profile picture upload
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const adminConfig = getStoredAdminConfig();
  const oldProfileImageUrl = adminConfig.profileImageUrl;

  // Delete old profile picture if it exists and is a local upload
  if (oldProfileImageUrl && oldProfileImageUrl.startsWith('/uploads/profiles/admin/')) {
    const oldFilePath = path.join(rootDir, oldProfileImageUrl);
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }
  }

  adminConfig.profileImageUrl = `/uploads/profiles/admin/${req.file.filename}`;
  writeAdminConfigWithProfile(adminConfig); // Use the new function to write both config and profile image

  res.json({ message: 'Admin profile picture updated.', profileImageUrl: adminConfig.profileImageUrl });
});

app.patch('/api/user/profile-picture', requireUser, profileUpload.single('profileImage'), (req, res) => { // New: User profile picture upload
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const users = readUsers();
  const userIndex = users.findIndex((u) => u.id === req.user.id);

  if (userIndex === -1) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(404).json({ message: 'User not found.' });
  }

  const oldProfileImageUrl = users[userIndex].profileImageUrl;
  if (oldProfileImageUrl && oldProfileImageUrl.startsWith('/uploads/profiles/users/')) {
    const oldFilePath = path.join(rootDir, oldProfileImageUrl);
    if (fs.existsSync(oldFilePath)) {
      fs.unlinkSync(oldFilePath);
    }
  }

  users[userIndex].profileImageUrl = `/uploads/profiles/users/${req.file.filename}`;
  writeUsers(users);

  res.json({ message: 'User profile picture updated.', user: publicUser(users[userIndex]) });
});

app.get('/api/chat/conversations', requireAuth, (req, res) => {
  res.json(getChatConversations(req));
});

app.get('/api/chat/messages', requireAuth, (req, res) => {
  const conversationId = cleanText(req.query.conversationId || 'group:main', 160);

  if (!canAccessConversation(req, conversationId)) {
    return res.status(403).json({ message: 'You cannot access this conversation.' });
  }

  const messages = readMessages()
    .filter((message) => (message.conversationId || 'group:main') === conversationId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  res.json(messages);
});

app.post('/api/chat/messages', requireAuth, chatUpload.single('attachment'), (req, res) => {
  const conversationId = cleanText(req.body.conversationId || 'group:main', 160);
  const messageText = cleanText(req.body.message, 2000);
  const messageType = cleanText(req.body.type || 'text', 40);
  const replyTo = cleanText(req.body.replyTo || '', 120);
  const callKind = cleanText(req.body.callKind || '', 40);
  const callStatus = cleanText(req.body.callStatus || '', 40);
  const duration = cleanText(req.body.duration || '', 40);
  const attachment = getChatAttachment(req.file);

  if (!canAccessConversation(req, conversationId)) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(403).json({ message: 'You cannot access this conversation.' });
  }

  if (!messageText && !attachment && messageType !== 'call') {
    return res.status(400).json({ message: 'Message cannot be empty.' });
  }

  const sender = getSenderFromRequest(req);
  const message = {
    id: crypto.randomUUID(),
    conversationId,
    type: attachment?.type || messageType,
    senderId: sender.id,
    senderName: sender.fullName,
    senderRole: sender.role,
    message: messageText,
    attachment,
    replyTo: replyTo || null,
    reactions: [],
    call: messageType === 'call' ? {
      kind: callKind === 'video' ? 'video' : 'voice',
      status: callStatus || 'started',
      duration: duration || null
    } : null,
    createdAt: new Date().toISOString(),
    deliveredAt: new Date().toISOString()
  };

  const messages = readMessages();
  messages.push(message);
  writeMessages(messages);

  res.status(201).json(message);
});

app.patch('/api/chat/messages/:id/reactions', requireAuth, (req, res) => {
  const emoji = cleanText(req.body.emoji, 20);
  const messages = readMessages();
  const message = messages.find((item) => item.id === req.params.id);

  if (!message) {
    return res.status(404).json({ message: 'Message not found.' });
  }

  if (!canAccessConversation(req, message.conversationId || 'group:main')) {
    return res.status(403).json({ message: 'You cannot react to this message.' });
  }

  if (!emoji) {
    return res.status(400).json({ message: 'Choose a reaction.' });
  }

  const senderId = getParticipantIdFromAuth(req);
  message.reactions = Array.isArray(message.reactions) ? message.reactions : [];
  const existing = message.reactions.find((reaction) => reaction.senderId === senderId);

  if (existing) {
    existing.emoji = emoji;
  } else {
    message.reactions.push({ senderId, emoji });
  }

  writeMessages(messages);
  res.json(message);
});

app.patch('/api/chat/messages/:id', requireAuth, (req, res) => {
  const messageText = cleanText(req.body.message, 2000);
  const messages = readMessages();
  const message = messages.find((item) => item.id === req.params.id);

  if (!message) {
    return res.status(404).json({ message: 'Message not found.' });
  }

  const senderId = getParticipantIdFromAuth(req);
  if (message.senderId !== senderId) {
    return res.status(403).json({ message: 'You can only edit your own messages.' });
  }

  if (!messageText) {
    return res.status(400).json({ message: 'Message text cannot be empty.' });
  }

  message.message = messageText;
  message.isEdited = true;
  message.updatedAt = new Date().toISOString();

  writeMessages(messages);
  res.json(message);
});

app.delete('/api/chat/messages/:id', requireAuth, (req, res) => {
  const messages = readMessages();
  const message = messages.find((item) => item.id === req.params.id);

  if (!message) {
    return res.status(404).json({ message: 'Message not found.' });
  }

  const senderId = getParticipantIdFromAuth(req);
  const isAdmin = req.auth.type === 'admin';

  if (message.senderId !== senderId && !isAdmin) {
    return res.status(403).json({ message: 'You do not have permission to delete this message.' });
  }

  const filtered = messages.filter((item) => item.id !== req.params.id);
  writeMessages(filtered);
  res.json({ message: 'Message deleted successfully.' });
});

app.delete('/api/chat/conversations/:id', requireAuth, (req, res) => {
  const conversationId = req.params.id;

  if (!canAccessConversation(req, conversationId)) {
    return res.status(403).json({ message: 'You cannot access this conversation.' });
  }

  const messages = readMessages();
  const filtered = messages.filter((m) => (m.conversationId || 'group:main') !== conversationId);
  writeMessages(filtered);

  res.json({ message: 'Conversation history cleared successfully.' });
});

app.post('/api/lab/sql-login', (req, res) => {
  const username = String(req.body.username || '');
  const password = String(req.body.password || '');
  const vulnerableQuery = `SELECT * FROM admins WHERE username = '${username}' AND password = '${password}'`;
  const normalLoginWorks = username === 'admin' && password === 'secret123';
  const injectionWorks = /'\s*or\s*'1'\s*=\s*'1/i.test(username) || /'\s*or\s*'1'\s*=\s*'1/i.test(password);
  const loggedIn = normalLoginWorks || injectionWorks;

  res.json({
    loggedIn,
    message: loggedIn
      ? 'Lab login bypassed. This is why real apps must never build SQL with raw user input.'
      : 'Lab login failed.',
    vulnerableQuery,
    note: 'This is a safe learning lab only. It does not log you into the real admin panel.'
  });
});

app.post('/api/admin/sermons', requireAdmin, upload.single('sermonFile'), (req, res) => {
  const { title, description, category, type } = req.body;

  if (!title || !description || !type || !req.file) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Title, description, type, and file are required.' });
  }

  // Additional server-side validation
  const cleanedTitle = cleanText(title.trim(), 200);
  const cleanedDesc = cleanText(description.trim(), 1000);
  const cleanedCategory = cleanText(category?.trim() || 'Teaching', 100);

  if (!cleanedTitle || !cleanedDesc) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Title and description contain invalid characters.' });
  }

  // Verify file type is valid
  const config = allowedTypes[type];
  if (!config) {
    if (req.file) fs.unlinkSync(req.file.path);
    return res.status(400).json({ message: 'Invalid sermon type.' });
  }

  const sermon = {
    id: crypto.randomUUID(),
    title: cleanedTitle,
    description: cleanedDesc,
    category: cleanedCategory,
    type,
    fileName: req.file.filename,
    fileUrl: `/uploads/${config.folder}/${req.file.filename}`,
    originalName: req.file.originalname,
    createdAt: new Date().toISOString()
  };

  const sermons = readSermons();
  sermons.push(sermon);
  writeSermons(sermons);

  res.status(201).json(sermon);
});

app.patch('/api/admin/sermons/:id', requireAdmin, (req, res) => {
  const { title, description, category } = req.body;
  const sermons = readSermons();
  const sermon = sermons.find((item) => item.id === req.params.id);

  if (!sermon) {
    return res.status(404).json({ message: 'Sermon not found.' });
  }

  if (title) sermon.title = cleanText(title, 200);
  if (description) sermon.description = cleanText(description, 1000);
  if (category) sermon.category = cleanText(category, 100);
  sermon.updatedAt = new Date().toISOString();

  writeSermons(sermons);
  res.json(sermon);
});

app.delete('/api/admin/sermons/:id', requireAdmin, (req, res) => {
  const sermons = readSermons();
  const sermon = sermons.find((item) => item.id === req.params.id);

  if (!sermon) {
    return res.status(404).json({ message: 'Sermon not found.' });
  }

  const remaining = sermons.filter((item) => item.id !== req.params.id);
  const filePath = path.resolve(rootDir, sermon.fileUrl.replace(/^\/+/, ''));
  const safeUploadsDir = path.resolve(uploadsDir);

  if (filePath.startsWith(`${safeUploadsDir}${path.sep}`) && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  writeSermons(remaining);
  res.json({ message: 'Sermon deleted.' });
});

app.get('/api/live-stream', (req, res) => {
  const liveStream = readLiveStream();
  res.json(liveStream);
});

app.post('/api/admin/live-stream/start', requireAdmin, (req, res) => {
  const title = cleanText(req.body.title, 200);
  const description = cleanText(req.body.description, 1000);
  const streamUrl = cleanText(req.body.streamUrl, 500);
  const streamType = cleanText(req.body.streamType, 20) === 'audio' ? 'audio' : 'video';

  if (!title || !description || !streamUrl) {
    return res.status(400).json({ message: 'Please provide a title, description, and stream URL.' });
  }

  const liveStream = {
    isLive: true,
    title,
    description,
    streamUrl,
    streamType,
    startedAt: new Date().toISOString()
  };

  writeLiveStream(liveStream);
  res.json({ message: 'Live stream started successfully.', liveStream });
});

app.post('/api/admin/live-stream/stop', requireAdmin, (req, res) => {
  const liveStream = {
    isLive: false,
    title: '',
    description: '',
    streamUrl: '',
    streamType: 'video',
    startedAt: null
  };

  writeLiveStream(liveStream);
  res.json({ message: 'Live stream stopped.' });
});

app.patch('/api/admin/account', requireSuperAdmin, (req, res) => {
  const username = normalizeLoginValue(req.body.username);
  const password = normalizeLoginValue(req.body.password);
  const currentPassword = normalizeLoginValue(req.body.currentPassword);

  if (!username || !password || !currentPassword) {
    return res.status(400).json({ message: 'Username, current password, and new password are required.' });
  }

  const adminConfig = getStoredAdminConfig();

  if (!isValidAdminPassword(currentPassword, adminConfig)) {
    return res.status(401).json({ message: 'Current password is incorrect.' });
  }

  const { salt, hash } = hashPassword(password);
  writeAdminConfig({ username, passwordHash: hash, passwordSalt: salt });
  res.json({ message: 'Admin account updated successfully.' });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(400).json({ message: error.message || 'Something went wrong.' });
});

server.listen(PORT, () => {
  console.log(`HEBG backend running at http://localhost:${PORT}`);
});
