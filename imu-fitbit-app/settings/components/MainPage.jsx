import RecordButton from "./RecordButton";
import ReloadFilesButton from "./ReloadFilesButton";

const MainPage = (props, ...components) => (
    <Page>
        { RecordButton(props) }
        { ReloadFilesButton(props) }
        
        { components.map(component => component(props)) }
    </Page>
);

export default MainPage;