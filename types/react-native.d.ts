// Web-only project: react-native is an unused transitive peer of
// react-native-enriched-html. Its global type declarations clash with DOM/Node
// typings, so it is mapped to this stub via tsconfig paths.
declare module "react-native" {
  export type ViewProps = Record<string, unknown>;
  export type ColorValue = string;
  export type NativeMethods = Record<string, unknown>;
  export type NativeSyntheticEvent<T> = { nativeEvent: T };
  export type StyleProp<T> = T | T[] | null | undefined;
  export type ViewStyle = Record<string, unknown>;
  export type TextStyle = Record<string, unknown>;
}
