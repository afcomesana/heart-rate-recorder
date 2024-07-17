// https://dev.fitbit.com/build/guides/settings/
// https://dev.fitbit.com/build/reference/settings-api/#components

// Convenient to be familiar with React: https://react.dev/learn

import BulkFileActionSection   from "./components/BulkFileActionSection";
import ConfirmFileDeletion     from "./components/ConfirmFileDeletion";
import MainPage                from "./components/MainPage";
import SingleFileActionSection from "./components/SingleFileActionSection";
import TransferringFile        from "./components/TransferringFile";
import { computeProgress, parseBoolean }     from "./functions";

import {
    ALL_FILES_ACTION_DELETE_VALUE,
    ALL_FILES_ACTION_NAME,
    ALL_FILES_ACTION_RELOAD_VALUE,
    ALL_FILES_ACTION_SEND_VALUE,
    ASK_FOR_SINGLE_FILE_SETTINGS_NAME,
    BATCH_COUNT_SETTINGS_NAME,
    BATCH_INDEX_SETTINGS_NAME,
    DELETE_SINGLE_FILE_SETTINGS_NAME,
    FILES_LIST_SETTINGS_NAME,
    FILE_BEING_TRANSFERRED_SETTINGS_NAME,
    FILE_TRANSFER_QUEUE_SETTINGS_NAME,
    HOST_IP_SETTINGS_NAME,
    RETRY_SEND_FILE_SETTINGS_NAME,
    SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME
} from "../common/constants";

