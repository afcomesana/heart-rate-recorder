import { IS_RECORDING_SETTINGS_NAME, RECORD_COMMAND_SETTINGS_NAME, START_RECORD_ACTION_VALUE, STOP_RECORD_ACTION_VALUE } from "../../common/constants";
import { parseBoolean } from "../functions";

const RecordButton = (props) => {
    /**
     * 4 possible labels:
     * 1. Start record: not recording
     * 2. Starting: command sent but not yet received confirmation
     * 3. Stop record: is recording and can be stopped
     * 4. Stopping: still recording but command to stop already sent
     */

    let isRecording   = parseBoolean(props.settings[IS_RECORDING_SETTINGS_NAME]),
        recordCommand = props.settings[RECORD_COMMAND_SETTINGS_NAME],
        label,
        callback;

    // 1. Start record: not recording
    if ( !isRecording && !recordCommand ) {
        label    = "Start record";
        callback = () => {
            props.settingsStorage.setItem(RECORD_COMMAND_SETTINGS_NAME, START_RECORD_ACTION_VALUE);
        };

    // 2. Starting: command sent but not yet received confirmation
    } else if ( !isRecording && recordCommand === START_RECORD_ACTION_VALUE ) {
        label    = "Starting";
        callback = null;

    // 3. Stop record: is recording and can be stopped
    } else if ( isRecording && !recordCommand ) {
        label = "Stop recording";
        callback = () => {
            props.settingsStorage.setItem(RECORD_COMMAND_SETTINGS_NAME, STOP_RECORD_ACTION_VALUE);
        };

    // 4. Stopping: still recording but command to stop already sent
    } else if ( isRecording && recordCommand === STOP_RECORD_ACTION_VALUE ) {
        label = "Stopping";
        callback = null;
    } else {
        console.log(`${isRecording} - ${recordCommand}`);
    }

    return <Button label={label} onClick={callback}/>;
}

export default RecordButton;