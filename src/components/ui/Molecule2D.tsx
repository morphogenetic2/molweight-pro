"use client";

import { useEffect, useRef, useState } from "react";
import SmilesDrawer from "smiles-drawer";
import { Loader2, AlertCircle } from "lucide-react";
import { useStore } from "@/store/useStore";

interface Molecule2DProps {
    smiles: string;
    width?: number;
    height?: number;
    forceExplicitHydrogens?: boolean;
}

/**
 * Molecule2D Component
 * 
 * Renders a 2D molecular structure locally from a SMILES string using smiles-drawer.
 * Providing local rendering instead of fetching static images from PubChem.
 * 
 * @component
 */
export default function Molecule2D({ 
    smiles, 
    width = 400, 
    height = 400,
    forceExplicitHydrogens = false,
}: Molecule2DProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const panStartRef = useRef<{ startX: number; startY: number } | null>(null);
    const zoomRef = useRef(1);
    const panOffsetRef = useRef({ x: 0, y: 0 });
    const { moleculeSettings, theme } = useStore();
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const renderWidth = Math.min(400, width);
    const renderHeight = Math.min(400, height);
    const atomVisualization =
        moleculeSettings.atomVisualization === "none" || moleculeSettings.atomVisualization === "balls"
            ? moleculeSettings.atomVisualization
            : "default";

    const minZoom = 0.5;
    const maxZoom = 4;

    useEffect(() => {
        zoomRef.current = zoom;
    }, [zoom]);

    useEffect(() => {
        panOffsetRef.current = panOffset;
    }, [panOffset]);

    useEffect(() => {
        if (!isPanning) {
            return;
        }

        const handleMouseMove = (event: MouseEvent) => {
            const isMiddlePressed = (event.buttons & 4) === 4;
            if (!isMiddlePressed || !panStartRef.current) {
                setIsPanning(false);
                panStartRef.current = null;
                return;
            }

            const nextPan = {
                x: event.clientX - panStartRef.current.startX,
                y: event.clientY - panStartRef.current.startY,
            };
            panOffsetRef.current = nextPan;
            setPanOffset(nextPan);
        };

        const handleMouseUp = (event: MouseEvent) => {
            if (event.button === 1) {
                setIsPanning(false);
                panStartRef.current = null;
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isPanning]);

    const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
        event.preventDefault();

        if (!viewportRef.current) {
            return;
        }

        const rect = viewportRef.current.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;
        const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
        const prevZoom = zoomRef.current;
        const prevPan = panOffsetRef.current;
        const nextZoom = Math.min(maxZoom, Math.max(minZoom, prevZoom * zoomFactor));
        if (nextZoom === prevZoom) {
            return;
        }

        // The canvas is centered by flex layout before transforms.
        const baseOffsetX = (rect.width - renderWidth) / 2;
        const baseOffsetY = (rect.height - renderHeight) / 2;

        // Keep the point under the cursor stable while zooming.
        const worldX = (cursorX - baseOffsetX - prevPan.x) / prevZoom;
        const worldY = (cursorY - baseOffsetY - prevPan.y) / prevZoom;
        const nextPan = {
            x: cursorX - baseOffsetX - worldX * nextZoom,
            y: cursorY - baseOffsetY - worldY * nextZoom,
        };

        zoomRef.current = nextZoom;
        panOffsetRef.current = nextPan;
        setZoom(nextZoom);
        setPanOffset(nextPan);
    };

    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.button !== 1) {
            return;
        }

        event.preventDefault();
        const pan = panOffsetRef.current;
        panStartRef.current = {
            startX: event.clientX - pan.x,
            startY: event.clientY - pan.y,
        };
        setIsPanning(true);
    };

    useEffect(() => {
        if (!smiles || !canvasRef.current) {
            return;
        }

        let isCancelled = false;
        const canvas = canvasRef.current;
        canvas.width = renderWidth;
        canvas.height = renderHeight;

        const renderMolecule = () => {
            setLoading(true);
            setError(null);

            try {
                // Initialize SmilesDrawer with user settings and custom premium theme
                const options = {
                    width: renderWidth,
                    height: renderHeight,
                    bondThickness: moleculeSettings.bondThickness,
                    bondLength: moleculeSettings.bondLength,
                    shortBondLength: moleculeSettings.shortBondLength,
                    bondSpacing: moleculeSettings.bondSpacing,
                    atomVisualization,
                    isomeric: false,
                    terminalCarbons: moleculeSettings.terminalCarbons,
                    explicitHydrogens: moleculeSettings.explicitHydrogens || forceExplicitHydrogens,
                    overlapSensitivity: moleculeSettings.overlapSensitivity,
                    overlapResolutionIterations: 2,
                    compactDrawing: false,
                    fontSizeLarge: moleculeSettings.fontSizeLarge,
                    fontSizeSmall: moleculeSettings.fontSizeSmall,
                    padding: moleculeSettings.padding,
                    debug: false,
                };

                // Use SvgDrawer directly: Drawer.draw() in smiles-drawer@2.1.7 shifts args
                // internally and can leave svgWrapper null.
                const drawer = new SmilesDrawer.SvgDrawer(options);

                // Parse and draw
                SmilesDrawer.parse(smiles, (tree) => {
                    if (isCancelled || !canvasRef.current) {
                        return;
                    }

                    const drawToCanvas = (themeName: string) => {
                        drawer.draw(tree, null, themeName, null, false);
                        if (!drawer.svgWrapper || !canvasRef.current) {
                            throw new Error("Canvas renderer is not available.");
                        }
                        drawer.svgWrapper.toCanvas(canvasRef.current, renderWidth, renderHeight);
                    };

                    // Use built-in standard themes from smiles-drawer.
                    const activeTheme = theme === 'dark' ? 'dark' : 'light';
                    try {
                        drawToCanvas(activeTheme);
                    } catch (e) {
                        console.error("Draw failed with selected theme, retrying with oldschool", e);
                        drawToCanvas('oldschool');
                    }

                    if (!isCancelled) {
                        setLoading(false);
                    }
                }, (err) => {
                    if (isCancelled) {
                        return;
                    }
                    console.error("SmilesDrawer parse error:", err);
                    setError("Could not parse molecular structure.");
                    setLoading(false);
                });

            } catch (err) {
                if (isCancelled) {
                    return;
                }
                console.error("SmilesDrawer error:", err);
                setError("Failed to render molecular structure.");
                setLoading(false);
            }
        };

        renderMolecule();

        return () => {
            isCancelled = true;
        };
    }, [smiles, renderWidth, renderHeight, theme, moleculeSettings, atomVisualization, forceExplicitHydrogens]);

    return (
        <div className="relative w-full h-full flex items-center justify-center min-h-[300px]">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-10">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
                </div>
            )}
            
            {error ? (
                <div className="flex flex-col items-center gap-2 text-zinc-500 italic text-sm text-center px-4">
                    <AlertCircle className="h-8 w-8 text-zinc-600 mb-2" />
                    <p>{error}</p>
                </div>
            ) : (
                <div
                    ref={viewportRef}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onAuxClick={(event) => {
                        if (event.button === 1) {
                            event.preventDefault();
                        }
                    }}
                    className={`w-full h-full overflow-hidden flex items-center justify-center select-none ${
                        isPanning ? "cursor-grabbing" : "cursor-default"
                    }`}
                >
                    <div
                        style={{
                            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                            transformOrigin: "top left",
                        }}
                    >
                        <canvas 
                            ref={canvasRef} 
                            width={renderWidth}
                            height={renderHeight}
                            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${loading ? 'opacity-0' : 'opacity-100'}`}
                            style={{
                                width: `${renderWidth}px`,
                                height: `${renderHeight}px`,
                                maxWidth: "100%",
                                maxHeight: "100%",
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
