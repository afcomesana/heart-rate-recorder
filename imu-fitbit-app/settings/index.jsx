// https://dev.fitbit.com/build/guides/settings/
// https://dev.fitbit.com/build/reference/settings-api/#components

const TransferringFile = (filename, progress = 0, button = null) => (
    <Section title={<Text bold align="center">{ filename }</Text>}>
        <Text align="center">{ progress }% transferred</Text>
        { button }
    </Section>
);

const DeviceFiles = props => {
    
    if (!!props.settings.singleFileToAskFor) {

        const { singleFileToAskFor, batchIndex, batchCount } = props.settings;

        const filename = JSON.parse(singleFileToAskFor).values[0].name;

        // Percetage of the file already sent to the laptop
        let progress;
        progress = parseInt(((parseInt(batchIndex) + 1)  / parseInt(batchCount)) * 100);

        if ( isNaN(progress) ) {
            progress = 0;
        }

        // Button that may be shown to go back to the "main page"
        let flushFileTransferDataButton;

        if ( progress === 100 ) {
            flushFileTransferDataButton = <Button
                label="OK"
                onClick={() => {
                    props.settingsStorage.removeItem("singleFileToAskFor");
                    props.settingsStorage.removeItem("batchIndex");
                    props.settingsStorage.removeItem("batchCount");
                }}
            />
        }

        return  (
            <Page>
                { TransferringFile(filename, progress, flushFileTransferDataButton) }
            </Page>
        )
    
    } else if ( !!props.settings.allFilesAction ) {

        if ( props.settings.allFilesAction == "send" ) {

            let { fileBeingTransferred, nextFilesToBeTransferred } = props.settings;

            
            let filesToBeTransferredList;
            if ( nextFilesToBeTransferred ) {
                filesToBeTransferredList = nextFilesToBeTransferred.split(",").map(filename => <Text align="center">{filename}</Text>);
            }

            return (
                <Page>
                    { TransferringFile(fileBeingTransferred) }
                    <Section title={<Text align="center">Next files to be transferred</Text>}>
                        { filesToBeTransferredList }
                    </Section>
                </Page>
            )

        } else if ( props.settings.allFilesAction == "delete" ) {

        } else {
            // WHAT
        }

        
    }

    return (
        <Page>
            <Button
                label="Reload files"
                onClick={() => {
                    props.settingsStorage.setItem("allFilesAction", "reload");
                }}
            />

            <Section title={<Text bold align="center">Single file actions</Text>}>
                <Select
                    label="Select a file to send"
                    settingsKey="singleFileToAskFor"
                    options={props.settings.files.split(",").map(filename => new Object({name: filename}))}
                />

                <Select
                    label="Select a file to delete"
                    settingsKey="filesToDelete"
                    options={props.settings.files.split(",").map(filename => new Object({name: filename}))}
                />
            </Section>

            <Section title={<Text bold align="center">Bulk actions</Text>}>
                <Button
                    label="Send all files"
                    onClick={() => {
                        props.settingsStorage.setItem("allFilesAction", "send");
                    }}
                />

                <Button
                    label="Delete all files"
                    onClick={() => {
                        props.settingsStorage.setItem("allFilesAction", "delete");
                    }}
                />
            </Section>
        </Page>
    );
}

registerSettingsPage(DeviceFiles);