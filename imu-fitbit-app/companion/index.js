import * as messaging from "messaging";
import { settingsStorage } from "settings";
import { SAMPLES_PER_BATCH, AXIS_NAMES, SAMPLE_FREQUENCY } from "../common/constants";
import { readMessage, sendCommand, sleep, waitFor } from "../common/functions";

let listedFiles = [],
    filesBeingTransfered = {};

/**
 * Add functionality to the string type so that it can be parsed to an ArrayBuffer
 * to be sent in file to the smartwatch.
 * 
 * @returns ArrayBuffer
 */

String.prototype.toArrayBuffer = function() {
    const bufferedString = new Uint16Array(this.length);

    for(let charIndex = 0; charIndex < this.length; charIndex++) {
        bufferedString[charIndex] = this.charCodeAt(charIndex);
    }

    return bufferedString;
}

const requestFile = async filename => {

    filesBeingTransfered[filename] = false;

    sendCommand("sendFile", filename);
    await waitFor(() => filesBeingTransfered[filename]);
    delete filesBeingTransfered[filename];


}

settingsStorage.clear();
settingsStorage.addEventListener("change", async ({key, newValue}) => {

    if (key == "singleFileToAskFor") {

        const { values } = JSON.parse(newValue);
        const filename  = values.map(value => value.name)[0];
        await requestFile(filename);
        
    } else if ( key == "allFilesAction" && newValue === "send" ) {
        
        // const filesNumberToShowInQueue = 5;

        for(let fileIndex = 0; fileIndex < listedFiles.length; fileIndex++) {
            const filename = listedFiles[fileIndex];
            // const lastOfTheNextFilesIndex = Math.min(fileIndex + filesNumberToShowInQueue + 1, listedFiles.length - 1);

            settingsStorage.setItem("fileBeingTransferred", filename);
            settingsStorage.setItem("nextFilesToBeTransferred", listedFiles.slice(fileIndex + 1));
            await sleep(4000);
            // await requestFile(filename);
        }
    }
});

messaging.peerSocket.addEventListener("open", () => {
    sendCommand("listFiles", null);
});

messaging.peerSocket.addEventListener("message", event => {
    const { isCommand, message } = readMessage(event.data);

    if (!isCommand) {

        const batchIndex = parseInt(message.slice(0,2));
        const batchCount = parseInt(message.slice(2,4));

        settingsStorage.setItem("batchIndex", batchIndex);
        settingsStorage.setItem("batchCount", batchCount);

        sendDataToHost(message);
        return;
    }

    const { action, payload } = message

    switch(action) {
        case "listed_file":
            listedFiles.push(payload);
            settingsStorage.setItem("files", listedFiles);
            break;
        
        default:
            console.log(`Unknown command: ${action} - ${payload}`);
            break;
    }
});


let hostIp           = "",
    hostPort         = 12345,
    lookingForHostIp = false;

// All the IP addresses that will be checked to find the host IP
// This must be changed if the local IP address of the phone does
// not start with 192.168.0 or 192.168.1
const LOCAL_NETWORK_IP_ADDRESSES = [...Array(256).keys()].map(digit => [`192.168.0.${digit}`, `192.168.1.${digit}`]).flat()

const sendDataToHost = async data => {
    let response;
    hostIp = "192.168.1.185";
    if (!hostIp) return "ERROR";

    try {
        response = await fetch(`http://${hostIp}:${hostPort}/fitbit-endpoint/`, {
            method: "POST",
            body: data,
            headers: {"Content-type": "application/octet-strem"}
        });

        response = await response.text();

    } catch( error ) {
        console.error(`Error when trying to send IMU data to host: ${error}`);
        response = "ERROR";
    }
    
    return response;
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

// // Periodically look for the host IP address or check if the host IP address is still ok
// setInterval(async () => {

//     // Prevent this function to run multiple times concurrently
//     if ( lookingForHostIp ) return;

//     lookingForHostIp = true;

//     // If a host IP address has already been defined, check if it is still up
//     if ( hostIp && await pingIp(hostIp) ) {

//         await outbox.enqueue("host_ip", hostIp.toArrayBuffer());
//         lookingForHostIp = false;

//         return;
//     }

//     // If the above is not the case, a new host IP address must be found or let the smartwatch
//     // know that there is no host IP address any more
//     hostIp = "";
    
//     // Look for the host IP among all the defined IP addresses
//     await Promise.all(LOCAL_NETWORK_IP_ADDRESSES.map(ipAddress => pingIp(ipAddress)));
//     await outbox.enqueue("host_ip", hostIp.toArrayBuffer());

//     lookingForHostIp = false;

// }, 10000); // look for host IP addresses every 10 secondsW




// const { data }  = event;

// const response = await sendDataToHost(data);

// if ( /^COMPLETED\_FILE/.test(response) ) {
//     console.log(response);
// }