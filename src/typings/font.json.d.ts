declare module "*.font.json" {
    export interface FontJSON {
        image: string;
        characterMapping: {
            char: string;
            width: number;
            compactablePrecursors: string[];
        }[];
        margin: number;
        colors: Record<string, string>;
    }

    const value: FontJSON;
    export default value;
}
