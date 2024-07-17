// This functions could not be included in the /common/functions.js file
// because that file imports the Messaging API which the settings don't
// have access to. So it would raise an error.

import { BATCH_COUNT_SETTINGS_NAME, BATCH_INDEX_SETTINGS_NAME, RECEIVED_BATCH_INDEX_SETTINGS_NAME } from "../common/constants";


/**
 * Calculate the progress of the transferring process of a file from the smartwatch
 * to the phone.
 * 
 * @param {Object} props : object with the data needed for react to render components
 * @returns {Int} percentage of progress of the file being transferred from the 
 * smartwatch to the phone
 */
export const computeProgress = props => {

    const batchIndex         = props.settings[BATCH_INDEX_SETTINGS_NAME];
    const receivedBatchIndex = props.settings[RECEIVED_BATCH_INDEX_SETTINGS_NAME];
    const batchCount         = props.settings[BATCH_COUNT_SETTINGS_NAME];

    if ( !batchIndex || !batchCount ) return [0, 0];

    // Percetage of the file already sent to the laptop
    let transferProgress,
        receivedProgress;

    transferProgress = parseInt((parseInt(batchIndex)  / parseInt(batchCount)) * 100);
    transferProgress = isNaN(transferProgress) ? 0 : transferProgress;

    receivedProgress = parseInt((parseInt(receivedBatchIndex)  / parseInt(batchCount)) * 100);
    receivedProgress = isNaN(receivedProgress) ? 0 : receivedProgress;

    return [transferProgress, receivedProgress];
}

/**
 * Takes any variable and return True or False. Prevent stringified values
 * to be parsed to true unlike the native operator "!!".
 * @param {any} value the thing whose Boolean value we want to know
 * @returns Boolean
 */
export const parseBoolean = value => {
    if ( value === "false" ) return false;
    if ( value === "null" ) return false;
    if ( value === "undefined" ) return false;
    if ( value === "0" ) return false;

    return !!value;
}