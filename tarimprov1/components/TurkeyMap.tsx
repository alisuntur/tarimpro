import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3-geo';
import * as topojson from 'topojson-client';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import mapData from '../data/turkey-map.json';

interface TurkeyMapProps {
    onCitySelect: (cityName: string) => void;
    selectedCity: string | null;
    className?: string;
}

const TurkeyMap: React.FC<TurkeyMapProps> = ({ onCitySelect, selectedCity, className }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [hoveredCity, setHoveredCity] = useState<string | null>(null);
    const [geoData, setGeoData] = useState<any[]>([]);

    useEffect(() => {
        // Parse TopoJSON data
        // The object key in the downloaded file is "default" based on previous inspection
        const featureCollection = topojson.feature(mapData as any, mapData.objects.default as any);
        setGeoData((featureCollection as any).features);
    }, []);

    // Projection setup
    // Turkey's approximate coordinates: 26-45 E, 36-42 N
    // We can use a Mercator projection centered on Turkey
    const projection = d3.geoMercator()
        .center([35, 39]) // Center of Turkey
        .scale(2000)      // Adjust scale to fit
        .translate([400, 200]); // Translate to center of SVG (assuming 800x400 viewBox)

    const pathGenerator = d3.geoPath().projection(projection);

    return (
        <div className={twMerge("relative w-full h-full flex items-center justify-center", className)}>
            <svg
                ref={svgRef}
                viewBox="0 0 800 400"
                className="w-full h-full max-w-[800px]"
                style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))' }}
            >
                <g>
                    {geoData.map((feature, index) => {
                        const cityName = feature.properties.name;
                        const isSelected = selectedCity === cityName;
                        const isHovered = hoveredCity === cityName;

                        return (
                            <path
                                key={index}
                                d={pathGenerator(feature) || ''}
                                className={clsx(
                                    "cursor-pointer transition-all duration-300 ease-in-out stroke-white stroke-[0.5]",
                                    isSelected
                                        ? "fill-emerald-500 hover:fill-emerald-600"
                                        : isHovered
                                            ? "fill-emerald-300"
                                            : "fill-slate-200"
                                )}
                                onMouseEnter={() => setHoveredCity(cityName)}
                                onMouseLeave={() => setHoveredCity(null)}
                                onClick={() => onCitySelect(cityName)}
                            >
                                <title>{cityName}</title>
                            </path>
                        );
                    })}
                </g>
            </svg>

            {/* Optional: Floating label for hovered city if not using simple title attribute */}
            {hoveredCity && (
                <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded shadow text-sm font-medium text-slate-700 pointer-events-none">
                    {hoveredCity}
                </div>
            )}
        </div>
    );
};

export default TurkeyMap;
