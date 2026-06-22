"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = initializeSocket;
const socket_io_1 = require("socket.io");
const firebase_1 = require("./lib/firebase");
function initializeSocket(server) {
    const io = new socket_io_1.Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });
    io.on('connection', (socket) => {
        console.log('User connected to live chat:', socket.id);
        // Join a specific room based on user ID or role
        socket.on('join_room', (data) => {
            socket.join(data.roomId);
            console.log(`Socket ${socket.id} joined room ${data.roomId}`);
            if (data.isAdmin) {
                socket.join('admins');
            }
        });
        // Handle new incoming messages
        socket.on('send_message', async (data) => {
            try {
                const message = {
                    roomId: data.roomId,
                    senderId: data.senderId,
                    senderName: data.senderName,
                    text: data.text,
                    isAdmin: data.isAdmin,
                    timestamp: new Date().toISOString()
                };
                // Broadcast to the specific room
                io.to(data.roomId).emit('receive_message', message);
                // Also broadcast to all admins so they get real-time notifications for active chats
                io.to('admins').emit('admin_receive_message', message);
                // Save to Firestore (grouped by roomId)
                await firebase_1.db.collection('live_chats').doc(data.roomId).collection('messages').add(message);
                // Update the last active timestamp on the room document for the admin view
                await firebase_1.db.collection('live_chats').doc(data.roomId).set({
                    lastMessage: data.text,
                    lastActive: message.timestamp,
                    userId: data.roomId, // Assuming roomId is userId
                    userName: data.isAdmin ? undefined : data.senderName // Just saving the name for UI
                }, { merge: true });
            }
            catch (err) {
                console.error('Error saving chat message:', err);
            }
        });
        socket.on('disconnect', () => {
            console.log('User disconnected from live chat:', socket.id);
        });
    });
    return io;
}
