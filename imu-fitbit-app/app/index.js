
import * as messaging from "messaging";
import * as document  from "document";
import Accelerometer  from "accelerometer";
import Gyroscope      from "gyroscope";
import { me }         from "appbit";
import { display }    from "display";

import {
    openSync,
    writeSync,
    closeSync,
    listDirSync,
    unlinkSync,
    readSync,
    statSync
} from "fs";

import { APP_DIRECTORY, SAMPLE_FREQUENCY, AXIS_NAMES, SAMPLES_PER_BATCH, BYTES_PER_BATCH } from "../common/constants";
import { sleep, readMessage, sendCommand } from "../common/functions";

String.prototype.toArrayBuffer = function() {
    const bufferedString = new Uint16Array(this.length);

    for(let charIndex = 0; charIndex < this.length; charIndex++) {
        bufferedString[charIndex] = this.charCodeAt(charIndex);
    }

    return bufferedString;
}

let isSendingFiles     = false,
    hostIp             = "",
    isRecording        = false;

me.appTimeoutEnabled = false;

// Keep screen always on:
setInterval(() => display.poke(), 1000);

// Get smartwatch screen elements
const manageRecordingButton = document.getElementById("manage-recording-button");
const manageRecordingText   = document.getElementById("manage-recording-text");


const SENSORS = [
    {
        "filePrefix": "acc",
        "sensor": new Accelerometer({frequency: SAMPLE_FREQUENCY, batch: SAMPLES_PER_BATCH}),
        "fileDescriptor": null,
        "filename": null,
    },
    {
        "filePrefix": "gyro",
        "sensor": new Gyroscope({frequency: SAMPLE_FREQUENCY, batch: SAMPLES_PER_BATCH}),
        "fileDescriptor": null,
        "filename": null,
    }
]

SENSORS.forEach(sensor => sensor.sensor.addEventListener("reading", () => readingCallback(sensor)));

messaging.peerSocket.addEventListener("message", async event => {

    /**
     * Messages to the smartwatch will always be commands, so we extract only
     * the "message" part of the result of the readMessage function, which is 
     * an object action (to execute) and payload (to execute the action upon)
     */
    const { message: { action, payload } } = readMessage(event.data);

    switch(action) {
        case "listFiles":
            sendFilesListToCompanion();
            break;

        case "sendFile":
            sendFileToCompanion(payload);
            break;

        case "deleteFile":
            console.log(`file to delete: ${payload}`);
            break;

        default:
            console.log(`Unknown command: ${action} - ${payload}`);
            break;
    }
});

/**
 * Send the names of all the files that currently exist in the
 * smartwatch.
 */
const sendFilesListToCompanion = () => {
    const listDir = listDirSync(APP_DIRECTORY);
    let dirItem   = listDir.next();

    while ( !dirItem.done ) {
        sendCommand("listed_file", dirItem.value);
        dirItem = listDir.next();

        /**
         * If there were too many little files, this could eventually
         * crush. If happened, if may suffice with adding a line to
         * make this loop wait a little between iterations, just to
         * let the smartwatch "breathe"
         * 
         * await sleep(20); <-- this would wait 20 millis before the next iteration
         * 
         * If this was done, function definition should be changed
         * to "const sendFilesListToCompanion = async () => {"
         * to allow the keyword await to be used inside the function
         * definition.
         */
    }
}


async function sendFileToCompanion(filename) {
    console.log(`executing send file function for file: ${filename}`);
    const fileDescriptor = openSync(filename, "r");
    const fileSize       = statSync(filename).size;

    const fileInitialTimestamp = parseInt(filename.split("-").slice(-1));

    const batchCount = parseInt(fileSize / (AXIS_NAMES.length * BYTES_PER_BATCH))

    let bytesOffset        = 0,
        batchIndex         = 0,
        batchTimestampStep = parseInt(1000/SAMPLE_FREQUENCY)*SAMPLES_PER_BATCH;

    try {
        while (batchIndex < batchCount) {
            /**
             * Total size of the array buffer with the data:
             * - timestamp: 13
             * - 3 axis per sample * 100 samples per batch = 300
             * - 1 per character in the file name
             */

            const timestamp = (fileInitialTimestamp + (batchTimestampStep*batchIndex)).toString().toArrayBuffer();

            const x = new Float32Array(SAMPLES_PER_BATCH);
            const y = new Float32Array(SAMPLES_PER_BATCH);
            const z = new Float32Array(SAMPLES_PER_BATCH);
            
            readSync(fileDescriptor, x, 0, BYTES_PER_BATCH, bytesOffset);
            bytesOffset += BYTES_PER_BATCH;

            readSync(fileDescriptor, y, 0, BYTES_PER_BATCH, bytesOffset);
            bytesOffset += BYTES_PER_BATCH;

            readSync(fileDescriptor, z, 0, BYTES_PER_BATCH, bytesOffset);
            bytesOffset += BYTES_PER_BATCH;

            const parsedX = new Int16Array(SAMPLES_PER_BATCH);
            const parsedY = new Int16Array(SAMPLES_PER_BATCH);
            const parsedZ = new Int16Array(SAMPLES_PER_BATCH);

            let index = SAMPLES_PER_BATCH;

            while(index--) {
                parsedX[index] = x[index] * 100;
                parsedY[index] = y[index] * 100;
                parsedZ[index] = z[index] * 100;
            }

            const data = new Int16Array([
                0, // tell the companion that this is not a command
                batchIndex,
                batchCount,
                ...parsedZ,
                ...parsedX,
                ...parsedY,
                ...timestamp,
                ...filename.toArrayBuffer()
            ]);

            batchIndex++;

            messaging.peerSocket.send(data);
            await sleep(5);
        }
        console.log(`finisehd file transmision: ${filename}`);
    }

    catch(error) {
        console.log(`Could not read file: ${error}`);

    } finally {
        closeSync(fileDescriptor);
    }

}

