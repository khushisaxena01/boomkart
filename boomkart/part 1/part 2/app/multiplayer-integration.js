/**
 * multiplayer-integration.js
 * Mobile-optimized version with better touch support and click-to-copy room code
 */

// Global multiplayer state
var multiplayerEnabled = false;
var remoteKarts = {}; // Stores mesh objects for remote players

// Detect if we're on mobile
var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Add multiplayer option to main menu
function initMultiplayerMenu() {
    // Add multiplayer button to main menu
    var mainMenu = document.getElementById('menu_main');
    if (mainMenu) {
        var multiplayerBtn = document.createElement('div');
        multiplayerBtn.className = 'menuButton';
        multiplayerBtn.onclick = function() { showMenu('multiplayer'); };
        multiplayerBtn.innerHTML = '<img src="graphics/icons/kart.png" /> MULTIPLAYER';
        
        // Insert after "SELECT YOUR KART" button
        var buttons = mainMenu.getElementsByClassName('menuButton');
        if (buttons.length > 0) {
            mainMenu.insertBefore(multiplayerBtn, buttons[1]);
        }
    }
}

// Show multiplayer create menu
function showMultiplayerCreate() {
    sfx.click.play();
    
    // Show loading indicator
    if (isMobile) {
        alert('Initializing multiplayer... Please wait.');
    }
    
    // Initialize multiplayer
    Multiplayer.init().then(function(playerId) {
        // Show racer selection first
        showMenu('racer');
        
        // Override setRacer to go to create menu instead of track menu
        window.originalSetRacer = window.setRacer;
        window.setRacer = function(newRacer) {
            racer = newRacer;
            
            // Create room - returns the 4-digit display code
            var roomCode = Multiplayer.createRoom('ascalon', racer);
            
            // Display the 4-digit number and make it clickable
            var roomCodeSpan = document.getElementById('roomCode');
            roomCodeSpan.innerText = roomCode;
            roomCodeSpan.style.cursor = 'pointer';
            roomCodeSpan.title = 'Click to copy';
            
            // Add click handler to copy code
            roomCodeSpan.onclick = function() {
                copyRoomCode(roomCode);
            };
            
            // Add visual indicator for mobile
            if (isMobile) {
                addCopyCodeButton(roomCode);
            }
            
            showMenu('multiplayer_create');
            
            // Setup callbacks
            setupMultiplayerCallbacks();
            
            // Restore original setRacer
            window.setRacer = window.originalSetRacer;
        };
    }).catch(function(err) {
        alert('Failed to initialize multiplayer: ' + err + '\n\nTip: Make sure you have a stable internet connection.');
    });
}

// Copy room code with visual feedback
function copyRoomCode(code) {
    copyToClipboard(code);
    
    // Visual feedback
    var roomCodeSpan = document.getElementById('roomCode');
    var originalText = roomCodeSpan.innerText;
    var originalColor = roomCodeSpan.style.color;
    
    roomCodeSpan.innerText = 'COPIED!';
    roomCodeSpan.style.color = '#00ff00';
    
    // Play click sound
    if (sfx && sfx.click) {
        sfx.click.play();
    }
    
    setTimeout(function() {
        roomCodeSpan.innerText = originalText;
        roomCodeSpan.style.color = originalColor || '#ffd800';
    }, 1500);
}

// Add a button to copy room code (mobile-friendly)
function addCopyCodeButton(code) {
    var roomCodeSpan = document.getElementById('roomCode');
    if (roomCodeSpan && !document.getElementById('copyCodeBtn')) {
        var copyBtn = document.createElement('div');
        copyBtn.id = 'copyCodeBtn';
        copyBtn.className = 'menuButton';
        copyBtn.style.fontSize = '4vmin';
        copyBtn.style.marginTop = '10px';
        copyBtn.innerHTML = '📋 TAP TO COPY CODE';
        copyBtn.onclick = function() {
            copyToClipboard(code);
            copyBtn.innerHTML = '✓ CODE COPIED!';
            copyBtn.style.color = '#00ff00';
            setTimeout(function() {
                copyBtn.innerHTML = '📋 TAP TO COPY CODE';
                copyBtn.style.color = '';
            }, 2000);
        };
        roomCodeSpan.parentNode.appendChild(copyBtn);
    }
}

