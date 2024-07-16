import { ASK_FOR_SINGLE_FILE_SETTINGS_NAME, DELETE_SINGLE_FILE_SETTINGS_NAME, FILES_LIST_SETTINGS_NAME, HOST_IP_SETTINGS_NAME } from "../../common/constants";

const SingleFileActionSection = props => (
    <Section title={<Text bold align="center">Single file actions</Text>}>
        <Select
            label="Select a file to send"
            selectViewTitle="Select a file to send"
            disabled={!props.settings[HOST_IP_SETTINGS_NAME]}
            settingsKey={ ASK_FOR_SINGLE_FILE_SETTINGS_NAME}
            options={props.settings[FILES_LIST_SETTINGS_NAME].split(",").map(filename => new Object({name: filename}))}
        />

        <Select
            label="Select a file to delete"
            selectViewTitle="Select a file to delete"
            settingsKey={ DELETE_SINGLE_FILE_SETTINGS_NAME }
            options={props.settings[FILES_LIST_SETTINGS_NAME].split(",").map(filename => new Object({name: filename}))}
        />
    </Section>
);

export default SingleFileActionSection;