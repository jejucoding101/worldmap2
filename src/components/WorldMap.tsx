import { memo, useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  const { currentMode, targetCountry, submitAnswer, mistakeCount, correctAnswerIds, feedback, hintCountryIds, useHint } = useAppStore();
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  // STUDY 모드: 최근 본 나라 이름 페이드아웃 (5초)
  const FADE_DURATION = 5000;
  const [recentLabels, setRecentLabels] = useState<{ nameEN: string; addedAt: number }[]>([]);
  const fadeTimerRef = useRef<number | null>(null);

  // hoveredName이 바뀔 때 recentLabels 갱신
  useEffect(() => {
    if (currentMode !== 'STUDY') return;
    if (hoveredName) {
      setRecentLabels(prev => {
        const filtered = prev.filter(r => r.nameEN !== hoveredName);
        return [...filtered, { nameEN: hoveredName, addedAt: Date.now() }];
      });
    }
  }, [hoveredName, currentMode]);

  // 만료된 라벨 정리 타이머
  useEffect(() => {
    if (currentMode !== 'STUDY' || recentLabels.length === 0) return;
    const tick = () => {
      const now = Date.now();
      setRecentLabels(prev => prev.filter(r => r.nameEN === hoveredName || now - r.addedAt < FADE_DURATION));
    };
    fadeTimerRef.current = window.setInterval(tick, 200);
    return () => { if (fadeTimerRef.current) clearInterval(fadeTimerRef.current); };
  }, [currentMode, recentLabels.length > 0, hoveredName]);

  // 모드 변경 시 리셋
  useEffect(() => {
    if (currentMode !== 'STUDY') setRecentLabels([]);
  }, [currentMode]);

  const getRecentOpacity = useCallback((nameEN: string) => {
    if (nameEN === hoveredName) return 1;
    const entry = recentLabels.find(r => r.nameEN === nameEN);
    if (!entry) return 0;
    const elapsed = Date.now() - entry.addedAt;
    return Math.max(0, 1 - elapsed / FADE_DURATION);
  }, [recentLabels, hoveredName]);

  const [geoData, setGeoData] = useState<any[]>([]);
  const [position, setPosition] = useState({ coordinates: [0, 20] as [number, number], zoom: 1 });
  const [isAutoPanning, setIsAutoPanning] = useState(false);

  // Touch & Mouse drag detection: window-level to bypass SVG event interception
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDragRef = useRef(false);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      let clientX, clientY;
      if ('touches' in e) {
        if (e.touches.length > 1) { isDragRef.current = true; return; }
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }
      pointerStartRef.current = { x: clientX, y: clientY };
      isDragRef.current = false;
    };
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if ('touches' in e && e.touches.length > 1) {
        isDragRef.current = true;
        return;
      }
      if (!pointerStartRef.current) return;
      
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        if (e.buttons === 0) return;
        clientX = e.clientX;
        clientY = e.clientY;
      }
      const dx = clientX - pointerStartRef.current.x;
      const dy = clientY - pointerStartRef.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        isDragRef.current = true;
      }
    };
    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onPointerDown);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, []);

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
    // Skip click if it was a touch drag
    if (isDragRef.current) return;

    const geoName = geo.properties.name;
    const matched = countryList.find(c => c.nameEN === geoName);

    // In STUDY/MAP mode, tap to show tooltip
    if (currentMode === 'STUDY' || currentMode === 'MAP') {
      setHoveredName(geoName);
      return;
    }

    if (currentMode === 'PINPOINT') {
      if (!targetCountry || !matched) {
        submitAnswer('unknown');
        return;
      }
      submitAnswer(matched.id);
    }
  };

  const currentHover = countryList.find(c => c.nameEN === hoveredName);

  // Manual coordinate overrides for countries with overseas territories
  const LABEL_OVERRIDES: Record<string, [number, number]> = {
    'France': [2.5, 46.5],
    'United States of America': [-98, 39],
    'Russia': [90, 62],
    'Netherlands': [5.3, 52.2],
    'Denmark': [9.5, 56],
    'Norway': [10, 62],
    'New Zealand': [174, -41],
    'Chile': [-71, -35],
    'Indonesia': [118, -2],
    'Malaysia': [109, 4],
    'Japan': [138, 36],
    'United Kingdom': [-2, 54],
    'Portugal': [-8, 39.5],
    'Spain': [-3.5, 40],
    'Ecuador': [-78, -1.5],
  };

  // Compute label data for MAP mode
  const labelData = useMemo(() => {
    if (geoData.length === 0) return [];
    return geoData
      .map(geo => {
        const matched = countryList.find(c => c.nameEN === geo.properties.name);
        if (!matched) return null;
        const centroid = geoCentroid(geo);
        const area = geoArea(geo);
        const overridden = LABEL_OVERRIDES[matched.nameEN];
        let [lng, lat] = (overridden || centroid) as [number, number];
        
        // Wrap lng to match D3's geoMercator rotated boundaries [-30, 330] for visual alignment
        while (lng < -30) lng += 360;
        while (lng > 330) lng -= 360;

        return { 
          id: matched.id,
          nameKO: matched.nameKO,
          nameEN: matched.nameEN,
          coordinates: [lng, lat] as [number, number],
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
      {/* MAP mode tooltip (top-left, MAP only) */}
      {currentMode === 'MAP' && currentHover && (
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

      {/* Hint button */}
      {currentMode === 'PINPOINT' && targetCountry && !feedback && (
        <button
          onClick={useHint}
          className="absolute top-4 right-4 z-10 glass-panel px-4 py-2 rounded-xl animate-fade-in"
          style={{ 
            cursor: hintCountryIds.length > 0 ? 'default' : 'pointer',
            opacity: hintCountryIds.length > 0 ? 0.5 : 1,
            border: '1px solid var(--color-amber-accent)',
            color: 'var(--color-amber-accent)',
            fontFamily: 'Outfit, sans-serif',
            fontWeight: 600,
            fontSize: '0.85rem',
          }}
          disabled={hintCountryIds.length > 0}
        >
          💡 힌트
        </button>
      )}

      {/* Feedback overlay */}
      {feedback && (() => {
        const bgColor = feedback.type === 'correct' ? 'rgba(16, 185, 129, 0.9)' 
          : feedback.type === 'reveal' ? 'rgba(240, 165, 0, 0.9)' 
          : 'rgba(239, 68, 68, 0.9)';
        const borderColor = feedback.type === 'correct' ? '#34d399' 
          : feedback.type === 'reveal' ? '#f0a500' 
          : '#f87171';
        const emoji = feedback.type === 'correct' ? '✅' 
          : feedback.type === 'reveal' ? '📍' 
          : '❌';
        const label = feedback.type === 'correct' ? '정답!' 
          : feedback.type === 'reveal' ? '정답은 여기!' 
          : '오답!';

        return (
          <div 
            className="absolute top-4 left-1/2 z-20 px-5 py-3 rounded-xl animate-fade-in flex items-center gap-3"
            style={{ 
              transform: 'translateX(-50%)',
              background: bgColor,
              backdropFilter: 'blur(8px)',
              border: `1px solid ${borderColor}`,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{emoji}</span>
            <span className="font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: 'white', fontSize: '0.95rem' }}>
              {feedback.countryName}
            </span>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {label}
            </span>
          </div>
        );
      })()}

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
          onMoveEnd={(pos) => {
            // Wrap longitude to keep center copy visible
            let [lng, lat] = pos.coordinates;
            while (lng > 180) lng -= 360;
            while (lng < -180) lng += 360;
            setPosition({ ...pos, coordinates: [lng, lat] as [number, number] });
          }}
          style={{ transition: isAutoPanning ? "transform 1.2s cubic-bezier(0.25, 1, 0.5, 1)" : "none" }}
        >
          {/* 3-copy seamless wrapping */}
          {[-1, 0, 1].map(offset => (
            <g key={offset} transform={`translate(${offset * 2 * Math.PI * 120}, 0)`}>
              <Geographies geography={geoUrl}>
                {({ geographies }) => {
                  if (offset === 0 && geoData.length === 0 && geographies.length > 0) {
                    setTimeout(() => setGeoData(geographies), 0);
                  }
                  return geographies.map((geo) => {
                    const geoName = geo.properties.name;
                    const matchedCountry = countryList.find(c => c.nameEN === geoName);
                    
                    const isTarget = targetCountry && matchedCountry && matchedCountry.id === targetCountry.id;
                    const isFailed = isTarget && mistakeCount >= 3;
                    const isCorrectlyAnswered = matchedCountry && correctAnswerIds.includes(matchedCountry.id);
                    const isHinted = matchedCountry && hintCountryIds.includes(matchedCountry.id);
                    
                    let fill = "#2a4a6b";
                    if (!matchedCountry) fill = "#0c1a2e";
                    
                    if (isCorrectlyAnswered) {
                      fill = "#166534";
                    }

                    if (isHinted && !isCorrectlyAnswered) {
                      fill = "#1e3a5f";
                    }

                    if (currentMode === 'PINPOINT') {
                      if (isFailed) fill = "#f87171";
                      if (isTarget && feedback?.type === 'reveal') fill = "#f0a500";
                    } else if (currentMode === 'MULTIPLE_CHOICE') {
                      if (isTarget) fill = "#22d3ee";
                    }

                    if ((currentMode === 'STUDY' || currentMode === 'MAP') && hoveredName === geoName && matchedCountry) {
                      fill = "#22d3ee";
                    }

                    const stroke = (currentMode === 'STUDY' || currentMode === 'MAP') && hoveredName === geoName && matchedCountry ? "#67e8f9" : "#1a3355";
                    const strokeWidth = (currentMode === 'STUDY' || currentMode === 'MAP') && hoveredName === geoName && matchedCountry ? 1.5 : 0.8;

                    return (
                      <Geography
                        key={`${geo.rsmKey}-${offset}`}
                        geography={geo}
                        onClick={() => handleCountryClick(geo)}
                        style={{
                          default: {
                            fill,
                            outline: "none",
                            stroke,
                            strokeWidth,
                            transition: 'all 250ms'
                          },
                          hover: {
                            fill, // Same as default, disables hover jump
                            outline: "none",
                            stroke,
                            strokeWidth,
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
            </g>
          ))}

          {/* MAP mode: country name labels — 3-copy */}
          {currentMode === 'MAP' && [-1, 0, 1].map(offset => (
            <g key={`labels-${offset}`} transform={`translate(${offset * 2 * Math.PI * 120}, 0)`}>
              {[...visibleLabels]
                .sort((a, b) => {
                  if (a.nameEN === hoveredName) return 1;
                  if (b.nameEN === hoveredName) return -1;
                  return 0;
                })
                .map(label => {
                const fontSize = Math.max(2, 6 / position.zoom);
                const isLabelHovered = hoveredName === label.nameEN;
                return (
                  <Marker key={`${label.id}-${offset}`} coordinates={label.coordinates}>
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      style={{
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: isLabelHovered ? `${fontSize * 1.3}px` : `${fontSize}px`,
                        fill: isLabelHovered ? '#22d3ee' : '#c8d8ec',
                        fontWeight: isLabelHovered ? 700 : (label.area >= MEDIUM_AREA_THRESHOLD ? 600 : 400),
                        pointerEvents: 'none',
                        paintOrder: 'stroke',
                        stroke: '#060d18',
                        strokeWidth: isLabelHovered ? `${Math.max(0.5, 2 / position.zoom)}px` : `${Math.max(0.3, 1 / position.zoom)}px`,
                        strokeLinejoin: 'round',
                        transition: 'all 200ms',
                      }}
                    >
                      {label.nameKO}
                    </text>
                  </Marker>
                );
              })}
            </g>
          ))}

          {/* STUDY mode: show hovered + recently seen country names with fade-out */}
          {currentMode === 'STUDY' && recentLabels.length > 0 && [-1, 0, 1].map(offset => (
            <g key={`study-label-${offset}`} transform={`translate(${offset * 2 * Math.PI * 120}, 0)`}>
              {labelData
                .filter(label => recentLabels.some(r => r.nameEN === label.nameEN))
                .map(label => {
                  const fontSize = Math.max(3, 8 / position.zoom);
                  const opacity = getRecentOpacity(label.nameEN);
                  const isActive = label.nameEN === hoveredName;
                  return (
                    <Marker key={`study-${label.id}-${offset}`} coordinates={label.coordinates}>
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{
                          fontFamily: 'Outfit, sans-serif',
                          fontSize: `${fontSize}px`,
                          fill: isActive ? '#22d3ee' : '#67e8f9',
                          fontWeight: isActive ? 700 : 500,
                          opacity,
                          pointerEvents: 'none',
                          paintOrder: 'stroke',
                          stroke: '#060d18',
                          strokeWidth: `${Math.max(0.5, 2 / position.zoom)}px`,
                          strokeLinejoin: 'round',
                          transition: 'opacity 300ms ease-out, fill 150ms, font-weight 150ms',
                        }}
                      >
                        {label.nameKO}
                      </text>
                    </Marker>
                  );
                })}
            </g>
          ))}

          {/* Quiz modes: show names on correctly answered countries — 3-copy */}
          {(currentMode === 'PINPOINT' || currentMode === 'MULTIPLE_CHOICE') && [-1, 0, 1].map(offset => (
            <g key={`correct-labels-${offset}`} transform={`translate(${offset * 2 * Math.PI * 120}, 0)`}>
              {labelData
                .filter(label => correctAnswerIds.includes(label.id))
                .map(label => {
                  const fontSize = Math.max(2, 5 / position.zoom);
                  return (
                    <Marker key={`correct-${label.id}-${offset}`} coordinates={label.coordinates}>
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
            </g>
          ))}
        </ZoomableGroup>
      </ComposableMap>
    </div>
  );
});
