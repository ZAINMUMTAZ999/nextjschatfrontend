

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

// Use your Railway URL here
const SOCKET_URL = "http://localhost:5000";

export const useSocket = (userId: string) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!userId) return;

    if (!socket) {
      socket = io(SOCKET_URL, {
        transports: ["websocket"], // Required for Railway/Heroku stability
        reconnection: true,
        reconnectionAttempts: 5,
      });
    }

    const onConnect = () => {
      console.log("Connected to Socket ID:", socket?.id);
      setIsConnected(true);
    };
    
    const onDisconnect = () => setIsConnected(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onConnectError = (err: any) => console.error("Socket Connection Error:", err);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    return () => {
      socket?.off("connect", onConnect);
      socket?.off("disconnect", onDisconnect);
      socket?.off("connect_error", onConnectError);
    };
  }, [userId]);

  return { socket, isConnected };
};