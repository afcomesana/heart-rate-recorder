import { ALL_FILES_ACTION_DELETE_VALUE, ALL_FILES_ACTION_NAME, DELETE_FILE_ACTION_NAME, DELETE_SINGLE_FILE_SETTINGS_NAME, DELETE_ALL_FILES_ACTION_VALUE } from "../../common/constants";

const ConfirmFileDeletion = (props, filename = null) => (
    <Page>
        <Text>
            Please, confirm that you want to delete {filename ? <Text>the file <Text italic>{filename}</Text></Text> : "all the files"} in the smartwatch.
        </Text>

        <Button
            label={`Delet${props.settings[DELETE_FILE_ACTION_NAME] === filename || props.settings[DELETE_FILE_ACTION_NAME] === DELETE_ALL_FILES_ACTION_VALUE ? "ing" : "e"}${filename ? '' : " all files"}`}
            onClick={() => props.settingsStorage.setItem(DELETE_FILE_ACTION_NAME, filename ? filename : DELETE_ALL_FILES_ACTION_VALUE)}
        />
        <Button
            label="Go back"
            onClick={() => {
                props.settingsStorage.removeItem(ALL_FILES_ACTION_NAME);
                props.settingsStorage.removeItem(DELETE_SINGLE_FILE_SETTINGS_NAME);
            }}
        />
    </Page>
);

export default ConfirmFileDeletion;