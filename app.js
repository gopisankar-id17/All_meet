// Global variables
let peer;
let localStream;
let currentCall;
let myPeerId;
let remotePeerId;
let audioEnabled = true;
let videoEnabled = true;

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
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Initialize peer connection
function initializePeer(roomId) {
    peer = new Peer(roomId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        myPeerId = id;
        displayRoomId.textContent = id;
        status.textContent = 'Connected - Share your Room ID to start';
        console.log('My peer ID:', id);
    });

    peer.on('call', (call) => {
        console.log('Receiving call...');
        status.textContent = 'Incoming call...';
        
        // Answer the call with local stream
        call.answer(localStream);
        currentCall = call;

        call.on('stream', (remoteStream) => {
            console.log('Received remote stream');
            remoteVideo.srcObject = remoteStream;
            remotePlaceholder.style.display = 'none';
            status.textContent = 'Connected - Call in progress';
        });

        call.on('close', () => {
            console.log('Call ended');
            endCall();
        });

        call.on('error', (err) => {
            console.error('Call error:', err);
            status.textContent = 'Call error: ' + err.message;
        });
    });

    peer.on('error', (err) => {
        console.error('Peer error:', err);
        status.textContent = 'Connection error: ' + err.type;
        
        if (err.type === 'unavailable-id') {
            status.textContent = 'Room ID already in use. Please try another.';
            setTimeout(() => {
                showJoinScreen();
            }, 2000);
        }
    });

    peer.on('disconnected', () => {
        console.log('Peer disconnected');
        status.textContent = 'Disconnected from server';
    });
}

// Initialize local media stream
async function initializeMedia() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: true
        });
        
        localVideo.srcObject = localStream;
        status.textContent = 'Media ready - Connecting...';
        return true;
    } catch (err) {
        console.error('Error accessing media devices:', err);
        status.textContent = 'Error: Could not access camera/microphone';
        alert('Please allow camera and microphone access to use this app.');
        return false;
    }
}

// Make a call to another peer
function callPeer(remotePeerId) {
    console.log('Calling peer:', remotePeerId);
    status.textContent = 'Calling...';
    
    const call = peer.call(remotePeerId, localStream);
    currentCall = call;

    call.on('stream', (remoteStream) => {
        console.log('Received remote stream');
        remoteVideo.srcObject = remoteStream;
        remotePlaceholder.style.display = 'none';
        status.textContent = 'Connected - Call in progress';
    });

    call.on('close', () => {
        console.log('Call ended');
        endCall();
    });

    call.on('error', (err) => {
        console.error('Call error:', err);
        status.textContent = 'Failed to connect. Please check the Room ID.';
    });
}

// Show join screen
function showJoinScreen() {
    joinScreen.classList.remove('hidden');
    callScreen.classList.add('hidden');
    
    // Clean up
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peer) {
        peer.destroy();
        peer = null;
    }
    if (currentCall) {
        currentCall.close();
        currentCall = null;
    }
}

// Show call screen
function showCallScreen() {
    joinScreen.classList.add('hidden');
    callScreen.classList.remove('hidden');
}

// Create room
createRoomBtn.addEventListener('click', async () => {
    const roomId = generateRoomId();
    const mediaReady = await initializeMedia();
    
    if (mediaReady) {
        showCallScreen();
        initializePeer(roomId);
    }
});

// Join room
joinRoomBtn.addEventListener('click', async () => {
    const roomId = roomIdInput.value.trim().toUpperCase();
    
    if (!roomId) {
        alert('Please enter a Room ID');
        return;
    }

    const mediaReady = await initializeMedia();
    
    if (mediaReady) {
        showCallScreen();
        // Generate a unique ID for ourselves
        const myId = generateRoomId();
        initializePeer(myId);
        
        // Wait for peer to be ready, then call the room
        setTimeout(() => {
            callPeer(roomId);
        }, 1000);
    }
});

// Copy room ID
copyBtn.addEventListener('click', () => {
    const roomId = displayRoomId.textContent;
    navigator.clipboard.writeText(roomId).then(() => {
        copyBtn.textContent = '✓';
        setTimeout(() => {
            copyBtn.textContent = '📋';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
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
    
    remoteVideo.srcObject = null;
    remotePlaceholder.style.display = 'flex';
    status.textContent = 'Call ended';
    
    setTimeout(() => {
        showJoinScreen();
    }, 1500);
}