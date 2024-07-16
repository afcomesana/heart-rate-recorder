import { ALL_FILES_ACTION_NAME, ALL_FILES_ACTION_RELOAD_VALUE, FILES_LIST_SETTINGS_NAME } from "../../common/constants";

const ReloadFilesButton = (props) => <Button
    label={ props.settings[ALL_FILES_ACTION_NAME] === ALL_FILES_ACTION_RELOAD_VALUE ? "Loading files" : "Reload files"}
    onClick={() => {
        props.settingsStorage.removeItem(FILES_LIST_SETTINGS_NAME, null);
        props.settingsStorage.setItem(ALL_FILES_ACTION_NAME, ALL_FILES_ACTION_RELOAD_VALUE);
    }}
/>;

export default ReloadFilesButton;