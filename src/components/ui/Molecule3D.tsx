"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

interface Molecule3DProps {
    cid: number;
}

type ViewerStyleSpec = {
    stick?: {
        radius?: number;
        colorscheme?: string;
    };
    sphere?: {
        scale?: number;
    };
};

interface ThreeDmolViewer {
    clear: () => void;
    setBackgroundColor: (hex: number, alpha?: number) => void;
    addModel: (model: string, format: string) => void;
    setStyle: (selector: Record<string, unknown>, style: ViewerStyleSpec) => void;
    zoomTo: () => void;
    render: () => void;
    animate: (options: { loop?: string; step?: number }) => void;
}

interface ThreeDmolGlobal {
    createViewer: (element: HTMLElement) => ThreeDmolViewer;
}

declare global {
    interface Window {
        $3Dmol?: ThreeDmolGlobal;
    }
}

export default function Molecule3D({ cid }: Molecule3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<ThreeDmolViewer | null>(null);
    const [loading, setLoading] = useState(true);
    const [libLoaded, setLibLoaded] = useState(false);

    // Load 3Dmol.js script
    useEffect(() => {
        if (window.$3Dmol) {
            setLibLoaded(true);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://3Dmol.org/build/3Dmol-min.js";
        script.async = true;
        script.onload = () => setLibLoaded(true);
        document.head.appendChild(script);

        return () => {
            // Clean up not strictly necessary for CDN script but good practice
        };
    }, []);

    // Initialize and render molecule
    useEffect(() => {
        if (!libLoaded || !containerRef.current || !cid) return;

        const initViewer = async () => {
            setLoading(true);
            try {
                // Fetch SDF from PubChem
                const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`);
                if (!response.ok) throw new Error("Failed to fetch 3D data");
                const sdf = await response.text();

                // Clear previous viewer if any
                if (viewerRef.current) {
                    viewerRef.current.clear();
                } else {
                    if (!window.$3Dmol) {
                        throw new Error("3Dmol library is not available.");
                    }
                    viewerRef.current = window.$3Dmol.createViewer(containerRef.current);
                }

                const v = viewerRef.current;
                v.setBackgroundColor(0x000000, 0); // Set transparent background
                v.addModel(sdf, "sdf");
                v.setStyle({}, { stick: { radius: 0.15, colorscheme: "Jmol" }, sphere: { scale: 0.25 } });
                v.zoomTo();
                v.render();
                v.animate({ loop: "backward", step: 0.1 }); // Subtle rotation

            } catch (err) {
                console.error("3Dmol error:", err);
            } finally {
                setLoading(false);
            }
        };

        initViewer();

        return () => {
            if (viewerRef.current) {
                viewerRef.current.clear();
            }
        };
    }, [cid, libLoaded]);

    return (
        <div className="w-full h-full relative min-h-[300px] rounded-xl overflow-hidden bg-black/10 border border-white/5 backdrop-blur-sm">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                </div>
            )}
            <div ref={containerRef} className="w-full h-full min-h-[300px]" />
        </div>
    );
}