// /**
//  * Create file for the given sensor and write batch readings in it.
//  * @param {Object} sensor: One of the objects in the SENSORS array.
//  */
// const readingCallback = sensor => {
//     if ( sensor.fileDescriptor == null ) {
//         const date            = new Date();
//         const timestamp       = new Date().getTime(); // Add Unix timestamp in milliseconds
//         sensor.filename       = `trial_${sensor.filePrefix}_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${timestamp}`;
//         sensor.fileDescriptor = openSync(sensor.filename, "w");
//     }
//     //     // Write headers to the file
//     //     writeSync(sensor.fileDescriptor, AXIS_NAMES.join(",") + "\n");
//     // }
//     // // Add Unix timestamp to the readings
//     // const timestamp = new Date().getTime();
//     // console.log('timestamp is: ${timestamp}')
//     // let dataString = `${timestamp}`;

//     // // Append sensor readings to the data string
//     // AXIS_NAMES.slice(1).forEach(axisName => {
//     //     dataString += `,${sensor.sensor.readings[axisName]}`;
//     // });

//     // // Write the data string to the file
//     // writeSync(sensor.fileDescriptor, dataString + "\n");
//     // this is where data is written in the files
//     AXIS_NAMES.forEach(axisName => writeSync(sensor.fileDescriptor, sensor.sensor.readings[axisName]));
// };

// // Handle sensor activity and files according to user interaction and update user interface
// manageRecordingButton.addEventListener("click", () => {

//     // Sensors are already working: stop them and close the files where they were writing the samples
//     if (isRecording) {

//         SENSORS.forEach(sensor => {

//             sensor.sensor.stop();
//             closeSync(sensor.fileDescriptor);

//             sensor.filename       = null;
//             sensor.fileDescriptor = null;

//         });

//         manageRecordingText.text = "Start";

//         isRecording = false;

//     // Sensors are not working, start recording:
//     } else {
//         SENSORS.forEach(sensor => sensor.sensor.start());
//         manageRecordingText.text = "Stop";

//         isRecording = true;
//     }

// });

// // Periodically try to send stored files with heart rate samples
// setInterval(async () => {

//     // Prevent this function to run multiple times at once or if the server that has
//     // to receive the samples is not up or its address is not known.
//     if ( isSendingFiles || !hostIp ) {
//         return;
//     }
//     console.log("about to send files")

//     isSendingFiles = true;

//     // Send files from smartwatch to phone:    
//     const listDir = listDirSync(APP_DIRECTORY);
//     let dirItem   = listDir.next();

//     while ( !dirItem.done ) {

//         // Only send files that store IMU sensors samples (the ones that start with
//         // "trial") and prevent sending the one that is currently being written
//         if (SENSORS.filter(sensor => sensor.filename == dirItem.value).length || !/^trial/.test(dirItem.value) ) {
//             dirItem = listDir.next();
//             continue;
//         }
//         console.log(`trying to send file ${dirItem.value}: ${statSync(dirItem.value).size}`);
//         await outbox.enqueueFile(dirItem.value);
//         dirItem = listDir.next();
//     }

//     isSendingFiles = false;

// }, 5000); // Try to send files every 5 seconds

// /**
//  * 
//  * @param {String} filename: name of the file received from the phone (companion) whose content has to be read
//  * @returns {String}: the contents of the received file from the companion
//  */
// const readFile = (filename) => {

//     const fd = openSync(filename, "r");

//     // Each character in the file is stored using 2 bytes, so the buffer length to
//     // read the whole content must be half the number of bytes of the file to read
//     const buffer = new Uint16Array(parseInt(statSync(filename).size/2));
    
//     readSync(fd, buffer);
//     closeSync(fd);

//     return String.fromCharCode(...buffer); // parse bytes to characters
// }

// /**
//  * Callback for the event of file received.
//  * Read each received file form the phone (companion) and act accordingly.
//  */
// const processIncomingFiles = () => {
//     let filename;

//     while( filename = inbox.nextFile() ) {

//         const payload = readFile(filename);

//         // The companion found the IP of the host that stores the heart rate data:
//         if (filename == "host_ip") {
//             hostIp = payload;

//         // The companion has received a file with heart rate samples, so we can delete that file:
//         } else if ( filename == "delete_file" ) {
//             console.log(`received command to delete file ${payload}`);
//             // unlinkSync(payload)
//         }

//         // Delete the newly received file from companion:
//         // unlinkSync(filename);
//     }
// }

// // Set the callback for the event of file received from companion
// inbox.addEventListener("newfile", processIncomingFiles);
// processIncomingFiles(); // execute it already in case there is any file in queue