const HandleDeviceFiles = props => {
    /**
     * There are no files in the smartwatch, or they are not listed yet.
     * Cannot perform any action on the files, so we only show the reload
     * files button, which is always present in the MainPage component.
     */
    if (!props.settings[FILES_LIST_SETTINGS_NAME] || props.settings[FILES_LIST_SETTINGS_NAME].split(",").length == 0) {
        return MainPage(props);
    }

    if (!!props.settings[ASK_FOR_SINGLE_FILE_SETTINGS_NAME] || props.settings[ALL_FILES_ACTION_NAME] === ALL_FILES_ACTION_SEND_VALUE ) {
        return TransferringFile(props);
    }

    /**
     * A file has been requested in the files-to-send files selector.
     * Show information on how is the process going (percentage
     * transferred).
    //  */
    // if (!!props.settings[ASK_FOR_SINGLE_FILE_SETTINGS_NAME]) {

    //     const filename = JSON.parse(props.settings[ASK_FOR_SINGLE_FILE_SETTINGS_NAME]).values[0].name;
    //     const [transferProgress, receivedProgress] = computeProgress(props);

    //     /**
    //      * Button to go back to the MainPage. This button only
    //      * appears when the file has been completely transferred.
    //      */
    //     const flushFileTransferDataButton = receivedProgress === 100 ?
    //         <Button
    //             label="OK"
    //             onClick={() => {
    //                 /**
    //                  * Clear all the settings that have something to do
    //                  * with the process of transferring a file so that
    //                  * the Main Page is shown again.
    //                  */
    //                 props.settingsStorage.removeItem(ASK_FOR_SINGLE_FILE_SETTINGS_NAME);
    //                 props.settingsStorage.removeItem(BATCH_INDEX_SETTINGS_NAME);
    //                 props.settingsStorage.removeItem(BATCH_COUNT_SETTINGS_NAME);
    //             }}
    //         />
    //         : null;

    //     const retrySendFileButton = parseBoolean(props.settings[SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME]) ?
    //         <Button
    //             label="Retry?"
    //             onClick={() => {
    //                 /**
    //                  * Clear all the settings that have something to do
    //                  * with the process of transferring a file so that
    //                  * the Main Page is shown again.
    //                  */
    //                 props.settingsStorage.setItem(RETRY_SEND_FILE_SETTINGS_NAME, "true");
    //                 props.settingsStorage.removeItem(BATCH_INDEX_SETTINGS_NAME);
    //                 props.settingsStorage.removeItem(BATCH_COUNT_SETTINGS_NAME);
    //                 props.settingsStorage.removeItem(SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME);
    //             }}
    //         />
    //         : null;

    //     /**
    //      * Render how is the file transfer going. With or without the button
    //      * to go back to the MainPage.
    //      */
    //     return  (
    //         <Page>
    //             { TransferringFile(filename, transferProgress, receivedProgress, flushFileTransferDataButton ?? retrySendFileButton) }
    //         </Page>
    //     );
    // } 
    
    /**
     * User has selected a file to be deleted. To prevent accidental
     * file deletions, render the deletion confirmation component.
     */
    if ( !!props.settings[DELETE_SINGLE_FILE_SETTINGS_NAME] ) {
        return ConfirmFileDeletion(props, JSON.parse(props.settings[DELETE_SINGLE_FILE_SETTINGS_NAME]).values[0].name);
    }
    
    /**
     * User has requested to send all of the files in the smartwatch.
     * Current file being transferred and upcoming files to transfer
     * are updated in the companion. Then this component is re-rendered
     * with the new values for those variables.
     */
    // if ( props.settings[ALL_FILES_ACTION_NAME] === ALL_FILES_ACTION_SEND_VALUE ) {

    //     const [transferProgress, receivedProgress] = computeProgress(props);

    //     let fileBeingTransferred = props.settings[FILE_BEING_TRANSFERRED_SETTINGS_NAME],
    //         fileTransferQueue    = props.settings[FILE_TRANSFER_QUEUE_SETTINGS_NAME];

    //     // If the queue has some file names:
    //     fileTransferQueue = fileTransferQueue ?
    //         // Convert those filenames to components that can be rendered
    //         fileTransferQueue.split(",").map(filename => <Text align="center">{filename}</Text>)
    //         // Otherwise, nothing will be rendered
    //         : null;

    //     /**
    //      * Button to go back to the MainPage. This button only
    //      * appears when the last file has been completely transferred.
    //      */
    //     const flushFileTransferDataButton = (receivedProgress === 100 && !fileTransferQueue) ?
    //         <Button
    //             label="OK"
    //             onClick={() => {
    //                 /**
    //                  * Clear all the settings that have something to do
    //                  * with the process of transferring a file so that
    //                  * the Main Page is shown again.
    //                  */
    //                 props.settingsStorage.removeItem(FILE_BEING_TRANSFERRED_SETTINGS_NAME);
    //                 props.settingsStorage.removeItem(FILE_TRANSFER_QUEUE_SETTINGS_NAME);
    //                 props.settingsStorage.removeItem(ALL_FILES_ACTION_NAME);
    //                 props.settingsStorage.removeItem(BATCH_INDEX_SETTINGS_NAME);
    //                 props.settingsStorage.removeItem(BATCH_COUNT_SETTINGS_NAME);
    //             }}
    //         />
    //         : null;

    //     return (
    //         <Page>
    //             { TransferringFile(fileBeingTransferred, transferProgress, receivedProgress, flushFileTransferDataButton) }
    //             <Section title={<Text align="center">Next files to be transferred</Text>}>
    //                 { fileTransferQueue }
    //             </Section>
    //         </Page>
    //     );
    // }

    /**
     * User has requested to delete all the files in the smartwatch.
     * As with the single file deletion request, just show the deletion
     * confirmation component.
     */
    if ( props.settings[ALL_FILES_ACTION_NAME] === ALL_FILES_ACTION_DELETE_VALUE ) {
        return ConfirmFileDeletion(props);
    }

    if ( props.settings[ALL_FILES_ACTION_NAME] === ALL_FILES_ACTION_RELOAD_VALUE ) {
        return MainPage(props);
    }

    return MainPage(props, SingleFileActionSection, BulkFileActionSection);
}

registerSettingsPage(HandleDeviceFiles);