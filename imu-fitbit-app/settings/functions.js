// This functions could not be included in the /common/functions.js file
// because that file imports the Messaging API which the settings don't
// have access to. So it would raise an error.


/**
 * Calculate the progress of the transferring process of a file from the smartwatch
 * to the phone.
 * 
 * @param {Object} props : object with the data needed for react to render components
 * @returns {Int} percentage of progress of the file being transferred from the 
 * smartwatch to the phone
 */
export const computeProgress = props => {

    const { batchIndex, batchCount } = props.settings;

    if ( !batchIndex || !batchCount ) return 0;

    // Percetage of the file already sent to the laptop
    let progress;
    progress = parseInt(((parseInt(batchIndex) + 1)  / parseInt(batchCount)) * 100);

    if ( isNaN(progress) ) {
        progress = 0;
    }

    return progress;
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