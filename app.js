// Global variables
let peer;
let localStream;
let currentCall;
let myPeerId;
let remotePeerId;
let audioEnabled = true;
let videoEnabled = true;
let isInitiator = false;

// DOM Elements
const joinScreen = document.getElementById('joinScreen');
const callScreen = document.getElementById('callScreen');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const displayRoomId = document.getElementById('displayRoomId');
const copyBtn = document.getElementById('copyBtn');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const remotePlaceholder = document.getElementById('remotePlaceholder');
const micBtn = document.getElementById('micBtn');
const cameraBtn = document.getElementById('cameraBtn');
const endBtn = document.getElementById('endBtn');
const status = document.getElementById('status');

// Generate random room ID
function generateRoomId() {
    return 'ROOM-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

// Initialize peer connection
function initializePeer(roomId, isCreator = false) {
    isInitiator = isCreator;
    
    console.log('Initializing peer with ID:', roomId);
    
    peer = new Peer(roomId, {
        debug: 2,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ]
        }
    });

    peer.on('open', (id) => {
        myPeerId = id;
        console.log('✅ Peer connection opened! My peer ID:', id);
        
        // Update the display
        if (displayRoomId) {
            displayRoomId.textContent = id;
            console.log('✅ Updated displayRoomId to:', id);
        } else {
            console.error('❌ displayRoomId element not found!');
        }
        
        if (isCreator) {
            status.textContent = '✅ Room created! Share the Room ID to start calling';
        } else {
            status.textContent = '🔄 Connected! Attempting to call...';
        }
    });

    peer.on('call', (call) => {
        console.log('📞 Receiving call from:', call.peer);
        status.textContent = '📞 Incoming call...';
        
        // Answer the call with local stream
        call.answer(localStream);
        currentCall = call;

        call.on('stream', (remoteStream) => {
            console.log('📺 Received remote stream');
            console.log('Remote stream tracks:', remoteStream.getTracks());
            
            // CRITICAL FIX: Only set srcObject if it's not already set or if it's a different stream
            // PeerJS can fire 'stream' event multiple times as tracks are added
            if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== remoteStream.id) {
                console.log('🎬 Setting remote video source');
                remoteVideo.srcObject = remoteStream;
                
                // Force video to play
                remoteVideo.play().then(() => {
                    console.log('✅ Remote video playing');
                    remotePlaceholder.style.display = 'none';
                    status.textContent = '✅ Connected - Call in progress';
                }).catch(err => {
                    console.error('❌ Error playing remote video:', err);
                    // Still hide placeholder even if autoplay fails
                    remotePlaceholder.style.display = 'none';
                    status.textContent = '✅ Connected - Click video if it doesn\'t play';
                });
            } else {
                console.log('⏭️ Skipping duplicate stream event (same stream already set)');
                remotePlaceholder.style.display = 'none';
                status.textContent = '✅ Connected - Call in progress';
            }
        });

        call.on('close', () => {
            console.log('📴 Call ended by peer');
            handleCallEnd();
        });

        call.on('error', (err) => {
            console.error('❌ Call error:', err);
            status.textContent = '❌ Call error: ' + err.type;
        });
    });

    peer.on('error', (err) => {
        console.error('❌ Peer error:', err);
        
        if (err.type === 'unavailable-id') {
            status.textContent = '❌ This Room ID is already taken. Try creating a new room.';
            setTimeout(() => {
                showJoinScreen();
            }, 3000);
        } else if (err.type === 'peer-unavailable') {
            status.textContent = '❌ Cannot connect. The room might not exist or host left.';
        } else if (err.type === 'network') {
            status.textContent = '❌ Network error. Check your internet connection.';
        } else if (err.type === 'server-error') {
            status.textContent = '❌ Server error. The PeerJS server might be down. Try again later.';
        } else if (err.message && err.message.includes('Lost connection')) {
            status.textContent = '❌ Server connection lost. The PeerJS cloud server may be down.';
        } else {
            status.textContent = '❌ Connection error: ' + err.type;
        }
    });

    peer.on('disconnected', () => {
        console.log('⚠️ Peer disconnected from server');
        status.textContent = '⚠️ Disconnected. Attempting to reconnect...';
        
        // Try to reconnect
        setTimeout(() => {
            if (peer && !peer.destroyed) {
                console.log('🔄 Attempting to reconnect...');
                peer.reconnect();
            }
        }, 2000);
    });

    peer.on('close', () => {
        console.log('🔴 Peer connection closed');
        status.textContent = 'Connection closed';
    });
}

