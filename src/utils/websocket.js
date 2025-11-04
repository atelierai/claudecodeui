import { useState, useEffect, useRef } from 'react';

export function useWebSocket() {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    connect();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
    };
  }, []); // Keep dependency array but add proper cleanup

  const connect = async () => {
    try {
      // Get authentication token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.warn('No authentication token found for WebSocket connection');
        return;
      }
      
      // Fetch server configuration to get the correct WebSocket URL
      let wsBaseUrl;
      try {
        const isElectron = window.location.protocol === 'file:';
        const configUrl = isElectron
          ? 'http://localhost:3001/api/config'
          : '/api/config';
        const configResponse = await fetch(configUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;

        // Only rewrite localhost when NOT in Electron and we have a valid hostname
        if (
          !isElectron &&
          wsBaseUrl.includes('localhost') &&
          window.location.hostname &&
          !window.location.hostname.includes('localhost')
        ) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
          wsBaseUrl = `${protocol}//${window.location.hostname}${apiPort ? `:${apiPort}` : ''}`;
        }

        // Safety: if malformed, default to localhost:3001
        if (!/^wss?:\/\/[^\s/]+/.test(wsBaseUrl)) {
          wsBaseUrl = 'ws://localhost:3001';
        }
      } catch (error) {
        console.warn('Could not fetch server config, applying Electron/web fallback');
        if (window.location.protocol === 'file:') {
          wsBaseUrl = 'ws://localhost:3001';
        } else {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
          wsBaseUrl = `${protocol}//${window.location.hostname}${apiPort ? `:${apiPort}` : ''}`;
        }
      }
      
      // Include token in WebSocket URL as query parameter
      const wsUrl = `${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`;
      const websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        setIsConnected(true);
        setWs(websocket);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages(prev => [...prev, data]);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        setIsConnected(false);
        setWs(null);
        
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };

  const sendMessage = (message) => {
    if (ws && isConnected) {
      ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  };

  return {
    ws,
    sendMessage,
    messages,
    isConnected
  };
}