// Copy to clipboard (works on mobile)
function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            console.log('Code copied to clipboard:', text);
        }).catch(function(err) {
            console.log('Clipboard API failed, using fallback');
            fallbackCopyToClipboard(text);
        });
    } else {
        fallbackCopyToClipboard(text);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        var successful = document.execCommand('copy');
        if (successful) {
            console.log('Code copied using fallback method');
        } else {
            prompt('Copy this code:', text);
        }
    } catch (err) {
        prompt('Copy this code:', text);
    }
    
    document.body.removeChild(textArea);
}

// Show multiplayer join menu
function showMultiplayerJoin() {
    sfx.click.play();
    
    // Initialize multiplayer
    Multiplayer.init().then(function(playerId) {
        showMenu('multiplayer_join');
        
        var input = document.getElementById('roomCodeInput');
        input.value = '';
        
        // Mobile: Use number input for better keyboard
        if (isMobile) {
            input.type = 'number';
            input.pattern = '[0-9]*';
            input.inputMode = 'numeric';
        }
        
        // Focus after a short delay on mobile
        setTimeout(function() {
            input.focus();
        }, 300);
    }).catch(function(err) {
        alert('Failed to initialize multiplayer: ' + err);
    });
}

// Attempt to join room
function attemptJoinRoom() {
    sfx.click.play();
    
    var roomCode = document.getElementById('roomCodeInput').value.trim();
    
    // Validate 4-digit code
    if (!roomCode || roomCode.length !== 4 || isNaN(roomCode)) {
        alert('Please enter a valid 4-digit room code');
        return;
    }
    
    // Blur input to hide mobile keyboard
    if (isMobile) {
        document.getElementById('roomCodeInput').blur();
    }
    
    // Show loading state
    var joinBtn = event && event.target;
    var originalText = joinBtn ? joinBtn.innerHTML : '';
    if (joinBtn) {
        joinBtn.innerHTML = 'CONNECTING...';
        joinBtn.style.opacity = '0.5';
        joinBtn.style.pointerEvents = 'none';
    }
    
    // Show racer selection
    showMenu('racer');
    
    // Override setRacer to join room
    window.originalSetRacer = window.setRacer;
    window.setRacer = function(newRacer) {
        racer = newRacer;
        
        // Join room
        Multiplayer.joinRoom(roomCode, racer).then(function(joinedRoom) {
            document.getElementById('lobbyRoomCode').innerText = joinedRoom;
            
            // Show lobby as guest
            document.getElementById('hostControls').style.display = 'none';
            document.getElementById('guestWaiting').style.display = 'block';
            showMenu('multiplayer_lobby');
            
            setupMultiplayerCallbacks();
            updateLobbyPlayerList();
            
            // Restore original
            window.setRacer = window.originalSetRacer;
        }).catch(function(err) {
            var errorMsg = 'Failed to join room';
            if (typeof err === 'string') {
                if (err.indexOf('timeout') !== -1 || err.indexOf('not found') !== -1) {
                    errorMsg = 'Room not found. Please check the code and try again.';
                } else {
                    errorMsg += ': ' + err;
                }
            } else if (err && err.type) {
                if (err.type === 'peer-unavailable') {
                    errorMsg = 'Room not found. Please check the room code.';
                } else if (err.type === 'network') {
                    errorMsg = 'Network error. Please check your connection.';
                } else {
                    errorMsg += ': ' + err.type;
                }
            }
            
            // Add mobile-specific tip
            if (isMobile) {
                errorMsg += '\n\nMobile Tip: Make sure both devices are on WiFi for best results.';
            }
            
            alert(errorMsg);
            showMenu('multiplayer_join');
            
            // Restore button
            if (joinBtn) {
                joinBtn.innerHTML = originalText;
                joinBtn.style.opacity = '1';
                joinBtn.style.pointerEvents = 'auto';
            }
            
            window.setRacer = window.originalSetRacer;
        });
    };
}

