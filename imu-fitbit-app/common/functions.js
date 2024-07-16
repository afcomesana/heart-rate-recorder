import * as messaging from "messaging";

String.prototype.toArrayBuffer = function() {
    const bufferedString = new Uint8Array(this.length);

    for(let charIndex = 0; charIndex < this.length; charIndex++) {
        bufferedString[charIndex] = this.charCodeAt(charIndex);
    }

    return bufferedString;
}

export const sendCommand = (action, payload = null) => {
    const message = JSON.stringify({action, payload}).toArrayBuffer();
    const isCommand = new Uint8Array([1]);

    messaging.peerSocket.send(new Uint8Array([...isCommand, ...message]));
}

export const readMessage = (buffer, callback = null) => {

    /**
     * Read if it is a command or not, eventhough commands
     * and not commands are encoded differently, we can still
     * tell if it is a command or not by reading the first byte.
     */
    const isCommand = parseInt(new Uint8Array(buffer.slice(0,1)));
    let message     = buffer.slice(1);

    // Commands are encoded in Uint8Array
    if ( isCommand ) {
        message = String.fromCharCode(...new Uint8Array(message));
        message = JSON.parse(message);
    
    /**
     * Sensor data is not, so the first byte of the remaining
     * message has to be remove to prevent a sliding of 1
     * byte that would mess all the data up.
     */
    } else {
        message = message.slice(1);
    }

    return {isCommand, message};
}

export const waitFor = callback => new Promise((resolve, reject) => {
    setInterval(() => {
        if (callback()) {
            resolve(true);
        }
    }, 500);
});


/**
 * When used inside an async function preceeded by the keyword "await",
 * delays the execution of that funciton the number of millis passed
 * as argument.
 * 
 * @param {Int} milliseconds to wait
 * @returns {Boolean} not useful at all
 */
export const sleep = milliseconds => new Promise((resolve, reject) => setTimeout(() => resolve(true), milliseconds));