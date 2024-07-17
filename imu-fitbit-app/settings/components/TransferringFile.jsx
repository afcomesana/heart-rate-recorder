/**
 * The information presented in this component is updated in the companion.
 * Every time the companion changes one of the settings used here, this
 * component is re-rendered (strong suspicion that has to do with what is
 * explained here https://react.dev/learn/render-and-commit/ ).
 */

import {
    FILE_BEING_TRANSFERRED_SETTINGS_NAME,
    FILE_TRANSFER_QUEUE_SETTINGS_NAME,
    ASK_FOR_SINGLE_FILE_SETTINGS_NAME,
    BATCH_INDEX_SETTINGS_NAME,
    BATCH_COUNT_SETTINGS_NAME,
    SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME,
    RETRY_SEND_FILE_SETTINGS_NAME,
    ALL_FILES_ACTION_NAME,
    ALL_FILES_ACTION_SEND_VALUE
} from "../../common/constants";
import { computeProgress, parseBoolean } from "../functions";

const SETTINGS_INVOLVED = [
    FILE_BEING_TRANSFERRED_SETTINGS_NAME,
    FILE_TRANSFER_QUEUE_SETTINGS_NAME,
    ASK_FOR_SINGLE_FILE_SETTINGS_NAME,
    BATCH_INDEX_SETTINGS_NAME,
    BATCH_COUNT_SETTINGS_NAME,
    SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME,
    RETRY_SEND_FILE_SETTINGS_NAME,
    ALL_FILES_ACTION_NAME,
]

const TransferringFile = (props) => {

    const [transferProgress, receivedProgress] = computeProgress(props);

    if ( props.settings[ALL_FILES_ACTION_NAME] === ALL_FILES_ACTION_SEND_VALUE && !props.settings[FILE_BEING_TRANSFERRED_SETTINGS_NAME]) {
        return <Text>Starting queue...</Text>;
    }

    // If the first thing is null, then the one from the line below
    const filename = props.settings[FILE_BEING_TRANSFERRED_SETTINGS_NAME] ??
                     JSON.parse(props.settings[ASK_FOR_SINGLE_FILE_SETTINGS_NAME]).values[0].name;

    let fileTransferQueue = props.settings[FILE_TRANSFER_QUEUE_SETTINGS_NAME]
        // If the thing exists:
        ?.trim()
        .split(",")
        .filter(filename => !!filename) // remove empty strings, otherwise OK button won't render
        .map(filename => <Text align="center">{filename}</Text>);


    
    if (!!fileTransferQueue) {
        fileTransferQueue[0];
        console.log(Object.keys(fileTransferQueue));
    }

    console.log(`${!!fileTransferQueue} - ${receivedProgress}`);
    const flushFileTransferDataButton = !fileTransferQueue && receivedProgress === 100 ? 
        <Button
            label="OK"
            onClick={() => SETTINGS_INVOLVED.forEach(settingsName => props.settingsStorage.removeItem(settingsName))}
        />
        : null;

    const retrySendFileButton = parseBoolean(props.settings[SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME]) ?
        <Button
        label="Retry?"
        onClick={() => {
            props.settingsStorage.setItem(RETRY_SEND_FILE_SETTINGS_NAME, "true");
            props.settingsStorage.removeItem(BATCH_INDEX_SETTINGS_NAME);
            props.settingsStorage.removeItem(BATCH_COUNT_SETTINGS_NAME);
            props.settingsStorage.removeItem(SUGGEST_RETRY_SEND_FILE_SETTINGS_NAME);
        }} />
        : null;

    return (
        <Page>
            <Section title={<Text bold align="center">{ filename }</Text>}>
                <Text>{ transferProgress }% transferred from smartwatch</Text>
                <Text>{ receivedProgress }% received in laptop</Text>
                { flushFileTransferDataButton ?? retrySendFileButton }
            </Section>
            <Section title={<Text align="center">Next files to be transferred</Text>}>
                { fileTransferQueue }
            </Section>
        </Page>
    );
}

export default TransferringFile;