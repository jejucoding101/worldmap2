import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { WorldMap } from './components/WorldMap';

function App() {
  const state = useAppStore();
  
  // Timer Effect
  useEffect(() => {
    let interval: number;
    if (state.targetCountry && !state.isGameOver && state.currentMode !== 'STUDY' && state.currentMode !== 'MAP') {
      interval = window.setInterval(() => {
        state.tickTimer();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.targetCountry, state.isGameOver, state.currentMode]);

  const isGameActive = state.currentMode !== 'HOME';

  return (
    <div className="app-layout min-h-screen w-full flex flex-col p-4 gap-4 relative select-none">
      {/* ─── Header ─── */}
      <header className="app-header flex justify-between items-center glass-panel px-5 py-3 rounded-2xl">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-cyan-accent)' }}>
          🌍 세계지도 퀴즈
        </h1>
        <div className="flex gap-2">
          <div className="stat-badge">
            점수 <span style={{ color: 'var(--color-amber-accent)' }}>{state.score}</span>
          </div>
          {state.currentMode !== 'STUDY' && state.currentMode !== 'MAP' && state.currentMode !== 'HOME' && (
            <div className="stat-badge">
              <span style={{ color: 'var(--color-danger)' }}>{state.timer}s</span>
            </div>
          )}
        </div>
      </header>

      {/* ─── Content ─── */}
      <div className="app-content flex-1 flex gap-4" style={{ height: 'calc(100vh - 90px)' }}>
        {/* Sidebar */}
        <div className={`sidebar w-[280px] glass-panel p-5 rounded-2xl flex flex-col overflow-y-auto ${isGameActive ? 'game-active' : ''}`}>
          {state.currentMode === 'HOME' ? (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-lg font-bold pb-3" style={{ fontFamily: 'Outfit, sans-serif', borderBottom: '1px solid var(--color-border-subtle)' }}>
                게임 모드
              </h2>
              
              <div className="mb-3">
                <label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  대륙 필터
                </label>
                <select 
                  className="region-select mt-2"
                  value={state.selectedRegion}
                  onChange={(e) => state.setRegion(e.target.value as any)}
                >
                  <option value="All">전 세계 (160개국)</option>
                  <option value="Asia">아시아</option>
                  <option value="Europe">유럽</option>
                  <option value="Africa">아프리카</option>
                  <option value="Americas">아메리카</option>
                  <option value="Oceania">오세아니아</option>
                </select>
              </div>

              <div className="space-y-2">
                <button onClick={() => { state.setMode('PINPOINT'); state.startGame(); }} className="mode-btn pinpoint">
                  📍 핀포인트 모드
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>지도에서 해당 나라를 클릭</div>
                </button>
                <button onClick={() => { state.setMode('MULTIPLE_CHOICE'); state.startGame(); }} className="mode-btn multiple">
                  📝 객관식 모드
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>하이라이트된 나라 이름 선택</div>
                </button>
                <button onClick={() => { state.setMode('STUDY'); state.startGame(); }} className="mode-btn study">
                  🔍 학습 탐험 모드
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>자유롭게 지도 탐험</div>
                </button>
                <button onClick={() => { state.setMode('MAP'); state.startGame(); }} className="mode-btn study">
                  🗺️ 지도 모드
                  <div className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>나라 이름이 표시된 세계지도</div>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-fade-in">
              <h2 className="text-base font-bold pb-2" style={{ fontFamily: 'Outfit, sans-serif', borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-text-muted)' }}>
                {state.currentMode === 'PINPOINT' && '📍 핀포인트'}
                {state.currentMode === 'MULTIPLE_CHOICE' && '📝 객관식'}
                {state.currentMode === 'STUDY' && '🔍 탐험 모드'}
                {state.currentMode === 'MAP' && '🗺️ 지도 모드'}
              </h2>
              
              {state.isGameOver ? (
                <div className="flex-1 mt-6 text-center space-y-3">
                  <h3 className="text-2xl font-bold" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-success)' }}>
                    학습 완료!
                  </h3>
                  <p style={{ color: 'var(--color-text-muted)' }}>총 점수: <strong style={{ color: 'var(--color-amber-accent)' }}>{state.score}</strong></p>
                  <p style={{ color: 'var(--color-text-muted)' }}>소요 시간: <strong>{state.timer}초</strong></p>
                  {state.wrongAnswers.length > 0 && (
                     <div className="text-left mt-4 text-sm p-3 rounded-xl" style={{ background: 'rgba(248, 113, 113, 0.08)', border: '1px solid rgba(248, 113, 113, 0.2)' }}>
                       <p className="font-bold mb-1" style={{ color: 'var(--color-danger)' }}>오답 노트</p>
                       <ul className="list-disc pl-4 max-h-32 overflow-y-auto" style={{ color: 'var(--color-danger)' }}>
                         {state.wrongAnswers.map(wa => <li key={wa.id}>{wa.nameKO}</li>)}
                       </ul>
                     </div>
                  )}
                </div>
              ) : state.targetCountry ? (
                <div className="flex-1 flex flex-col mt-3">
                  {state.currentMode !== 'STUDY' && state.currentMode !== 'MAP' && (
                    <div className="target-card">
                      <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        다음 나라를 찾으세요
                      </p>
                      <p className="target-name text-3xl font-extrabold animate-subtle-pulse" style={{ fontFamily: 'Outfit, sans-serif', color: 'var(--color-cyan-accent)' }}>
                        {state.targetCountry.nameKO}
                      </p>
                    </div>
                  )}

                  {state.currentMode === 'MULTIPLE_CHOICE' && (
                    <div className="mt-3 flex flex-col gap-2">
                       <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>하이라이트된 나라를 고르세요</p>
                       {state.choices.map(c => (
                         <button 
                           key={c.id} 
                           onClick={() => state.submitAnswer(c.id)}
                           className="choice-btn"
                         >
                           {c.nameKO}
                         </button>
                       ))}
                    </div>
                  )}

                  {state.currentMode === 'STUDY' && (
                     <div className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                       자유롭게 세계 지도를 탐험하세요.<br/><br/>
                       나라 위에 마우스를 올리면 이름이 표시됩니다.
                     </div>
                  )}

                  {state.currentMode === 'MAP' && (
                     <div className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                       모든 나라 이름이 표시된 세계지도입니다.<br/><br/>
                       줌인하면 작은 나라 이름도 보입니다.<br/>
                       마우스를 올리면 한글 이름이 표시됩니다.
                     </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 mt-4 text-center" style={{ color: 'var(--color-text-muted)' }}>선택된 국가가 없습니다.</div>
              )}
              
              <div className="mt-auto pt-4 space-y-2">
                {state.mistakeCount > 0 && !state.isGameOver && (
                  <p className="text-sm font-bold text-center" style={{ color: 'var(--color-danger)' }}>
                    오답 {state.mistakeCount} / 3
                  </p>
                )}
                <button onClick={() => state.endGame()} className="back-btn">
                  ← 홈으로 돌아가기
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Map Area */}
        <div className="map-area flex-1 rounded-2xl overflow-hidden glass-panel relative">
           <WorldMap />
        </div>
      </div>
    </div>
  );
}

export default App;