// Initialize local media stream
async function initializeMedia() {
    try {
        status.textContent = '📹 Requesting camera and microphone access...';
        
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        localVideo.srcObject = localStream;
        
        // Ensure local video plays
        await localVideo.play();
        
        status.textContent = '✅ Media ready';
        console.log('✅ Media devices initialized');
        console.log('Local stream tracks:', localStream.getTracks());
        return true;
    } catch (err) {
        console.error('❌ Error accessing media devices:', err);
        
        if (err.name === 'NotAllowedError') {
            status.textContent = '❌ Camera/microphone access denied. Please allow permissions.';
            alert('Please allow camera and microphone access to use this app.\n\nGo to browser settings and enable permissions.');
        } else if (err.name === 'NotFoundError') {
            status.textContent = '❌ No camera or microphone found.';
            alert('No camera or microphone detected. Please connect one and try again.');
        } else {
            status.textContent = '❌ Error: Could not access camera/microphone';
            alert('Error accessing media devices: ' + err.message);
        }
        return false;
    }
}

// Make a call to another peer
function callPeer(remotePeerId) {
    console.log('📞 Calling peer:', remotePeerId);
    status.textContent = '📞 Calling...';
    
    // Add delay to ensure peer is ready
    setTimeout(() => {
        try {
            const call = peer.call(remotePeerId, localStream);
            
            if (!call) {
                status.textContent = '❌ Failed to initiate call. Room might not exist.';
                return;
            }
            
            currentCall = call;

            call.on('stream', (remoteStream) => {
                console.log('📺 Received remote stream');
                console.log('Remote stream tracks:', remoteStream.getTracks());
                console.log('Remote stream active?', remoteStream.active);
                
                // CRITICAL FIX: Only set srcObject if it's not already set or if it's a different stream
                // PeerJS can fire 'stream' event multiple times as tracks are added
                if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== remoteStream.id) {
                    console.log('🎬 Setting remote video source');
                    remoteVideo.srcObject = remoteStream;
                    
                    // Force video to play
                    remoteVideo.play().then(() => {
                        console.log('✅ Remote video playing');
                        remotePlaceholder.style.display = 'none';
                        status.textContent = '✅ Connected - Call in progress';
                    }).catch(err => {
                        console.error('❌ Error playing remote video:', err);
                        // Still hide placeholder even if autoplay fails
                        remotePlaceholder.style.display = 'none';
                        status.textContent = '✅ Connected - Click video if it doesn\'t play';
                    });
                } else {
                    console.log('⏭️ Skipping duplicate stream event (same stream already set)');
                    remotePlaceholder.style.display = 'none';
                    status.textContent = '✅ Connected - Call in progress';
                }
            });

            call.on('close', () => {
                console.log('📴 Call closed');
                handleCallEnd();
            });

            call.on('error', (err) => {
                console.error('❌ Call error:', err);
                if (err.type === 'peer-unavailable') {
                    status.textContent = '❌ Cannot reach the room. Host might have left or Room ID is wrong.';
                } else {
                    status.textContent = '❌ Call failed: ' + err.type;
                }
            });
        } catch (err) {
            console.error('❌ Exception calling peer:', err);
            status.textContent = '❌ Failed to connect. Please try again.';
        }
    }, 1500);
}

// Handle call end
function handleCallEnd() {
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
    }
    remotePlaceholder.style.display = 'flex';
    status.textContent = '📴 Call ended. Waiting for reconnection...';
    currentCall = null;
}

// Show join screen
function showJoinScreen() {
    joinScreen.classList.remove('hidden');
    callScreen.classList.add('hidden');
    roomIdInput.value = '';
    
    // Clean up
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peer && !peer.destroyed) {
        peer.destroy();
        peer = null;
    }
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    audioEnabled = true;
    videoEnabled = true;
}

// Show call screen
function showCallScreen() {
    joinScreen.classList.add('hidden');
    callScreen.classList.remove('hidden');
}

// Create room
createRoomBtn.addEventListener('click', async () => {
    console.log('🆕 Creating new room...');
    const roomId = generateRoomId();
    console.log('Generated Room ID:', roomId);
    
    const mediaReady = await initializeMedia();
    
    if (mediaReady) {
        showCallScreen();
        initializePeer(roomId, true);
    } else {
        console.error('❌ Media not ready, cannot create room');
    }
});

