declare module "@uiw/react-codemirror" {
  import type { ComponentType } from "react";

  export type CodeMirrorProps = {
    value?: string;
    height?: string;
    className?: string;
    extensions?: readonly unknown[];
    onChange?: (value: string) => void;
  };

  const CodeMirror: ComponentType<CodeMirrorProps>;
  export default CodeMirror;
}
