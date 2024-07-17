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
    HOST_IP_SETTINGS_NAME,
    RECEIVED_BATCH_INDEX_SETTINGS_NAME,
    SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME,
    RETRY_SEND_FILE_SETTINGS_NAME,
    WAIT_FOR_FUNCTION_INTERVAL_MILLIS
} from "../common/constants";
import { parseBoolean } from "../settings/functions";

let listedFiles          = [],
    hostIp               = "",
    hostPort             = 12345,
    lookingForHostIp     = false,
    fileBatchCount       = null,
    transferredBatchSet  = new Set(),
    receivedBatchSet     = new Set(),
    retryTimeout        = null,
    retryTimeoutSeconds = 3,
    abortRequestFile     = false;


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

/**
 * Send a command to the smartwatch so that it starts sending
 * the sensor data stored in the file provided as an argument.
 * 
 * Also, optionally stop execution of the thread where this is getting
 * executed to prevent making the smartwatch send more than one file
 * at the same time.
 * 
 * @param {String} filename to be requested to the smartwatch
 */
const requestFile = async filename => {

    abortRequestFile = false;

    transferredBatchSet = new Set();
    receivedBatchSet    = new Set();

    settingsStorage.removeItem(BATCH_INDEX_SETTINGS_NAME);
    settingsStorage.removeItem(RECEIVED_BATCH_INDEX_SETTINGS_NAME);

    sendCommand(SEND_FILE_ACTION_NAME, filename);

    await waitFor(() => receivedBatchSet.size === fileBatchCount || abortRequestFile);
}

settingsStorage.clear();

