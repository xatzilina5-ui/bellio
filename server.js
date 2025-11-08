// -----------------------------
// Bellio Server (διορθωμένος)
// -----------------------------

require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const webpush = require('web-push');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// -----------------------------
// Ρυθμίσεις Express
// -----------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// -----------------------------
// Ρύθμιση Web Push
// -----------------------------
webpush.setVapidDetails(
  "mailto:info@bellio.app",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const subscriptions = [];
let calls = [];
let lastId = 0;

// -----------------------------
// Routes
// -----------------------------

// Σελίδα πελάτη
app.get('/t/:tableId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'customer.html'));
});

// Πίνακας σερβιτόρου
app.get('/waiter', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'waiter.html'));
});

// QR για κάθε τραπέζι
app.get('/qr/:tableId', async (req, res) => {
  const tableId = req.params.tableId;
  const url = `${BASE_URL}/t/${tableId}`;
  try {
    res.setHeader('Content-Type', 'image/png');
    const img = await QRCode.toBuffer(url, { width: 512, margin: 1 });
    res.end(img);
  } catch (err) {
    res.status(500).send('Error generating QR');
  }
});

// -----------------------------
// Push Subscriptions
// -----------------------------
app.post("/subscribe", express.json(), (req, res) => {
  const subscription = req.body;
  subscriptions.push(subscription);
  res.status(201).json({ message: "Subscribed successfully." });
});

// Συνάρτηση για αποστολή push ειδοποίησης
function sendPushNotification(payload) {
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => {
      console.error("Push error:", err);
    });
  });
}

// -----------------------------
// Socket.IO Λογική
// -----------------------------
io.on('connection', socket => {
  console.log('✅ Νέα σύνδεση:', socket.handshake.auth);

  const role = socket.handshake.auth?.role;
  const tableId = socket.handshake.auth?.tableId;

  if (role === 'waiter') {
    console.log('🧑‍🍳 Συνδέθηκε σερβιτόρος');
    socket.emit('calls:init', calls.filter(c => c.status === 'open'));
  }

  socket.on('call:request', () => {
    console.log('📣 Κλήση από τραπέζι', tableId);
    if (!tableId) return;

    const call = {
      id: ++lastId,
      tableId,
      status: 'open',
      createdAt: Date.now()
    };

    calls.push(call);
    socket.emit('call:ack', { callId: call.id });

    io.sockets.sockets.forEach(s => {
      if (s.handshake.auth?.role === 'waiter') s.emit('call:new', call);
    });

    // --- Push Notification για νέες κλήσεις ---
    sendPushNotification({
      title: "Νέα Κλήση Πελάτη 🔔",
      body: `Το τραπέζι ${call.tableId} ζητά εξυπηρέτηση.`,
      icon: "/logo.png"
    });
  });

  socket.on('call:resolve', ({ callId }) => {
    const c = calls.find(x => x.id === callId);
    if (!c) return;
    c.status = 'resolved';
    io.sockets.sockets.forEach(s => {
      if (s.handshake.auth?.role === 'waiter')
        s.emit('call:resolved', { callId });
    });
  });
});

// -----------------------------
// Εκκίνηση Server
// -----------------------------
server.listen(PORT, () =>
  console.log(`✅ Bellio running on ${BASE_URL}`)
);


