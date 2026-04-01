import { create } from 'zustand';
import type { CountryData } from '../data/countries';
import { countryList } from '../data/countries';

export type GameMode = 'PINPOINT' | 'TYPE_IN' | 'MULTIPLE_CHOICE' | 'STUDY' | 'MAP' | 'HOME';
export type Region = 'All' | 'Asia' | 'Europe' | 'Africa' | 'Americas' | 'Oceania';

export interface Feedback {
  type: 'correct' | 'wrong' | 'reveal';
  countryName: string;
}

interface GameState {
  currentMode: GameMode;
  selectedRegion: Region;
  activeCountries: CountryData[];
  
  targetCountry: CountryData | null;
  choices: CountryData[];
  score: number;
  timer: number;
  wrongAnswers: CountryData[];
  correctAnswerIds: string[];
  mistakeCount: number;
  isGameOver: boolean;
  feedback: Feedback | null;
  isTransitioning: boolean;
  hintCountryIds: string[];
  
  setMode: (mode: GameMode) => void;
  setRegion: (region: Region) => void;
  startGame: () => void;
  submitAnswer: (answerId: string) => boolean;
  addMistake: () => void;
  endGame: () => void;
  tickTimer: () => void;
  clearFeedback: () => void;
  useHint: () => void;
}

export const useAppStore = create<GameState>((set, get) => {
  const generateChoices = (target: CountryData, allList: CountryData[]) => {
    const others = allList.filter(c => c.id !== target.id).sort(() => 0.5 - Math.random()).slice(0, 3);
    return [...others, target].sort(() => 0.5 - Math.random());
  };

  const advanceToNext = () => {
    const state = get();
    if (!state.targetCountry) return;
    const currentIndex = state.activeCountries.findIndex(c => c.id === state.targetCountry!.id);
    
    if (currentIndex >= 0 && currentIndex < state.activeCountries.length - 1) {
      const nextTarget = state.activeCountries[currentIndex + 1];
      set(s => ({ 
        targetCountry: nextTarget,
        choices: s.currentMode === 'MULTIPLE_CHOICE' ? generateChoices(nextTarget, s.activeCountries) : [],
        mistakeCount: 0,
        feedback: null,
        isTransitioning: false,
        hintCountryIds: [],
      }));
    } else {
      set({ isGameOver: true, targetCountry: null, feedback: null, isTransitioning: false, hintCountryIds: [] });
    }
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
    feedback: null,
    isTransitioning: false,
    hintCountryIds: [],
    
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
        isGameOver: false,
        feedback: null,
        isTransitioning: false,
        hintCountryIds: [],
      });
    },

    tickTimer: () => set(state => ({ timer: state.timer + 1 })),
    clearFeedback: () => set({ feedback: null }),
    
    submitAnswer: (answerId) => {
      const state = get();
      if (!state.targetCountry || state.isTransitioning) return false;
      
      const isCorrect = state.targetCountry.id === answerId;
      
      if (isCorrect) {
        const points = 3 - state.mistakeCount;
        set(s => ({ 
          score: s.score + Math.max(1, points), 
          correctAnswerIds: [...s.correctAnswerIds, s.targetCountry!.id],
          feedback: { type: 'correct', countryName: s.targetCountry!.nameKO },
          isTransitioning: true,
        }));
        
        // Delay before advancing to next question
        setTimeout(() => advanceToNext(), 1200);
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
          
          // Show reveal feedback (correct answer location) then advance
          setTimeout(() => {
            const s = get();
            const currentIndex = s.activeCountries.findIndex(c => c.id === s.targetCountry?.id);
            if (currentIndex >= 0 && currentIndex < s.activeCountries.length - 1) {
              const nextTarget = s.activeCountries[currentIndex + 1];
              set(prev => ({
                mistakeCount: 0,
                targetCountry: nextTarget,
                choices: prev.currentMode === 'MULTIPLE_CHOICE' ? generateChoices(nextTarget, prev.activeCountries) : [],
                feedback: null,
                isTransitioning: false,
                hintCountryIds: [],
              }));
            } else {
              set({ isGameOver: true, targetCountry: null, feedback: null, isTransitioning: false, hintCountryIds: [] });
            }
          }, 2000);

          return { 
            mistakeCount: newMistakes, 
            wrongAnswers: newWrongAnswers,
            isTransitioning: true,
            feedback: { type: 'reveal' as const, countryName: state.targetCountry.nameKO },
          };
        }
        return { mistakeCount: newMistakes };
      });
    },
    
    endGame: () => set({ currentMode: 'HOME', targetCountry: null, isGameOver: false, feedback: null, isTransitioning: false, hintCountryIds: [] }),
    
    useHint: () => {
      const { targetCountry, hintCountryIds } = get();
      if (!targetCountry || hintCountryIds.length > 0) return;
      
      const sameRegion = countryList
        .filter(c => c.region === targetCountry.region && c.id !== targetCountry.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 9);
      
      set({ hintCountryIds: [targetCountry.id, ...sameRegion.map(c => c.id)] });
    },
  };
});
