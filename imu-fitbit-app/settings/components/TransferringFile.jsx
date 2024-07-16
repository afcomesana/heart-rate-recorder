/**
 * The information presented in this component is updated in the companion.
 * Every time the companion changes one of the settings used here, this
 * component is re-rendered (strong suspicion that has to do with what is
 * explained here https://react.dev/learn/render-and-commit/ ).
 */

const TransferringFile = (filename, progress = 0, button = null) => (
    <Section title={<Text bold align="center">{ filename }</Text>}>
        <Text align="center">{ progress }% transferred</Text>
        { button }
    </Section>
);

export default TransferringFile;