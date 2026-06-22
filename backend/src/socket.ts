import { Server as SocketIOServer, Socket } from 'socket.io';
import { db } from './lib/firebase';
import { Server } from 'http';

export function initializeSocket(server: Server) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log('User connected to live chat:', socket.id);

    // Join a specific room based on user ID or role
    socket.on('join_room', (data: { roomId: string, isAdmin?: boolean }) => {
      socket.join(data.roomId);
      console.log(`Socket ${socket.id} joined room ${data.roomId}`);
      if (data.isAdmin) {
        socket.join('admins');
      }
    });

    // Handle new incoming messages
    socket.on('send_message', async (data: { roomId: string, senderId: string, senderName: string, text: string, isAdmin: boolean }) => {
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
        await db.collection('live_chats').doc(data.roomId).collection('messages').add(message);
        
        // Update the last active timestamp on the room document for the admin view
        await db.collection('live_chats').doc(data.roomId).set({
          lastMessage: data.text,
          lastActive: message.timestamp,
          userId: data.roomId, // Assuming roomId is userId
          userName: data.isAdmin ? undefined : data.senderName // Just saving the name for UI
        }, { merge: true });

      } catch (err) {
        console.error('Error saving chat message:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected from live chat:', socket.id);
    });
  });

  return io;
}
