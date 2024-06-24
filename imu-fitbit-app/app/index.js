import { outbox, inbox } from "file-transfer";
import * as document     from "document";
import Accelerometer     from "accelerometer";
import Gyroscope         from "gyroscope";
import { me }            from "appbit";
import { display }       from "display";

import {
    openSync,
    writeSync,
    closeSync,
    listDirSync,
    unlinkSync,
    readSync,
    statSync
} from "fs";

import { APP_DIRECTORY, SAMPLE_FREQUENCY, BATCH_SIZE, AXIS_NAMES } from "../common/constants";

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
        "sensor": new Accelerometer({frequency: SAMPLE_FREQUENCY, batch: BATCH_SIZE}),
        "fileDescriptor": null,
        "filename": null
    },
    {
        "filePrefix": "gyro",
        "sensor": new Gyroscope({frequency: SAMPLE_FREQUENCY, batch: BATCH_SIZE}),
        "fileDescriptor": null,
        "filename": null
    }
]

SENSORS.forEach(sensor => sensor.sensor.addEventListener("reading", () => readingCallback(sensor)));

/**
 * Create file for the given sensor and write batch readings in it.
 * @param {Object} sensor: One of the objects in the SENSORS array.
 */
const readingCallback = sensor => {
    if ( sensor.fileDescriptor == null ) {
        const date            = new Date();
        sensor.filename       = `trial_${sensor.filePrefix}_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
        sensor.fileDescriptor = openSync(sensor.filename, "w");
    }

    AXIS_NAMES.forEach(axisName => writeSync(sensor.fileDescriptor, sensor.sensor.readings[axisName]));
}

// Handle sensor activity and files according to user interaction and update user interface
manageRecordingButton.addEventListener("click", () => {

    // Sensors are already working: stop them and close the files where they were writing the samples
    if (isRecording) {

        SENSORS.forEach(sensor => {

            sensor.sensor.stop();
            closeSync(sensor.fileDescriptor);

            sensor.filename       = null;
            sensor.fileDescriptor = null;

        });

        manageRecordingText.text = "Start";

        isRecording = false;

    // Sensors are not working, start recording:
    } else {
        SENSORS.forEach(sensor => sensor.sensor.start());
        manageRecordingText.text = "Stop";

        isRecording = true;
    }

});

// Periodically try to send stored files with heart rate samples
setInterval(async () => {

    // Prevent this function to run multiple times at once or if the server that has
    // to receive the samples is not up or its address is not known.
    if ( isSendingFiles || !hostIp ) {
        return;
    }

    isSendingFiles = true;

    // Send files from smartwatch to phone:    
    const listDir = listDirSync(APP_DIRECTORY);
    let dirItem   = listDir.next();

    while ( !dirItem.done ) {

        // Only send files that store IMU sensors samples (the ones that start with
        // "trial") and prevent sending the one that is currently being written
        if (SENSORS.filter(sensor => sensor.filename == dirItem.value).length || !/^trial/.test(dirItem.value) ) {
            dirItem = listDir.next();
            continue;
        }

        await outbox.enqueueFile(dirItem.value);
        dirItem = listDir.next();
    }

    isSendingFiles = false;

}, 5000); // Try to send files every 5 seconds

/**
 * 
 * @param {String} filename: name of the file received from the phone (companion) whose content has to be read
 * @returns {String}: the contents of the received file from the companion
 */
const readFile = (filename) => {

    const fd = openSync(filename, "r");

    // Each character in the file is stored using 2 bytes, so the buffer length to
    // read the whole content must be half the number of bytes of the file to read
    const buffer = new Uint16Array(parseInt(statSync(filename).size/2));
    
    readSync(fd, buffer);
    closeSync(fd);

    return String.fromCharCode(...buffer); // parse bytes to characters
}

/**
 * Callback for the event of file received.
 * Read each received file form the phone (companion) and act accordingly.
 */
const processIncomingFiles = () => {
    let filename;

    while( filename = inbox.nextFile() ) {

        const payload = readFile(filename);

        // The companion found the IP of the host that stores the heart rate data:
        if (filename == "host_ip") {
            hostIp = payload;

        // The companion has received a file with heart rate samples, so we can delete that file:
        } else if ( filename == "delete_file" ) {
            unlinkSync(payload)
        }

        // Delete the newly received file from companion:
        unlinkSync(filename);
    }
}

// Set the callback for the event of file received from companion
inbox.addEventListener("newfile", processIncomingFiles);
processIncomingFiles(); // execute it already in case there is any file in queue