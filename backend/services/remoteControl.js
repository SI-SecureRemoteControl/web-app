const { io } = require('socket.io-client'); // If you're using socket.io client for communication

// WebSocket client setup (updated to your WebSocket server URL)
const socket = io(import.meta.env.VITE_WS_URL); // Use the VITE_WS_URL environment variable

// Function to send mouse click events to the server
function handleMouseClick(event) {
    const mousePosition = { x: event.clientX, y: event.clientY }; // Get mouse position from event
    const message = {
        action: 'mouse_click',
        x: mousePosition.x,
        y: mousePosition.y,
        button: event.button, // 'left', 'right', or 'middle'
    };

    // Send the mouse click command to the WebSocket server
    socket.emit('command', message);

    console.log(`Mouse clicked at: ${mousePosition.x}, ${mousePosition.y} - Button: ${event.button}`);
}

// Function to send keyboard input events to the server
function handleKeyboardInput(event) {
    const message = {
        action: 'keyboard_input',
        key: event.key, // Capture the key that was pressed
    };

    // Send the keyboard input command to the WebSocket server
    socket.emit('command', message);

    console.log(`Key pressed: ${event.key}`);
}

// Capture mouse click events
document.addEventListener('click', handleMouseClick);

// Capture keyboard input events
document.addEventListener('keydown', handleKeyboardInput);

// Acknowledgment handling (example)
socket.on('ack', (response) => {
    if (response.status === 'success') {
        console.log('Command acknowledged by the Android device.');
    } else {
        console.log('Error in executing command:', response.message);
    }
});
