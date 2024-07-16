
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

import { APP_DIRECTORY, SAMPLE_FREQUENCY, AXIS_NAMES, SAMPLES_PER_BATCH, BYTES_PER_BATCH, LIST_FILES_ACTION_NAME, SEND_FILE_ACTION_NAME, DELETE_FILE_ACTION_NAME, RECORD_COMMAND_SETTINGS_NAME, IS_RECORDING_SETTINGS_NAME, FILE_LISTED_ACTION_NAME, FILE_LIST_COMPLETED_ACTION_NAME, FILE_DELETED_ACTION_NAME, DELETE_ALL_FILES_ACTION_VALUE, START_RECORD_ACTION_VALUE, STOP_RECORD_ACTION_VALUE } from "../common/constants";
import { sleep, readMessage, sendCommand } from "../common/functions";

String.prototype.toArrayBuffer = function() {
    const bufferedString = new Uint16Array(this.length);

    for(let charIndex = 0; charIndex < this.length; charIndex++) {
        bufferedString[charIndex] = this.charCodeAt(charIndex);
    }

    return bufferedString;
}

me.appTimeoutEnabled = false;
const manageRecordingText = document.getElementById("manage-recording-text");

// Keep screen always on:
setInterval(() => display.poke(), 1000);

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
];

/**
 * Create file for the given sensor and write batch readings in it.
 * @param {Object} sensor: One of the objects in the SENSORS array.
 */
const readingCallback = sensor => {
    if ( sensor.fileDescriptor == null ) {
        const date            = new Date();
        const timestamp       = new Date().getTime(); // Add Unix timestamp in milliseconds
        sensor.filename       = `trial_${sensor.filePrefix}_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}-${timestamp}`;
        sensor.fileDescriptor = openSync(sensor.filename, "w");
    }

    AXIS_NAMES.forEach(axisName => writeSync(sensor.fileDescriptor, sensor.sensor.readings[axisName]));
};

const stopSensors = () => {
    console.log("stopping sensors");

    SENSORS.forEach(sensor => {

        sensor.sensor.stop();
        closeSync(sensor.fileDescriptor);

        sensor.filename       = null;
        sensor.fileDescriptor = null;

    });

    manageRecordingText.text = "IDLE";
}

const startSensors = () => {
    console.log("starting sensors");
    SENSORS.forEach(sensor => sensor.sensor.start());
    manageRecordingText.text = "RECORDING";
}

SENSORS.forEach(sensor => sensor.sensor.addEventListener("reading", () => readingCallback(sensor)));

messaging.peerSocket.addEventListener("message", async event => {

    /**
     * Messages to the smartwatch will always be commands, so we extract only
     * the "message" part of the result of the readMessage function, which is 
     * an object action (to execute) and payload (to execute the action upon)
     */
    const { message: { action, payload } } = readMessage(event.data);

    switch(action) {
        case LIST_FILES_ACTION_NAME:
            sendFilesListToCompanion();
            break;

        case SEND_FILE_ACTION_NAME:
            sendFileToCompanion(payload);
            break;

        case DELETE_FILE_ACTION_NAME:
            deleteFiles(payload);
            break;

        case RECORD_COMMAND_SETTINGS_NAME:

            if ( payload === START_RECORD_ACTION_VALUE ) {
                startSensors();
                sendCommand(IS_RECORDING_SETTINGS_NAME, true);

            } else if (payload === STOP_RECORD_ACTION_VALUE ) {
                stopSensors();
                sendCommand(IS_RECORDING_SETTINGS_NAME, false);
            }

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
        sendCommand(FILE_LISTED_ACTION_NAME, dirItem.value);
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
    sendCommand(FILE_LIST_COMPLETED_ACTION_NAME);
}

const deleteFiles = filename => {

    // Delete all the files:
    if (filename === DELETE_ALL_FILES_ACTION_VALUE) {

        const listDir = listDirSync(APP_DIRECTORY);
        let dirItem   = listDir.next();

        while ( !dirItem.done ) {
            try {
                unlinkSync(dirItem.value);
            } finally {
                dirItem = listDir.next();
            }
        }

        sendCommand(FILE_DELETED_ACTION_NAME, filename);
        return;
    }

    // Delete only one file:
    try {
        unlinkSync(filename);
    } finally{
        sendCommand(FILE_DELETED_ACTION_NAME, filename);
    }
}


async function sendFileToCompanion(filename) {
    
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
    }

    catch(error) {
        console.log(`Could not read file: ${error}`);

    } finally {
        closeSync(fileDescriptor);
    }

}