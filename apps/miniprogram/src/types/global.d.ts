/// <reference types="@tarojs/taro" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare namespace JSX {
  interface ElementClass {
    render(): any;
  }
  interface ElementAttributesProperty {
    props: {};
  }
  interface ElementChildrenAttribute {
    children: {};
  }
}
