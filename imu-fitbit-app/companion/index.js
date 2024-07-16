import * as messaging from "messaging";
import { settingsStorage } from "settings";
import { readMessage, sendCommand, sleep, waitFor } from "../common/functions";
import { 
    SEND_FILE_ACTION_NAME,
    ASK_FOR_SINGLE_FILE_SETTINGS_NAME,
    ALL_FILES_ACTION_NAME,
    DELETE_FILE_ACTION_NAME,
    RECORD_COMMAND_SETTINGS_NAME,
    FILE_BEING_TRANSFERRED_SETTINGS_NAME,
    FILE_TRANSFER_QUEUE_SETTINGS_NAME,
    DELETE_SINGLE_FILE_SETTINGS_NAME,
    LIST_FILES_ACTION_NAME,
    BATCH_INDEX_SETTINGS_NAME,
    BATCH_COUNT_SETTINGS_NAME,
    FILE_DELETED_ACTION_NAME,
    FILE_LISTED_ACTION_NAME,
    FILES_LIST_SETTINGS_NAME,
    IS_RECORDING_SETTINGS_NAME,
    FILE_LIST_COMPLETED_ACTION_NAME,
    DELETE_ALL_FILES_ACTION_VALUE,
    ALL_FILES_ACTION_DELETE_VALUE,
    ALL_FILES_ACTION_SEND_VALUE,
    ALL_FILES_ACTION_RELOAD_VALUE,
    HOST_IP_SETTINGS_NAME
} from "../common/constants";

let listedFiles = [],
    filesBeingTransfered = {},
    hostIp           = "",
    hostPort         = 12345,
    lookingForHostIp = false;

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

    sendCommand(SEND_FILE_ACTION_NAME, filename);
    await waitFor(() => filesBeingTransfered[filename]);
    delete filesBeingTransfered[filename];
}

settingsStorage.clear();

settingsStorage.addEventListener("change", async ({key, newValue}) => {

    // Send one file from the smartwatch to the laptop:
    if ( key == ASK_FOR_SINGLE_FILE_SETTINGS_NAME ) {

        const { values } = JSON.parse(newValue);
        const filename  = values.map(value => value.name)[0];
        await requestFile(filename);
        
        return;
    }
    

    // Send all files in the smartwatch:
    if ( key == ALL_FILES_ACTION_NAME && newValue === ALL_FILES_ACTION_SEND_VALUE ) {

        for(let fileIndex = 0; fileIndex < listedFiles.length; fileIndex++) {
            
            const filename = listedFiles[fileIndex];

            settingsStorage.setItem(FILE_BEING_TRANSFERRED_SETTINGS_NAME, filename);
            settingsStorage.setItem(FILE_TRANSFER_QUEUE_SETTINGS_NAME, listedFiles.slice(fileIndex + 1));

            if ( !/^trial\_/.test(filename) ) {
                continue;
            }

            await requestFile(filename);
        }

        return;
    }


    // Delete all files in the smartwatch:
    if ( key === DELETE_FILE_ACTION_NAME && newValue === DELETE_ALL_FILES_ACTION_VALUE && settingsStorage.getItem(ALL_FILES_ACTION_NAME) === ALL_FILES_ACTION_DELETE_VALUE) {
        sendCommand(DELETE_FILE_ACTION_NAME, DELETE_ALL_FILES_ACTION_VALUE);
        return;
    }

    // Delete a single file in the smartwatch:
    if ( key === DELETE_FILE_ACTION_NAME && JSON.parse(settingsStorage.getItem(DELETE_SINGLE_FILE_SETTINGS_NAME)).values[0].name === newValue ) {
        sendCommand(DELETE_FILE_ACTION_NAME, newValue);
        return;
    }

    // Reload files in the smartwatch:
    if ( key == ALL_FILES_ACTION_NAME && newValue == ALL_FILES_ACTION_RELOAD_VALUE ) {
        listedFiles = [];
        sendCommand(LIST_FILES_ACTION_NAME);
        return;
    }

    // Update if the smartwatch is recording or not:
    if ( key == RECORD_COMMAND_SETTINGS_NAME && !!newValue ) {
        sendCommand(RECORD_COMMAND_SETTINGS_NAME, newValue);
        return;
    }

    console.log(`This should not be printed: ${key} - ${newValue}`);
});

