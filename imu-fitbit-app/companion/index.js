import { inbox, outbox } from "file-transfer";
import { BATCH_SIZE } from "../common/constants";

/**
 * Add functionality to the string type so that it can be parsed to an ArrayBuffer
 * to be sent in file to the smartwatch.
 * 
 * @returns ArrayBuffer
 */
String.prototype.toArrayBuffer = function() {
    // Buffer that will store the codes for each character, each of which
    // takes two bytes (hence Uint16Array type)
    const bufferedString = new Uint16Array(this.length);

    for(let charIndex = 0; charIndex < this.length; charIndex++) {
        bufferedString[charIndex] = this.charCodeAt(charIndex);
    }
    
    return bufferedString;
}

let hostIp           = "",
    hostPort         = 12345,
    lookingForHostIp = false;

// All the IP addresses that will be checked to find the host IP
// This must be changed if the local IP address of the phone does
// not start with 192.168.0 or 192.168.1
const LOCAL_NETWORK_IP_ADDRESSES = [...Array(256).keys()].map(digit => [`192.168.0.${digit}`, `192.168.1.${digit}`]).flat()
// const LOCAL_NETWORK_IP_ADDRESSES = ["192.168.1.185"];

/**
 * Send the heart rate data to the host.
 * 
 * @param {InboxItem} file: that has just been received from the smartwatch with heart rate samples
 * @returns {String} the result of the attempt to send the heart rate data to the host
 */
const sendFileToHost = async file => {

    let response;

    if (!hostIp) return "ERROR";

    try {
        const buffer = await file.arrayBuffer();

        response = await fetch(`http://${hostIp}:${hostPort}/fitbit-endpoint`, {
            method: "POST",
            body: buffer,
            headers: {
                "Content-length": buffer.byteLength,
                "X_FITBIT_FILENAME": file.name,
                "X_FITBIT_BATCH_SIZE": BATCH_SIZE
            }
        });

        response = await response.text()

    } catch( error ) {
        console.error(`Error when trying to send heart rate data to host: ${error}`);
        response = "ERROR"
    }
    
    return response
}

/**
 * Send a GET request to the given IP address to check if it corresponds to the host
 * 
 * @param {String} ipAddress: the IP address that will be pinged to check if it corresponds to the host IP
 * @returns {Boolean} if the ping to the IP address has been successful or not
 */
const pingIp = ipAddress => new Promise(async (resolve, reject) => {

    try {
        // Prevent this request to be hanging indefinitely.
        // If it has not been resolved after 4 seconds, discard this IP address.
        setTimeout(() => resolve(false), 4000);

        const response = await fetch(`http://${ipAddress}:${hostPort}/fitbit-ping/`);

        // Only accept the ipAddress as the host IP address if the response is successful
        // and the message received is the expected one "FITBIT_HOST"
        if (response.ok && await response.text() == "FITBIT_HOST") {
            hostIp = ipAddress;
            resolve(true)
        }

        // Otherwise this ipAddress is not valid
        resolve(false);

    // If an error occurs due to the fetch function, also discard this IP address
    } catch (error) {
        resolve(false)
    }

});

// Periodically look for the host IP address or check if the host IP address is still ok
setInterval(async () => {

    // Prevent this function to run multiple times concurrently
    if ( lookingForHostIp ) return;

    lookingForHostIp = true;

    // If a host IP address has already been defined, check if it is still up
    if ( hostIp && await pingIp(hostIp) ) {

        await outbox.enqueue("host_ip", hostIp.toArrayBuffer());
        lookingForHostIp = false;

        return;
    }

    // If the above is not the case, a new host IP address must be found or let the smartwatch
    // know that there is no host IP address any more
    hostIp = "";
    
    // Look for the host IP among all the defined IP addresses
    await Promise.all(LOCAL_NETWORK_IP_ADDRESSES.map(ipAddress => pingIp(ipAddress)));
    await outbox.enqueue("host_ip", hostIp.toArrayBuffer());

    lookingForHostIp = false;

}, 10000); // look for host IP addresses every 10 seconds

/**
 * Callback for the event of file received.
 * Read each received file form the smartwatch and act accordingly.
 */
const processIncomingFiles = async () => {
    let file;

    while (( file = await inbox.pop() )) {

        // If file has been successfully sent to the host, tell the smartwatch to delete it
        if (await sendFileToHost(file) == "OK") {
            outbox.enqueue("delete_file", file.name.toArrayBuffer());
        }

    }
}

// Set the callback for the event of file received from smartwatch
inbox.addEventListener("newfile", processIncomingFiles);
processIncomingFiles(); // execute it already in case there is any file in queue