settingsStorage.addEventListener("change", async ({key, newValue}) => {

    // Send one file from the smartwatch to the laptop:
    if ( key == ASK_FOR_SINGLE_FILE_SETTINGS_NAME ) {

        const { values } = JSON.parse(newValue);
        const filename  = values.map(value => value.name)[0];
        requestFile(filename);
        
        return;
    }
    

    // Send all files in the smartwatch:
    if ( key == ALL_FILES_ACTION_NAME && newValue === ALL_FILES_ACTION_SEND_VALUE ) {

        for(let fileIndex = 0; fileIndex < listedFiles.length; fileIndex++) {
            
            const filename = listedFiles[fileIndex];

            settingsStorage.setItem(FILE_BEING_TRANSFERRED_SETTINGS_NAME, filename);
            if (listedFiles.slice(fileIndex + 1).length) {
                settingsStorage.setItem(FILE_TRANSFER_QUEUE_SETTINGS_NAME, listedFiles.slice(fileIndex + 1));
            } else {
                settingsStorage.removeItem(FILE_TRANSFER_QUEUE_SETTINGS_NAME);
            }

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

    // Retry sending a file that was being sent:
    if ( key == RETRY_SEND_FILE_SETTINGS_NAME && parseBoolean(newValue) ) {

        // Cleanup retry-related stuff
        settingsStorage.removeItem(RETRY_SEND_FILE_SETTINGS_NAME);
        clearTimeout(retryTimeout);

        // Wait for the waitFor function to finish:
        abortRequestFile = true;
        await sleep(WAIT_FOR_FUNCTION_INTERVAL_MILLIS);

        // Re-do the file request:
        const filename = JSON.parse(settingsStorage.getItem(ASK_FOR_SINGLE_FILE_SETTINGS_NAME)).values[0].name;
        requestFile(filename);

        return;
    }

    console.log(`Unhandled command: ${key} - ${newValue}`);
});

/**
 * As soon as phone an smartwatch can talk to each other, request
 * the files so that the file-related options may be shown in
 * the settings.
 */
messaging.peerSocket.addEventListener("open", () => {
    settingsStorage.setItem(ALL_FILES_ACTION_NAME, ALL_FILES_ACTION_RELOAD_VALUE);
    sendCommand(LIST_FILES_ACTION_NAME);
});

/**
 * Messages from the app be both commands or data from the
 * sensors.
 * 
 * The readMessage function is responsible for telling both
 * types of messages apart. So the "message" variable
 * already has que contents of the command or the sensor
 * data.
 */
messaging.peerSocket.addEventListener("message", event => {
    const { isCommand, message } = readMessage(event.data);

    /**
     * Sensor data incoming.
     * sendDataToHost is the function that sends the
     * data to the laptop, all of the other shit is
     * just to show things in the settings.
     */
    if (!isCommand) {

        const batchIndex = parseInt(message.slice(0,2));
        const batchCount = parseInt(message.slice(2,4));

        fileBatchCount = batchCount;
        transferredBatchSet.add(batchIndex);

        retryTimeout = setTimeout(() => {

            settingsStorage.setItem(SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME, true);

        }, retryTimeoutSeconds * 1000);


        settingsStorage.setItem(BATCH_INDEX_SETTINGS_NAME, transferredBatchSet.size);
        settingsStorage.setItem(BATCH_COUNT_SETTINGS_NAME, batchCount);

        sendDataToHost(message);
        return;
    }

    /**
     * If we got so far in the funtion, then it was
     * a command what the smartwatch sent to the phone.  
     */

    const { action, payload } = message;

    switch(action) {

        /**
         * A file has been sent to include it in the file
         * listing shown in the settings page.
         */
        case FILE_LISTED_ACTION_NAME:

            listedFiles.push(payload);
            settingsStorage.setItem(FILES_LIST_SETTINGS_NAME, listedFiles);

            break;

        /**
         * A file (or all of them) has (have) been
         * successfully deleted in the smartwatch.
         */
        case FILE_DELETED_ACTION_NAME:

            /**
             * Update the files that will be shown in the
             * settings without having to press the reload
             * files button.
             */
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

        /**
         * The smartwatch has finished sending the
         * names of all of the files it has. The file-
         * related options in the settings can finally
         * be rendered.
         */
        case FILE_LIST_COMPLETED_ACTION_NAME:

            settingsStorage.removeItem(ALL_FILES_ACTION_NAME);
            break;

        /**
         * The smartwatch started or stopped recording.
         * Update that info in the settings.
         */
        case IS_RECORDING_SETTINGS_NAME:

            settingsStorage.removeItem(RECORD_COMMAND_SETTINGS_NAME);
            settingsStorage.setItem(IS_RECORDING_SETTINGS_NAME, payload);

            break;

        default:
            console.log(`Unknown command: ${action} - ${payload}`);
            break;
    }
});


/**
 *  All the IP addresses that will be checked to find the host IP
 * This must be changed if the local IP address of the phone does
 * not start with 192.168.0 or 192.168.1
 */
// const LOCAL_NETWORK_IP_ADDRESSES = [...Array(256).keys()].map(digit => [`192.168.0.${digit}`, `192.168.1.${digit}`]).flat()
const LOCAL_NETWORK_IP_ADDRESSES = ["192.168.1.185"];

/**
 * Forward data from sensors to the laptop and update information in the settings
 * page related to how the thing is going.
 * 
 * @param {ArrayBuffer} data: binary data from sensors to be forwarded to the laptop
 * @returns {void}
 */
const sendDataToHost = async data => {
    
    if (!hostIp) {
        return;
    }

    try {
        let response = await fetch(`http://${hostIp}:${hostPort}/fitbit-endpoint-imu/`, {
            method: "POST",
            body: data,
            headers: {"Content-type": "application/octet-stream"}
        });

        if ( !response.ok ) {
            return;
        }

        response = await response.text();
        
        // let completedFile = response.match(/^COMPLETED\_FILE\-([a-z0-9\_\-\.]+)$/);
        // if ( !!completedFile && completedFile.length == 2 ) {
        //     filesBeingTransfered[completedFile[1]] = true;
        //     return;
        // }

        let receivedBatchIndex = response.match(/^RECEIVED\_BATCH\_INDEX\-([0-9]+)$/);
        
        if ( !!receivedBatchIndex && receivedBatchIndex.length === 2 ) {
            receivedBatchSet.add(receivedBatchIndex[1]);
            settingsStorage.setItem(RECEIVED_BATCH_INDEX_SETTINGS_NAME, receivedBatchSet.size);
        }

        if ( receivedBatchSet.size === transferredBatchSet.size ) {
            clearTimeout(retryTimeout);
        }

    } catch( error ) {
        console.error(`Error when trying to send IMU data to host: ${error}`);
    }
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

}, 2000); // look for host IP addresses every 2 seconds