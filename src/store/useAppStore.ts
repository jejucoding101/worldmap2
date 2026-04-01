import { create } from 'zustand';
import type { CountryData } from '../data/countries';
import { countryList } from '../data/countries';

export type GameMode = 'PINPOINT' | 'TYPE_IN' | 'MULTIPLE_CHOICE' | 'DRAG_DROP' | 'STUDY' | 'HOME';
export type Region = 'All' | 'Asia' | 'Europe' | 'Africa' | 'Americas' | 'Oceania';

interface GameState {
  currentMode: GameMode;
  selectedRegion: Region;
  activeCountries: CountryData[];
  
  targetCountry: CountryData | null;
  choices: CountryData[]; // For Multiple Choice
  score: number;
  timer: number;
  wrongAnswers: CountryData[];
  correctAnswerIds: string[];
  mistakeCount: number;
  isGameOver: boolean;
  
  setMode: (mode: GameMode) => void;
  setRegion: (region: Region) => void;
  startGame: () => void;
  submitAnswer: (answerId: string) => boolean;
  addMistake: () => void;
  endGame: () => void;
  tickTimer: () => void;
}

export const useAppStore = create<GameState>((set, get) => {
  const generateChoices = (target: CountryData, allList: CountryData[]) => {
    const others = allList.filter(c => c.id !== target.id).sort(() => 0.5 - Math.random()).slice(0, 3);
    return [...others, target].sort(() => 0.5 - Math.random());
  };

  return {
    currentMode: 'HOME',
    selectedRegion: 'All',
    activeCountries: countryList,
    targetCountry: null,
    choices: [],
    score: 0,
    timer: 0,
    wrongAnswers: [],
    correctAnswerIds: [],
    mistakeCount: 0,
    isGameOver: false,
    
    setMode: (mode) => set({ currentMode: mode }),
    
    setRegion: (region) => {
      const list = region === 'All' ? countryList : countryList.filter(c => c.region === region);
      set({ selectedRegion: region, activeCountries: list });
    },
    
    startGame: () => {
      const { activeCountries, currentMode } = get();
      if (activeCountries.length === 0) return;
      const shuffled = [...activeCountries].sort(() => 0.5 - Math.random());
      const firstTarget = shuffled[0];
      
      set({ 
        targetCountry: firstTarget, 
        choices: currentMode === 'MULTIPLE_CHOICE' ? generateChoices(firstTarget, activeCountries) : [],
        score: 0, 
        timer: 0, 
        wrongAnswers: [],
        correctAnswerIds: [],
        mistakeCount: 0,
        activeCountries: shuffled,
        isGameOver: false
      });
    },

    tickTimer: () => set(state => ({ timer: state.timer + 1 })),
    
    submitAnswer: (answerId) => {
      const state = get();
      if (!state.targetCountry) return false;
      
      const isCorrect = state.targetCountry.id === answerId;
      
      if (isCorrect) {
        const points = 3 - state.mistakeCount;
        const currentIndex = state.activeCountries.findIndex(c => c.id === state.targetCountry!.id);
        
        if (currentIndex >= 0 && currentIndex < state.activeCountries.length - 1) {
          const nextTarget = state.activeCountries[currentIndex + 1];
          set(s => ({ 
            score: s.score + Math.max(1, points), 
            correctAnswerIds: [...s.correctAnswerIds, s.targetCountry!.id],
            mistakeCount: 0,
            targetCountry: nextTarget,
            choices: s.currentMode === 'MULTIPLE_CHOICE' ? generateChoices(nextTarget, s.activeCountries) : []
          }));
        } else {
          set(s => ({ score: s.score + Math.max(1, points), correctAnswerIds: [...s.correctAnswerIds, s.targetCountry!.id], isGameOver: true, targetCountry: null }));
        }
      } else {
        get().addMistake();
      }
      return isCorrect;
    },
    
    addMistake: () => {
      set(state => {
        const newMistakes = state.mistakeCount + 1;
        if (newMistakes >= 3 && state.targetCountry) {
          const isAlreadyAdded = state.wrongAnswers.some(c => c.id === state.targetCountry!.id);
          const newWrongAnswers = isAlreadyAdded ? state.wrongAnswers : [...state.wrongAnswers, state.targetCountry];
          
          const currentIndex = state.activeCountries.findIndex(c => c.id === state.targetCountry!.id);
          if (currentIndex < state.activeCountries.length - 1) {
            const nextTarget = state.activeCountries[currentIndex + 1];
            return { 
              mistakeCount: 0, 
              wrongAnswers: newWrongAnswers, 
              targetCountry: nextTarget,
              choices: state.currentMode === 'MULTIPLE_CHOICE' ? generateChoices(nextTarget, state.activeCountries) : []
            };
          } else {
            return { mistakeCount: newMistakes, wrongAnswers: newWrongAnswers, isGameOver: true, targetCountry: null };
          }
        }
        return { mistakeCount: newMistakes };
      });
    },
    
    endGame: () => set({ currentMode: 'HOME', targetCountry: null, isGameOver: false })
  };
});
