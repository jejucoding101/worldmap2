import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { WorldMap } from './components/WorldMap';

function App() {
  const state = useAppStore();
  
  // Timer Effect
  useEffect(() => {
    let interval: number;
    if (state.targetCountry && !state.isGameOver && state.currentMode !== 'STUDY') {
      interval = window.setInterval(() => {
        state.tickTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.targetCountry, state.isGameOver, state.currentMode]);

  // Drag State for Mode 4
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) setDragPos({ x: e.clientX, y: e.clientY });
    };
    const onMouseUp = () => {
      if (isDragging) setIsDragging(false);
    };
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="min-h-screen w-full flex flex-col p-6 space-y-4 relative select-none">
      <header className="flex justify-between items-center glass-panel p-4 rounded-2xl">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-blue-500">
          🌍 세계 지도 암기 앱
        </h1>
        <div className="flex gap-4">
          <div className="px-4 py-2 bg-slate-800 rounded-lg font-mono">Score: <span className="text-neon-yellow">{state.score}</span></div>
          {state.currentMode !== 'STUDY' && (
            <div className="px-4 py-2 bg-slate-800 rounded-lg font-mono">Time: <span className="text-neon-red">{state.timer}s</span></div>
          )}
        </div>
      </header>

      <div className="flex-1 flex gap-4 h-[calc(100vh-140px)]">
        {/* Sidebar */}
        <div className="w-[300px] glass-panel p-6 rounded-2xl flex flex-col overflow-y-auto">
          {state.currentMode === 'HOME' ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold mb-4 border-b border-slate-700 pb-2">지역 및 모드 선택</h2>
              
              <div className="mb-4">
                <label className="text-sm text-slate-400">대륙 필터</label>
                <select 
                  className="w-full mt-1 p-2 bg-slate-800 rounded outline-none"
                  value={state.selectedRegion}
                  onChange={(e) => state.setRegion(e.target.value as any)}
                >
                  <option value="All">전 세계 (150개국)</option>
                  <option value="Asia">아시아</option>
                  <option value="Europe">유럽</option>
                  <option value="Africa">아프리카</option>
                  <option value="Americas">아메리카</option>
                  <option value="Oceania">오세아니아</option>
                </select>
              </div>

              <div className="space-y-2">
                <button onClick={() => { state.setMode('PINPOINT'); state.startGame(); }} className="p-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg w-full text-left font-semibold">📍 1. 핀포인트 모드</button>
                <button onClick={() => { state.setMode('MULTIPLE_CHOICE'); state.startGame(); }} className="p-3 bg-teal-600 hover:bg-teal-500 rounded-lg w-full text-left font-semibold">📝 3. 객관식 모드</button>
                <button onClick={() => { state.setMode('DRAG_DROP'); state.startGame(); }} className="p-3 bg-orange-600 hover:bg-orange-500 rounded-lg w-full text-left font-semibold">🧩 4. 드래그 앤 드롭</button>
                <button onClick={() => { state.setMode('STUDY'); state.startGame(); }} className="p-3 bg-slate-600 hover:bg-slate-500 rounded-lg w-full text-left font-semibold">🔍 5. 학습 탐험 모드</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <h2 className="text-lg font-bold text-slate-300 border-b border-slate-700 pb-2">
                {state.currentMode === 'PINPOINT' && '📍 핀포인트'}
                {state.currentMode === 'MULTIPLE_CHOICE' && '📝 객관식'}
                {state.currentMode === 'DRAG_DROP' && '🧩 드래그 앤 드롭'}
                {state.currentMode === 'STUDY' && '🔍 탐험 모드'}
              </h2>
              
              {state.isGameOver ? (
                <div className="flex-1 mt-8 text-center space-y-4">
                  <h3 className="text-2xl font-bold text-neon-green">학습 완료!</h3>
                  <p>총 점수: {state.score}</p>
                  <p>소요 시간: {state.timer}초</p>
                  {state.wrongAnswers.length > 0 && (
                     <div className="text-left mt-4 text-sm text-red-400 bg-red-900/20 p-3 rounded">
                       <p className="font-bold mb-1">오답 노트:</p>
                       <ul className="list-disc pl-4 h-32 overflow-y-auto">
                         {state.wrongAnswers.map(wa => <li key={wa.id}>{wa.nameKO}</li>)}
                       </ul>
                     </div>
                  )}
                </div>
              ) : state.targetCountry ? (
                <div className="flex-1 flex flex-col mt-4">
                  {state.currentMode !== 'STUDY' && (
                    <div className="p-4 bg-slate-800/80 rounded-xl text-center border border-slate-600">
                      <p className="text-sm text-slate-400 mb-2">다음 나라를 찾으세요:</p>
                      
                      {/* Mode 4: Draggable Block */}
                      {state.currentMode === 'DRAG_DROP' ? (
                         <div 
                           onMouseDown={(e) => { setIsDragging(true); setDragPos({ x: e.clientX, y: e.clientY }); }}
                           className="p-3 bg-indigo-500 rounded text-xl font-bold cursor-grab active:cursor-grabbing hover:bg-indigo-400"
                         >
                           {state.targetCountry.nameKO}
                           <div className="text-xs text-indigo-200 mt-1">(지도로 끌어다 놓으세요)</div>
                         </div>
                      ) : (
                         <p className="text-3xl font-extrabold text-white animate-pulse">{state.targetCountry.nameKO}</p>
                      )}
                    </div>
                  )}

                  {/* Mode 3: Choices */}
                  {state.currentMode === 'MULTIPLE_CHOICE' && (
                    <div className="mt-4 flex flex-col gap-2">
                       <p className="text-sm text-slate-400">지도에 하이라이트된 나라를 고르세요.</p>
                       {state.choices.map(c => (
                         <button 
                           key={c.id} 
                           onClick={() => state.submitAnswer(c.id)}
                           className="p-3 border border-slate-600 rounded bg-slate-700/50 hover:bg-slate-600 text-left transition-colors"
                         >
                           {c.nameKO}
                         </button>
                       ))}
                    </div>
                  )}

                  {/* Mode 5: Study info UI */}
                  {state.currentMode === 'STUDY' && (
                     <div className="text-slate-400 text-sm leading-relaxed mt-4">
                       자유롭게 세계 지도를 탐험하세요. <br/><br/>지도 상의 나라 위에 마우스를 구석구석 돌려보면 팝업 툴팁으로 나라 정보가 나타납니다.
                     </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 mt-4 text-slate-500 text-center">선택된 국가가 없습니다.</div>
              )}
              
              <div className="mt-auto pt-6 space-y-2">
                {state.mistakeCount > 0 && !state.isGameOver && <p className="text-red-500 text-sm font-bold text-center">오답 횟수: {state.mistakeCount} / 3</p>}
                <button 
                  onClick={() => state.endGame()} 
                  className="p-3 border border-slate-500 text-slate-300 hover:bg-slate-700/80 hover:text-white rounded-lg w-full font-bold transition-colors"
                >
                  ⬅ 홈(메뉴)으로 돌아가기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 rounded-2xl overflow-hidden glass-panel relative">
           <WorldMap isDragging={isDragging} onDrop={() => setIsDragging(false)} />
        </div>
      </div>

      {/* Drag element overlay */}
      {isDragging && state.targetCountry && (
        <div 
          className="fixed pointer-events-none p-4 rounded-xl bg-indigo-500 shadow-2xl z-50 transform -translate-x-1/2 -translate-y-1/2 text-2xl font-bold border-2 border-white"
          style={{ left: dragPos.x, top: dragPos.y }}
        >
          {state.targetCountry.nameKO}
        </div>
      )}
    </div>
  );
}

export default App;
