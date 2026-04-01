import { memo, useState, useEffect } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import { useAppStore } from '../store/useAppStore';
import { countryList } from '../data/countries';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface WorldMapProps {
  isDragging?: boolean;
  onDrop?: () => void;
}

export const WorldMap = memo(({ isDragging, onDrop }: WorldMapProps) => {
  const { currentMode, targetCountry, submitAnswer, mistakeCount, correctAnswerIds } = useAppStore();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const [geoData, setGeoData] = useState<any[]>([]);
  const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });
  const [isAutoPanning, setIsAutoPanning] = useState(false);

  useEffect(() => {
    let timer: number;
    if (targetCountry && geoData.length > 0) {
      const feature = geoData.find(g => g.properties.name === targetCountry.nameEN);
      if (feature && currentMode !== 'STUDY') {
        const centroid = geoCentroid(feature);
        setIsAutoPanning(true);
        setPosition({ coordinates: centroid as [number, number], zoom: 2.2 });
        timer = window.setTimeout(() => setIsAutoPanning(false), 1200);
      }
    } else if (!targetCountry) {
      setIsAutoPanning(true);
      setPosition({ coordinates: [0, 20] as [number, number], zoom: 1 });
      timer = window.setTimeout(() => setIsAutoPanning(false), 1200);
    }
    return () => clearTimeout(timer);
  }, [targetCountry, geoData, currentMode]);

  const handleCountryClick = (geo: any) => {
    const matched = countryList.find(c => c.nameEN === geo.properties.name);
    
    if (currentMode === 'PINPOINT') {
      if (!targetCountry || !matched) {
        submitAnswer('unknown');
        return;
      }
      submitAnswer(matched.id);
    }
  };

  const handleMouseUp = (geo: any) => {
    if (currentMode === 'DRAG_DROP' && isDragging) {
      if (onDrop) onDrop();
      const matched = countryList.find(c => c.nameEN === geo.properties.name);
      if (targetCountry && matched) {
        submitAnswer(matched.id);
      } else {
        submitAnswer('unknown');
      }
    }
  };

  const currentHover = countryList.find(c => c.nameEN === hoveredName);

  return (
    <div className="w-full h-full relative" style={{ background: '#060d18' }}>
      {/* Study mode tooltip */}
      {currentMode === 'STUDY' && currentHover && (
        <div 
          className="absolute top-4 left-4 z-10 glass-panel p-4 rounded-xl animate-fade-in"
          style={{ borderLeft: '3px solid var(--color-cyan-accent)' }}
        >
          <p className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-cyan-accent)' }}>
            {currentHover.nameKO}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>{currentHover.region}</p>
        </div>
      )}

      <ComposableMap 
        projection="geoMercator" 
        projectionConfig={{ scale: 120, rotate: [-150, 0, 0] }}
        style={{ width: '100%', height: '100%' }}
      >
        <ZoomableGroup 
          center={position.coordinates} 
          zoom={position.zoom} 
          maxZoom={20}
          onMoveStart={() => setIsAutoPanning(false)}
          onMoveEnd={(pos) => setPosition(pos)}
          style={{ transition: isAutoPanning ? "transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)" : "none" }}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }) => {
              if (geoData.length === 0 && geographies.length > 0) {
                setTimeout(() => setGeoData(geographies), 0);
              }
              return geographies.map((geo) => {
                const geoName = geo.properties.name;
                const matchedCountry = countryList.find(c => c.nameEN === geoName);
                
                const isTarget = targetCountry && matchedCountry && matchedCountry.id === targetCountry.id;
                const isFailed = isTarget && mistakeCount >= 3;
                const isCorrectlyAnswered = matchedCountry && correctAnswerIds.includes(matchedCountry.id);
                
                // High-contrast color system
                let fill = "#2a4a6b";       // land - clearly lighter than ocean
                if (!matchedCountry) fill = "#0c1a2e";  // unmapped territories
                
                // Correctly answered countries stay green
                if (isCorrectlyAnswered) {
                  fill = "#166534";  // dark green for answered
                }

                if (currentMode === 'PINPOINT') {
                  if (isFailed) fill = "#f87171";
                } else if (currentMode === 'MULTIPLE_CHOICE') {
                  if (isTarget) fill = "#22d3ee";
                }

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={() => setHoveredName(geoName)}
                    onMouseLeave={() => setHoveredName(null)}
                    onClick={() => handleCountryClick(geo)}
                    onMouseUp={() => handleMouseUp(geo)}
                    style={{
                      default: {
                        fill,
                        outline: "none",
                        stroke: "#1a3355",
                        strokeWidth: 0.8,
                        transition: 'all 250ms'
                      },
                      hover: {
                        fill: currentMode === 'STUDY' && matchedCountry ? "#22d3ee" : 
                             (currentMode === 'PINPOINT' ? "#f0a500" : 
                             (currentMode === 'DRAG_DROP' ? "#f0a500" : fill)),
                        outline: "none",
                        cursor: (currentMode === 'PINPOINT' || currentMode === 'STUDY' || currentMode === 'DRAG_DROP') ? "pointer" : "default"
                      },
                      pressed: {
                        fill: "#0891b2",
                        outline: "none",
                      },
                    }}
                  />
                );
              });
            }}
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
});
