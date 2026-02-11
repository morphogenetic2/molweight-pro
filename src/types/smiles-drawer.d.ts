declare module "smiles-drawer" {
    type SmilesTree = Record<string, unknown>;
    type SmilesOptions = Record<string, unknown>;

    interface SvgWrapperLike {
        toCanvas: (canvas: HTMLCanvasElement, width: number, height: number) => void;
    }

    interface SvgDrawerLike {
        draw: (
            data: SmilesTree,
            target: SVGElement | null,
            themeName?: string,
            weights?: number[] | null,
            infoOnly?: boolean
        ) => SVGElement;
        svgWrapper?: SvgWrapperLike;
    }

    export default class SmilesDrawer {
        static Drawer: new (options?: SmilesOptions) => unknown;
        static SvgDrawer: new (options?: SmilesOptions) => SvgDrawerLike;
        static parse: (
            smiles: string,
            successCallback: (tree: SmilesTree) => void,
            errorCallback?: (err: unknown) => void
        ) => void;
        static clean: (smiles: string) => string;
        static apply: (
            options: SmilesOptions,
            selector: string,
            themeName: string,
            onError?: (err: unknown) => void
        ) => void;
    }
}
