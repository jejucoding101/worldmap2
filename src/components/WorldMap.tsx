import { memo, useState, useEffect, useMemo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
import { geoArea } from 'd3-geo';
import { useAppStore } from '../store/useAppStore';
import { countryList } from '../data/countries';

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// Countries that are large enough to always show labels at zoom >= 1
const LARGE_AREA_THRESHOLD = 0.005;   // ~Russia, Canada, USA, China, Brazil, Australia, India...
const MEDIUM_AREA_THRESHOLD = 0.001;  // ~Turkey, Spain, France, Germany, Japan...
const SMALL_AREA_THRESHOLD = 0.0003;  // ~Portugal, South Korea, Iceland...

export const WorldMap = memo(() => {
  const { currentMode, targetCountry, submitAnswer, mistakeCount, correctAnswerIds, feedback } = useAppStore();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const [geoData, setGeoData] = useState<any[]>([]);
  const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });
  const [isAutoPanning, setIsAutoPanning] = useState(false);

  useEffect(() => {
    let timer: number;
    if (targetCountry && geoData.length > 0) {
      const feature = geoData.find(g => g.properties.name === targetCountry.nameEN);
      if (feature && currentMode !== 'STUDY' && currentMode !== 'MAP') {
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

  const currentHover = countryList.find(c => c.nameEN === hoveredName);

  // Compute label data for MAP mode
  const labelData = useMemo(() => {
    if (geoData.length === 0) return [];
    return geoData
      .map(geo => {
        const matched = countryList.find(c => c.nameEN === geo.properties.name);
        if (!matched) return null;
        const centroid = geoCentroid(geo);
        const area = geoArea(geo);
        return { 
          id: matched.id,
          nameKO: matched.nameKO,
          nameEN: matched.nameEN,
          coordinates: centroid as [number, number],
          area
        };
      })
      .filter(Boolean) as { id: string; nameKO: string; nameEN: string; coordinates: [number, number]; area: number }[];
  }, [geoData]);

  // Determine which labels to show at current zoom
  const visibleLabels = useMemo(() => {
    const zoom = position.zoom;
    return labelData.filter(label => {
      if (label.area >= LARGE_AREA_THRESHOLD) return zoom >= 1;
      if (label.area >= MEDIUM_AREA_THRESHOLD) return zoom >= 1.5;
      if (label.area >= SMALL_AREA_THRESHOLD) return zoom >= 3;
      return zoom >= 5;
    });
  }, [labelData, position.zoom]);

  return (
    <div className="w-full h-full relative" style={{ background: '#060d18' }}>
      {/* Study/MAP mode tooltip */}
      {(currentMode === 'STUDY' || currentMode === 'MAP') && currentHover && (
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

      {/* Feedback overlay */}
      {feedback && (
        <div 
          className="absolute top-1/2 left-1/2 z-20 p-5 rounded-2xl animate-fade-in"
          style={{ 
            transform: 'translate(-50%, -50%)',
            background: feedback.type === 'correct' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)',
            backdropFilter: 'blur(8px)',
            border: `2px solid ${feedback.type === 'correct' ? '#34d399' : '#f87171'}`,
            textAlign: 'center',
            pointerEvents: 'none',
            minWidth: '180px',
          }}
        >
          <div style={{ fontSize: '2rem' }}>{feedback.type === 'correct' ? '✅' : '❌'}</div>
          <p className="text-xl font-bold mt-1" style={{ fontFamily: 'Outfit, sans-serif', color: 'white' }}>
            {feedback.countryName}
          </p>
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            {feedback.type === 'correct' ? '정답!' : '오답!'}
          </p>
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
                
                let fill = "#2a4a6b";
                if (!matchedCountry) fill = "#0c1a2e";
                
                if (isCorrectlyAnswered) {
                  fill = "#166534";
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
                    style={{
                      default: {
                        fill,
                        outline: "none",
                        stroke: "#1a3355",
                        strokeWidth: 0.8,
                        transition: 'all 250ms'
                      },
                      hover: {
                        fill: (currentMode === 'STUDY' || currentMode === 'MAP') && matchedCountry ? "#22d3ee" : 
                             (currentMode === 'PINPOINT' ? "#f0a500" : fill),
                        outline: "none",
                        cursor: (currentMode === 'PINPOINT' || currentMode === 'STUDY' || currentMode === 'MAP') ? "pointer" : "default"
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

          {/* MAP mode: country name labels */}
          {currentMode === 'MAP' && visibleLabels.map(label => {
            const fontSize = Math.max(2, 6 / position.zoom);
            return (
              <Marker key={label.id} coordinates={label.coordinates}>
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontFamily: 'Outfit, sans-serif',
                    fontSize: `${fontSize}px`,
                    fill: '#c8d8ec',
                    fontWeight: label.area >= MEDIUM_AREA_THRESHOLD ? 600 : 400,
                    pointerEvents: 'none',
                    textShadow: '0 0 3px rgba(0,0,0,0.8), 0 0 6px rgba(0,0,0,0.5)',
                    paintOrder: 'stroke',
                    stroke: '#060d18',
                    strokeWidth: `${Math.max(0.3, 1 / position.zoom)}px`,
                    strokeLinejoin: 'round',
                  }}
                >
                  {label.nameKO}
                </text>
              </Marker>
            );
          })}

          {/* Quiz modes: show names on correctly answered countries */}
          {(currentMode === 'PINPOINT' || currentMode === 'MULTIPLE_CHOICE') && labelData
            .filter(label => correctAnswerIds.includes(label.id))
            .map(label => {
              const fontSize = Math.max(2, 5 / position.zoom);
              return (
                <Marker key={`correct-${label.id}`} coordinates={label.coordinates}>
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontFamily: 'Outfit, sans-serif',
                      fontSize: `${fontSize}px`,
                      fill: '#34d399',
                      fontWeight: 600,
                      pointerEvents: 'none',
                      paintOrder: 'stroke',
                      stroke: '#060d18',
                      strokeWidth: `${Math.max(0.3, 1 / position.zoom)}px`,
                      strokeLinejoin: 'round',
                    }}
                  >
                    {label.nameKO}
                  </text>
                </Marker>
              );
            })}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
});