// Setup multiplayer event callbacks
function setupMultiplayerCallbacks() {
    Multiplayer.on('playerJoin', function(player) {
        console.log('Player joined:', player);
        document.getElementById('player2Name').innerText = 'Ready';
        document.getElementById('player2Name').style.color = '#00ff00';
        
        // If host, show track selection
        if (Multiplayer.isHost()) {
            setTimeout(function() {
                // Extract 4-digit code from room ID
                var fullRoomId = Multiplayer.getRoomId();
                var displayCode = fullRoomId.replace('room_', '');
                document.getElementById('lobbyRoomCode').innerText = displayCode;
                document.getElementById('hostControls').style.display = 'block';
                showMenu('multiplayer_lobby');
                updateLobbyPlayerList();
            }, 500);
        }
    });
    
    Multiplayer.on('playerLeave', function(playerId) {
        console.log('Player left:', playerId);
        
        // Remove remote kart if in game
        if (remoteKarts[playerId] && track && track.scene) {
            track.scene.remove(remoteKarts[playerId]);
            delete remoteKarts[playerId];
        }
        
        // If in lobby, update UI
        if (document.getElementById('menu_multiplayer_lobby').style.display === 'block') {
            updateLobbyPlayerList();
        }
    });
    
    Multiplayer.on('gameStart', function(trackName) {
        console.log('Game starting on track:', trackName);
        multiplayerEnabled = true;

        // Set starting positions side by side
        setupMultiplayerStartPositions();

        // Store track name for leaderboard saving
        window.currentMultiplayerTrack = trackName;

        loadMap(trackName);
    });
    
    Multiplayer.on('playerUpdate', function(player) {
        // Update remote player kart position
        if (track && track.scene && player.id) {
            updateRemoteKart(player);
        }
    });
    
    Multiplayer.on('error', function(error) {
        console.error('Multiplayer error:', error);
        alert('Multiplayer error: ' + error);
    });
}

// Setup starting positions for multiplayer (side by side)
function setupMultiplayerStartPositions() {
    // Wait for track to be loaded
    var checkTrack = setInterval(function() {
        if (track && track.player) {
            clearInterval(checkTrack);
            
            // Offset player 2 to the side
            if (!Multiplayer.isHost()) {
                // Guest starts slightly to the right
                track.player.position.x += 1.5;
            } else {
                // Host starts slightly to the left
                track.player.position.x -= 1.5;
            }
        }
    }, 100);
}

// Start multiplayer game (host only)
function startMultiplayerGame(trackName) {
    sfx.click.play();
    
    if (!Multiplayer.isHost()) {
        return;
    }
    
    // Check if we have 2 players
    var players = Multiplayer.getAllPlayers();
    if (Object.keys(players).length < 2) {
        alert('Waiting for player 2 to join...');
        return;
    }
    
    multiplayerEnabled = true;
    
    // Reduce particle effects on mobile for performance
    if (isMobile && window.Effects) {
        // Disable heavy effects on mobile
        console.log('Mobile detected: Reducing particle effects for performance');
    }
    
    // Start game for everyone
    Multiplayer.startGame(trackName);
    
    // Load map locally
    loadMap(trackName);
}

// Update lobby player list
function updateLobbyPlayerList() {
    var players = Multiplayer.getAllPlayers();
    var listHtml = '';
    var count = 1;
    
    for (var id in players) {
        var isLocal = (id === Multiplayer.getLocalPlayer().id);
        var playerLabel = 'Player ' + count + (isLocal ? ' (You)' : '');
        var racerName = getRacerName(players[id].racer);
        
        listHtml += '<div>' + playerLabel + ': ' + racerName + ' <span style="color: #00ff00;">Ready</span></div>';
        count++;
    }
    
    document.getElementById('lobbyPlayerList').innerHTML = listHtml;
}

