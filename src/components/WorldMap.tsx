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
  const { currentMode, targetCountry, submitAnswer, mistakeCount } = useAppStore();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const [geoData, setGeoData] = useState<any[]>([]);
  const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });
  const [isAutoPanning, setIsAutoPanning] = useState(false);

  // 다음 문제가 시작될 때 해당 나라 근처로 부드럽게 화면을 이동(Zoom & Pan)
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
    <div className="w-full h-full relative group bg-blue-900/10">
      {currentMode === 'STUDY' && currentHover && (
        <div className="absolute top-4 left-4 z-10 glass-panel p-4 rounded-xl shadow-lg border-2 border-neon-green">
          <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-600">
            {currentHover.nameKO}
          </p>
          <p className="text-slate-400 mt-1">{currentHover.region}</p>
        </div>
      )}

      <ComposableMap 
        projection="geoMercator" 
        projectionConfig={{ scale: 120, rotate: [-150, 0, 0] }}
      >
        <ZoomableGroup 
          center={position.coordinates} 
          zoom={position.zoom} 
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
                
                let fill = "#1e293b"; 
                if (!matchedCountry) fill = "#0f172a"; 

                if (currentMode === 'PINPOINT') {
                  if (isFailed) fill = "#ef4444"; 
                } else if (currentMode === 'MULTIPLE_CHOICE') {
                  if (isTarget) fill = "#3b82f6"; 
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
                        stroke: "#334155",
                        strokeWidth: 0.5,
                        transition: 'all 250ms'
                      },
                      hover: {
                        fill: currentMode === 'STUDY' && matchedCountry ? "#39ff14" : 
                             (currentMode === 'PINPOINT' ? "#3b82f6" : fill),
                        outline: "none",
                        cursor: (currentMode === 'PINPOINT' || currentMode === 'STUDY') ? "pointer" : "default"
                      },
                      pressed: {
                        fill: "#2563eb",
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
