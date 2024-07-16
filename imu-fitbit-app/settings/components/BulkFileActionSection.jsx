import { ALL_FILES_ACTION_DELETE_VALUE, ALL_FILES_ACTION_NAME, ALL_FILES_ACTION_SEND_VALUE, HOST_IP_SETTINGS_NAME } from "../../common/constants";

const BulkFileActionSection = props => (
    <Section title={<Text bold align="center">Bulk actions</Text>}>
        {
            props.settings[HOST_IP_SETTINGS_NAME] ?
                <Button
                    label="Send all files"
                    onClick={() => {
                        props.settingsStorage.setItem(ALL_FILES_ACTION_NAME, ALL_FILES_ACTION_SEND_VALUE);
                    }}
                />
                : null
        }


        <Button
            label="Delete all files"
            onClick={() => {
                props.settingsStorage.setItem(ALL_FILES_ACTION_NAME, ALL_FILES_ACTION_DELETE_VALUE);
            }}
        />
    </Section>
);

export default BulkFileActionSection;