// Get friendly racer name
function getRacerName(racerId) {
    var names = {
        'kartA': 'Yestermobile',
        'kartB': 'Centurion',
        'kartC': 'Salt Machine',
        'taimi': 'Taimi'
    };
    return names[racerId] || racerId;
}

// Cancel/leave multiplayer
function cancelMultiplayer() {
    sfx.click.play();
    
    Multiplayer.leaveRoom();
    multiplayerEnabled = false;
    
    // Clear remote karts
    for (var id in remoteKarts) {
        if (track && track.scene) {
            track.scene.remove(remoteKarts[id]);
        }
    }
    remoteKarts = {};
    
    showMenu('main');
}

// Create or update remote kart visualization
function updateRemoteKart(player) {
    if (!remoteKarts[player.id]) {
        // Create new kart mesh
        createRemoteKart(player);
    }
    
    var kart = remoteKarts[player.id];
    if (kart && player.position) {
        // Update position and rotation
        kart.position.set(player.position.x, player.position.y, player.position.z);
        kart.rotation.y = player.angle * (Math.PI / 180);
    }
}

// Create mesh for remote player kart
function createRemoteKart(player) {
    if (!track || !track.scene) return;
    
    // Load kart texture
    var geometry = new THREE.PlaneGeometry(0.8, 0.8);
    var texture = new THREE.TextureLoader().load('graphics/racers/' + player.racer + '.png');
    texture.generateMipmaps = false;
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.repeat.set(0.25, 1);
    
    var material = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true,
        opacity: 0.9 // Slightly transparent to distinguish from local player
    });
    
    var mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = !isMobile; // Disable shadows on mobile for performance
    mesh.position.set(
        player.position.x || 0,
        player.position.y || 0.4,
        player.position.z || 0
    );
    
    track.scene.add(mesh);
    remoteKarts[player.id] = mesh;
    
    console.log('Created remote kart for player:', player.id);
}

// Integrate with existing game loop
var originalTrackConstructor = Track;
Track = function(trackName) {
    var self = originalTrackConstructor.call(this, trackName);
    window.currentTrack = this;
    return self;
};

// Patch track.js update function to send multiplayer updates
(function() {
    var updateInterval = 0;
    var originalRequestAnimationFrame = window.requestAnimationFrame;

    window.requestAnimationFrame = function(callback) {
        return originalRequestAnimationFrame(function(time) {
            // Send position updates in multiplayer mode
            // Throttle more aggressively on mobile
            if (multiplayerEnabled && track && track.state === 'running') {
                updateInterval++;
                var throttle = isMobile ? 5 : 3; // Send less frequently on mobile
                if (updateInterval % throttle === 0) {
                    var player = track.player || window.player;
                    if (player && player.position) {
                        Multiplayer.sendPlayerUpdate(
                            player.position,
                            player.angle,
                            player.speed,
                            track.lap ? track.lap.count : 0,
                            track.lap ? track.lap.times[0] : 0
                        );
                    }
                }
            }

            callback(time);
        });
    };
})();

// Save multiplayer race times to leaderboard
function saveMultiplayerRaceTime(trackName, time, racer, laps) {
    if (Leaderboard && Leaderboard.saveTime) {
        Leaderboard.saveTime(trackName, time, racer, laps, true);
        console.log('Multiplayer race time saved:', trackName, time, racer, laps);
    }
}

// Initialize multiplayer menu on load
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initMultiplayerMenu, 100);
    
    // Show mobile warning if needed
    if (isMobile) {
        console.log('Mobile device detected - optimizations enabled');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (multiplayerEnabled) {
        Multiplayer.disconnect();
    }
});

// Prevent zoom on double-tap (mobile)
if (isMobile) {
    var lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
        var now = (new Date()).getTime();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
}