// Join room
joinRoomBtn.addEventListener('click', async () => {
    const targetRoomId = roomIdInput.value.trim().toUpperCase();
    
    console.log('🚪 Attempting to join room:', targetRoomId);
    
    if (!targetRoomId) {
        alert('⚠️ Please enter a Room ID');
        return;
    }

    const mediaReady = await initializeMedia();
    
    if (mediaReady) {
        showCallScreen();
        
        // Generate a unique ID for ourselves (different from target room)
        const myId = generateRoomId();
        console.log('My ID:', myId, '| Target Room:', targetRoomId);
        
        // Update display to show we're joining
        if (displayRoomId) {
            displayRoomId.textContent = 'Joining: ' + targetRoomId;
            console.log('✅ Updated display for joining');
        }
        
        remotePeerId = targetRoomId;
        
        // Initialize peer with our own ID
        peer = new Peer(myId, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:global.stun.twilio.com:3478' }
                ]
            }
        });

        peer.on('open', (id) => {
            myPeerId = id;
            console.log('✅ My peer ID:', id);
            status.textContent = '🔄 Connected! Calling room...';
            
            // Call the target room
            callPeer(targetRoomId);
        });

        // Note: No peer.on('call') handler here for joiners
        // The stream is handled in callPeer() above
        // Only room creators need to handle incoming calls

        peer.on('error', (err) => {
            console.error('❌ Peer error:', err);
            if (err.type === 'peer-unavailable') {
                status.textContent = '❌ Room not found. Check the Room ID or wait for host to be ready.';
            } else if (err.message && err.message.includes('Lost connection')) {
                status.textContent = '❌ Server connection lost. The PeerJS cloud server may be down.';
            } else {
                status.textContent = '❌ Connection error: ' + err.type;
            }
        });

        peer.on('disconnected', () => {
            console.log('⚠️ Disconnected from server');
            status.textContent = '⚠️ Disconnected. Attempting to reconnect...';
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        });

        peer.on('close', () => {
            console.log('🔌 Connection closed');
            status.textContent = '🔌 Connection closed';
        });
    }
});

// Allow Enter key to join room
roomIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinRoomBtn.click();
    }
});

// Copy room ID
copyBtn.addEventListener('click', () => {
    const roomId = displayRoomId.textContent;
    
    // Don't copy if it's the "Joining:" text
    const actualRoomId = roomId.startsWith('Joining:') ? roomId.replace('Joining: ', '') : roomId;
    
    navigator.clipboard.writeText(actualRoomId).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✓ Copied!';
        copyBtn.style.background = 'rgba(34, 197, 94, 0.3)';
        setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Room ID: ' + actualRoomId);
    });
});

// Toggle microphone
micBtn.addEventListener('click', () => {
    if (localStream) {
        audioEnabled = !audioEnabled;
        localStream.getAudioTracks().forEach(track => {
            track.enabled = audioEnabled;
        });
        micBtn.classList.toggle('active', !audioEnabled);
        
        if (!audioEnabled) {
            micBtn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/></svg>';
        } else {
            micBtn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
        }
    }
});

// Toggle camera
cameraBtn.addEventListener('click', () => {
    if (localStream) {
        videoEnabled = !videoEnabled;
        localStream.getVideoTracks().forEach(track => {
            track.enabled = videoEnabled;
        });
        cameraBtn.classList.toggle('active', !videoEnabled);
        
        if (!videoEnabled) {
            cameraBtn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>';
        } else {
            cameraBtn.innerHTML = '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>';
        }
    }
});

// End call
endBtn.addEventListener('click', endCall);

function endCall() {
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
    
    if (remoteVideo.srcObject) {
        remoteVideo.srcObject = null;
    }
    
    remotePlaceholder.style.display = 'flex';
    status.textContent = '📴 Ending call...';
    
    setTimeout(() => {
        showJoinScreen();
    }, 1000);
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (peer) {
        peer.destroy();
    }
});

// Debug: Log when DOM is ready
console.log('✅ App.js loaded');
console.log('displayRoomId element:', displayRoomId);

// Add click handler to remote video to help with autoplay issues
remoteVideo.addEventListener('click', () => {
    if (remoteVideo.srcObject && remoteVideo.paused) {
        remoteVideo.play().then(() => {
            console.log('▶️ Remote video started playing after click');
        }).catch(err => {
            console.error('Failed to play video:', err);
        });
    }
});