/**
 * multiplayer.js - WebSocket-based multiplayer system for Super Charrio Kart
 * 
 * FIXED VERSION - Room ID now equals Host Peer ID for direct connections
 * 
 * Features:
 * - Room creation and joining
 * - Real-time player position sync
 * - P2P using PeerJS
 * - Host-based game state management
 */

var Multiplayer = (function() {
    'use strict';

    // PeerJS configuration (free hosted service)
    var peer = null;
    var connections = {};
    var roomId = null;
    var isHost = false;
    var playerCount = 0;
    var maxPlayers = 2;
    
    // Player data
    var localPlayer = {
        id: null,
        position: { x: 0, y: 0, z: 0 },
        angle: 0,
        speed: 0,
        racer: 'kartB',
        lap: 0,
        time: 0
    };
    
    var remotePlayers = {};
    
    // Callbacks
    var callbacks = {
        onPlayerJoin: null,
        onPlayerLeave: null,
        onGameStart: null,
        onPlayerUpdate: null,
        onRoomCreated: null,
        onRoomJoined: null,
        onError: null
    };

    /**
     * Initialize multiplayer system
     */
    function init(playerId) {
        return new Promise(function(resolve, reject) {
            try {
                // Generate 4-digit room code if not provided
                if (!playerId) {
                    // Generate random 4-digit number (1000-9999)
                    playerId = 'room_' + (Math.floor(Math.random() * 9000) + 1000);
                }
                
                localPlayer.id = playerId;
                
                // Initialize PeerJS with custom ID
                peer = new Peer(playerId, {
                    config: {
                        iceServers: [
                            { urls: 'stun:stun.l.google.com:19302' },
                            { urls: 'stun:global.stun.twilio.com:3478' }
                        ]
                    }
                });

                peer.on('open', function(id) {
                    console.log('Peer connection opened with ID:', id);
                    localPlayer.id = id;
                    resolve(id);
                });

                peer.on('connection', function(conn) {
                    handleIncomingConnection(conn);
                });

                peer.on('error', function(err) {
                    console.error('Peer error:', err);
                    if (callbacks.onError) callbacks.onError(err);
                    reject(err);
                });

            } catch (error) {
                console.error('Failed to initialize multiplayer:', error);
                reject(error);
            }
        });
    }

    /**
     * Create a new room (become host)
     * FIXED: Room ID now equals the host's peer ID (4-digit code)
     */
    function createRoom(trackName, racerType) {
        if (!peer) {
            console.error('Peer not initialized');
            return null;
        }

        isHost = true;
        // Extract just the 4-digit number from the peer ID for display
        roomId = localPlayer.id;
        var displayCode = localPlayer.id.replace('room_', '');
        playerCount = 1;
        
        localPlayer.racer = racerType;
        
        console.log('Room created with ID:', roomId, '(Display code:', displayCode + ')');
        
        if (callbacks.onRoomCreated) {
            callbacks.onRoomCreated(displayCode, trackName);
        }
        
        return displayCode;
    }

    /**
     * Join an existing room
     * FIXED: Added connection timeout and better error handling
     */
    function joinRoom(targetRoomCode, racerType) {
        return new Promise(function(resolve, reject) {
            if (!peer) {
                reject('Peer not initialized');
                return;
            }

            isHost = false;
            // Convert 4-digit code to full peer ID
            var hostId = 'room_' + targetRoomCode;
            roomId = hostId;
            localPlayer.racer = racerType;
            
            console.log('Attempting to connect to host:', hostId);
            
            var conn = peer.connect(hostId, {
                reliable: true,
                serialization: 'json'
            });

            var connectionTimeout = setTimeout(function() {
                reject('Connection timeout - room not found');
                conn.close();
            }, 10000);

            conn.on('open', function() {
                clearTimeout(connectionTimeout);
                console.log('Connected to host');
                connections[hostId] = conn;
                
                // Send join request
                sendMessage(conn, {
                    type: 'join',
                    player: {
                        id: localPlayer.id,
                        racer: localPlayer.racer
                    }
                });
                
                setupConnectionHandlers(conn);
                
                if (callbacks.onRoomJoined) {
                    callbacks.onRoomJoined(targetRoomCode);
                }
                
                resolve(targetRoomCode);
            });

            conn.on('error', function(err) {
                clearTimeout(connectionTimeout);
                console.error('Connection error:', err);
                reject('Failed to connect: ' + (err.type || 'Unknown error'));
            });
        });
    }

    /**
     * Handle incoming peer connections (host only)
     */
    function handleIncomingConnection(conn) {
        if (!isHost) return;
        
        if (playerCount >= maxPlayers) {
            sendMessage(conn, { type: 'error', message: 'Room full' });
            conn.close();
            return;
        }

        console.log('Player connecting:', conn.peer);
        
        conn.on('open', function() {
            connections[conn.peer] = conn;
            setupConnectionHandlers(conn);
        });
    }

    /**
     * Setup message handlers for a connection
     */
    function setupConnectionHandlers(conn) {
        conn.on('data', function(data) {
            handleMessage(conn, data);
        });

        conn.on('close', function() {
            console.log('Player disconnected:', conn.peer);
            delete connections[conn.peer];
            delete remotePlayers[conn.peer];
            playerCount--;
            
            if (callbacks.onPlayerLeave) {
                callbacks.onPlayerLeave(conn.peer);
            }
        });

        conn.on('error', function(err) {
            console.error('Connection error:', err);
        });
    }

    /**
     * Handle incoming messages
     */
    function handleMessage(conn, data) {
        switch (data.type) {
            case 'join':
                handlePlayerJoin(conn, data.player);
                break;
            
            case 'player_update':
                handlePlayerUpdate(data.player);
                break;
            
            case 'game_start':
                if (callbacks.onGameStart) {
                    callbacks.onGameStart(data.track);
                }
                break;
            
            case 'sync_players':
                // Receive all players from host
                for (var id in data.players) {
                    if (id !== localPlayer.id) {
                        remotePlayers[id] = data.players[id];
                    }
                }
                break;
            
            case 'error':
                console.error('Multiplayer error:', data.message);
                if (callbacks.onError) {
                    callbacks.onError(data.message);
                }
                break;
        }
    }

    /**
     * Handle player join (host only)
     */
    function handlePlayerJoin(conn, player) {
        if (!isHost) return;
        
        playerCount++;
        remotePlayers[player.id] = player;
        
        console.log('Player joined:', player.id);
        
        // Send current players to new player
        sendMessage(conn, {
            type: 'sync_players',
            players: getAllPlayers()
        });
        
        // Broadcast new player to others
        broadcastMessage({
            type: 'player_join',
            player: player
        }, conn.peer);
        
        if (callbacks.onPlayerJoin) {
            callbacks.onPlayerJoin(player);
        }
    }

    /**
     * Handle player position update
     */
    function handlePlayerUpdate(player) {
        remotePlayers[player.id] = player;
        
        if (callbacks.onPlayerUpdate) {
            callbacks.onPlayerUpdate(player);
        }
    }

    /**
     * Send player update (called every frame)
     */
    function sendPlayerUpdate(position, angle, speed, lap, time) {
        localPlayer.position = position;
        localPlayer.angle = angle;
        localPlayer.speed = speed;
        localPlayer.lap = lap || 0;
        localPlayer.time = time || 0;
        
        broadcastMessage({
            type: 'player_update',
            player: localPlayer
        });
    }

    /**
     * Start game (host only)
     */
    function startGame(trackName) {
        if (!isHost) return;
        
        broadcastMessage({
            type: 'game_start',
            track: trackName
        });
    }

    /**
     * Send message to specific connection
     */
    function sendMessage(conn, data) {
        if (conn && conn.open) {
            try {
                conn.send(data);
            } catch (err) {
                console.error('Failed to send message:', err);
            }
        }
    }

    /**
     * Broadcast message to all connections
     */
    function broadcastMessage(data, excludeId) {
        for (var id in connections) {
            if (id !== excludeId) {
                sendMessage(connections[id], data);
            }
        }
    }

    /**
     * Get all players including local
     */
    function getAllPlayers() {
        var players = {};
        players[localPlayer.id] = localPlayer;
        
        for (var id in remotePlayers) {
            players[id] = remotePlayers[id];
        }
        
        return players;
    }

    /**
     * Get remote players
     */
    function getRemotePlayers() {
        return remotePlayers;
    }

    /**
     * Get local player
     */
    function getLocalPlayer() {
        return localPlayer;
    }

    /**
     * Check if multiplayer is active
     */
    function isActive() {
        return roomId !== null && Object.keys(connections).length > 0;
    }

    /**
     * Check if player is host
     */
    function isRoomHost() {
        return isHost;
    }

    /**
     * Get current room ID (returns 4-digit display code)
     */
    function getRoomId() {
        if (!roomId) return null;
        // Return just the 4-digit number for display
        return roomId.replace('room_', '');
    }

    /**
     * Leave current room
     */
    function leaveRoom() {
        // Close all connections
        for (var id in connections) {
            connections[id].close();
        }
        
        connections = {};
        remotePlayers = {};
        roomId = null;
        isHost = false;
        playerCount = 0;
    }

    /**
     * Cleanup and disconnect
     */
    function disconnect() {
        leaveRoom();
        
        if (peer) {
            peer.destroy();
            peer = null;
        }
    }

    /**
     * Set callback functions
     */
    function on(event, callback) {
        if (callbacks.hasOwnProperty('on' + event.charAt(0).toUpperCase() + event.slice(1))) {
            callbacks['on' + event.charAt(0).toUpperCase() + event.slice(1)] = callback;
        }
    }

    // Public API
    return {
        init: init,
        createRoom: createRoom,
        joinRoom: joinRoom,
        sendPlayerUpdate: sendPlayerUpdate,
        startGame: startGame,
        getRemotePlayers: getRemotePlayers,
        getLocalPlayer: getLocalPlayer,
        getAllPlayers: getAllPlayers,
        isActive: isActive,
        isHost: isRoomHost,
        getRoomId: getRoomId,
        leaveRoom: leaveRoom,
        disconnect: disconnect,
        on: on
    };
})();