messaging.peerSocket.addEventListener("open", () => {
    settingsStorage.setItem(ALL_FILES_ACTION_NAME, ALL_FILES_ACTION_RELOAD_VALUE);
    sendCommand(LIST_FILES_ACTION_NAME);
});

messaging.peerSocket.addEventListener("message", event => {
    const { isCommand, message } = readMessage(event.data);

    if (!isCommand) {

        const batchIndex = parseInt(message.slice(0,2));
        const batchCount = parseInt(message.slice(2,4));

        settingsStorage.setItem(BATCH_INDEX_SETTINGS_NAME, batchIndex);
        settingsStorage.setItem(BATCH_COUNT_SETTINGS_NAME, batchCount);

        sendDataToHost(message);
        return;
    }

    const { action, payload } = message

    switch(action) {
        case FILE_LISTED_ACTION_NAME:

            listedFiles.push(payload);
            settingsStorage.setItem(FILES_LIST_SETTINGS_NAME, listedFiles);

            break;

        case FILE_DELETED_ACTION_NAME:

            if ( payload === DELETE_ALL_FILES_ACTION_VALUE ) {
                listedFiles = [];
            } else {
                listedFiles = listedFiles.filter(filename => filename != payload);
            }

            settingsStorage.removeItem(DELETE_SINGLE_FILE_SETTINGS_NAME);
            settingsStorage.removeItem(ALL_FILES_ACTION_NAME);
            settingsStorage.removeItem(DELETE_FILE_ACTION_NAME);

            settingsStorage.setItem(FILES_LIST_SETTINGS_NAME, listedFiles);

            break;

        case FILE_LIST_COMPLETED_ACTION_NAME:

            settingsStorage.removeItem(ALL_FILES_ACTION_NAME);

            break;

        case IS_RECORDING_SETTINGS_NAME:

            settingsStorage.removeItem(RECORD_COMMAND_SETTINGS_NAME);
            settingsStorage.setItem(IS_RECORDING_SETTINGS_NAME, payload);

            break;

        default:
            console.log(`Unknown command: ${action} - ${payload}`);
            break;
    }
});


// All the IP addresses that will be checked to find the host IP
// This must be changed if the local IP address of the phone does
// not start with 192.168.0 or 192.168.1
const LOCAL_NETWORK_IP_ADDRESSES = [...Array(256).keys()].map(digit => [`192.168.0.${digit}`, `192.168.1.${digit}`]).flat()

const sendDataToHost = async data => {
    let response;
    
    if (!hostIp) return "ERROR";

    try {
        response = await fetch(`http://${hostIp}:${hostPort}/fitbit-endpoint/`, {
            method: "POST",
            body: data,
            headers: {"Content-type": "application/octet-stream"}
        });

        response = await response.text();

        let completedFile = response.match(/^COMPLETED\_FILE\-([a-z0-9\_\-\.]+)$/);
        
        if ( !!completedFile && completedFile.length == 2 ) {
            completedFile = completedFile[1];

            filesBeingTransfered[completedFile] = true;            
        }

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

// Periodically look for the host IP address or check if the host IP address is still ok
setInterval(async () => {

    // Prevent this function to run multiple times concurrently
    if ( lookingForHostIp ) return;

    lookingForHostIp = true;

    // If a host IP address has already been defined, check if it is still up
    if ( hostIp && await pingIp(hostIp) ) {

        settingsStorage.setItem(HOST_IP_SETTINGS_NAME, hostIp);
        lookingForHostIp = false;

        return;
    }

    // If the above is not the case, a new host IP address must be found or let the smartwatch
    // know that there is no host IP address any more
    hostIp = "";
    settingsStorage.removeItem(HOST_IP_SETTINGS_NAME);
    
    // Look for the host IP among all the defined IP addresses
    await Promise.all(LOCAL_NETWORK_IP_ADDRESSES.map(ipAddress => pingIp(ipAddress)));
    settingsStorage.setItem(HOST_IP_SETTINGS_NAME, hostIp);
    lookingForHostIp = false;

}, 10000); // look for host IP addresses every 10 seconds