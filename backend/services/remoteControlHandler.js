const { io } = require('socket.io-client');
const robot = require('robotjs');

// Function to handle WebSocket commands
function handleCommands(socket) {
    // Listen for commands sent from the admin's remote control
    socket.on('command', (message) => {
        console.log('Received command:', message);

        // Handle the mouse click
        if (message.action === 'mouse_click') {
            // Simulate the mouse click using robotjs
            const mousePosition = { x: message.x, y: message.y };
            robot.moveMouse(mousePosition.x, mousePosition.y);
            robot.mouseClick(message.button); // button can be 'left', 'right', 'middle'
            console.log(`Simulating mouse click at (${message.x}, ${message.y}) with button ${message.button}`);

            // Acknowledge the success to the client
            socket.emit('ack', { status: 'success', message: 'Mouse click successful' });
        }

        // Handle keyboard input
        else if (message.action === 'keyboard_input') {
            // Simulate keyboard input using robotjs
            robot.keyTap(message.key);
            console.log(`Simulating key press: ${message.key}`);

            // Acknowledge the success to the client
            socket.emit('ack', { status: 'success', message: `Key pressed: ${message.key}` });
        }

        // If the action is unknown, send an error acknowledgment
        else {
            console.log('Unknown command action:', message.action);
            socket.emit('ack', { status: 'error', message: 'Unknown command action' });
        }
    });
}

module.exports = { handleCommands };
