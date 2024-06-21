import { outbox, inbox } from "file-transfer";
import * as document     from "document";
import Accelerometer     from "accelerometer";
import Gyroscope         from "gyroscope";
import { me }            from "appbit";

import {
    openSync,
    writeSync,
    closeSync,
    listDirSync,
    unlinkSync,
    readSync,
    statSync
} from "fs";

import { APP_DIRECTORY, SAMPLE_FREQUENCY, BATCH_SIZE } from "../common/constants";

let accFilename        = null,
    accFileDescriptor  = null,
    gyroFilename       = null,
    gyroFileDescriptor = null,
    isSendingFiles     = false,
    hostIp             = "";

me.appTimeoutEnabled = false;

// Get smartwatch screen elements
const manageRecordingButton = document.getElementById("manage-recording-button");
const manageRecordingText   = document.getElementById("manage-recording-text");

console.log(statSync("trial_acc_2024-6-20_16-24-44").size)

// Accelerometer:
const accelerometer = new Accelerometer({frequency: SAMPLE_FREQUENCY, batch: BATCH_SIZE});
accelerometer.addEventListener("reading", () => {
    
    if ( !accFileDescriptor ) {
        const date        = new Date();
        accFilename       = `trial_acc_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
        accFileDescriptor = openSync(accFilename, "w");
    }

    writeSync(accFileDescriptor, accelerometer.readings.x);
    writeSync(accFileDescriptor, accelerometer.readings.y);
    writeSync(accFileDescriptor, accelerometer.readings.z);
});

// Gyroscope:
const gyroscope = new Gyroscope({frequency: SAMPLE_FREQUENCY, batch: BATCH_SIZE});
gyroscope.addEventListener("reading", () => {
    
    if ( !gyroFileDescriptor ) {
        const date        = new Date();
        gyroFilename       = `trial_gyro_${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`;
        gyroFileDescriptor = openSync(gyroFilename, "w");
    }

    writeSync(accFileDescriptor, gyroscope.readings.x);
    writeSync(accFileDescriptor, gyroscope.readings.y);
    writeSync(accFileDescriptor, gyroscope.readings.z);
});

// Handle sensor activity and files according to user interaction and update user interface
manageRecordingButton.addEventListener("click", () => {

    // Sensor is already working: stop it and close the file where it was writing the samples
    if (accelerometer.activated) {
        accelerometer.stop();
        gyroscope.stop();

        closeSync(accFileDescriptor);
        closeSync(gyroFileDescriptor);

        manageRecordingText.text = "Start";
        accFileDescriptor = accFilename = gyroFileDescriptor = gyroFilename = null;

    // Sensor is not working: start it and open file to store the heart rate samples with an informative filename (trial_YYYY-MM-DD_HH-mm-ss)
    } else {
        accelerometer.start();
        gyroscope.start();
    
        manageRecordingText.text = "Stop";
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

        console.log(`evaluating ${dirItem.value} to send ${!/^trial/.test(dirItem.value)}`)

        // Only send files that store heart rate samples (the ones that start with
        // "trial") and prevent sending the one that is currently being written
        if (dirItem.value == accFilename || dirItem.value == gyroFilename || !/^trial/.test(dirItem.value) ) {
            dirItem = listDir.next();
            continue;
        }

        console.log(`about to send file ${dirItem.value}`);

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