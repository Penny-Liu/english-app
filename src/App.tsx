import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, Database, Plus, ChevronLeft, ChevronRight, RotateCcw, Trash2, GraduationCap, BrainCircuit, Check, X, ArrowRight, RotateCw, Volume2, Cloud, LogOut, Edit2, Search, Upload, Download, FolderPlus } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, writeBatch } from 'firebase/firestore';

// Firebase initialization (設定來自 .env / GitHub Secrets)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'vocab-app';

const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    // 手機瀏覽器擋彈窗時改用跳轉
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
    } else {
      console.error('Login error', e);
    }
  }
};

const customCss = `
  .perspective-1000 { perspective: 1000px; }
  .transform-style-3d { transform-style: preserve-3d; }
  .backface-hidden { backface-visibility: hidden; }
  .rotate-y-180 { transform: rotateY(180deg); }
  .transition-transform { transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1); }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  .animate-shake { animation: shake 0.4s ease-in-out; }
`;

// Helper for Text-to-Speech
const playAudio = (text, lang = 'en-US') => {
  if (!window.speechSynthesis) {
    alert("您的瀏覽器不支援語音功能");
    return;
  }
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  
  // 嘗試獲取所有可用的語音，並篩選高品質的英文語音
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    // 優先選擇 Google 或是 Apple 的高階語音
    const preferredVoices = voices.filter(voice => 
      voice.lang.startsWith('en') && 
      (voice.name.includes('Google') || voice.name.includes('Samantha') || voice.name.includes('Alex') || voice.name.includes('Siri'))
    );
    
    if (preferredVoices.length > 0) {
      utterance.voice = preferredVoices[0]; // 使用找到的最佳語音
    } else {
      // 若沒有高階語音，退而求其次找任何英文語音，避免用到中文引擎念英文
      const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
      if (englishVoices.length > 0) {
        utterance.voice = englishVoices[0];
      }
    }
  }

  utterance.rate = 0.9; // 稍微放慢一點點即可，太慢會變成機械音
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
};

// 確保語音列表在載入時能被正確讀取 (某些瀏覽器需要)
if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

const INITIAL_CATEGORIES = ['大考 1680 Unit 1', '自訂科目'];

// Data structured exactly like the provided textbook images
const INITIAL_CARDS = [
  { 
    id: 1, category: '大考 1680 Unit 1', term: 'ability', phonetic: '[əˋbɪlətɪ]', pos: 'n.', 
    meaning: '能力；技能；本領', 
    phrases: [{en: 'have the ability to V', ch: '有做…的能力'}, {en: "to the best of one's ability", ch: '竭盡全力'}],
    mastery: 0, mistake: false
  },
  { 
    id: 2, category: '大考 1680 Unit 1', term: 'accept', phonetic: '[əkˋsɛpt]', pos: 'vt.', 
    meaning: '接受；容忍；採納', 
    phrases: [{en: 'accept (the fact) that', ch: '承認…，接受…'}, {en: 'accept sb/sth as sth', ch: '接納某人/事為…的成員'}],
    mastery: 0, mistake: false
  },
  { 
    id: 3, category: '大考 1680 Unit 1', term: 'behave', phonetic: '[bɪˋhev]', pos: 'vi.', 
    meaning: '表現；守規矩', 
    phrases: [{en: 'behave... towards sb', ch: '以某種態度對待某人'}, {en: 'Behave yourself!', ch: '規矩點！'}],
    mastery: 0, mistake: false
  },
  { 
    id: 4, category: '大考 1680 Unit 1', term: 'belief', phonetic: '[bɪˋlif]', pos: 'n.', 
    meaning: '信念；信賴；信仰', 
    phrases: [{en: 'belief in', ch: '信賴…'}, {en: 'beyond belief', ch: '難以置信'}],
    mastery: 0, mistake: false
  },
  { 
    id: 5, category: '大考 1680 Unit 1', term: 'damage', phonetic: '[ˋdæmɪdʒ]', pos: 'vt. / n.U', 
    meaning: '破壞；對…造成負面影響 / 損害', 
    phrases: [{en: 'serious damage', ch: '嚴重的損害'}, {en: 'the damage is done', ch: '已造成的傷害無法挽回'}],
    mastery: 0, mistake: false
  },
  { 
    id: 6, category: '大考 1680 Unit 1', term: 'earn', phonetic: '[ɝn]', pos: 'vt.', 
    meaning: '賺得；搏得；獲得', 
    phrases: [{en: 'earn a fortune', ch: '掙大錢'}, {en: 'earn a living', ch: '謀生'}],
    mastery: 0, mistake: false
  },
  { 
    id: 7, category: '大考 1680 Unit 1', term: 'science', phonetic: '[ˋsaɪəns]', pos: 'n.', 
    meaning: '科學', 
    phrases: [{en: 'sth is not rocket science', ch: '某事並不難了解'}],
    mastery: 0, mistake: false
  },
];

// 解析卡片排序值（相容舊資料 id 如 "1730000_12" 與新欄位 order）
const getCardSortTuple = (card) => {
  if (typeof card.order === 'number' && !Number.isNaN(card.order)) {
    return [card.order, 0];
  }
  const rawId = String(card.id || '');
  if (rawId.includes('_')) {
    const [ts, idx] = rawId.split('_');
    return [Number(ts) || 0, Number(idx) || 0];
  }
  return [Number(rawId) || 0, 0];
};

const sortCardsByOrder = (list) => {
  return [...list].sort((a, b) => {
    const [a1, a2] = getCardSortTuple(a);
    const [b1, b2] = getCardSortTuple(b);
    if (a1 !== b1) return a1 - b1;
    return a2 - b2;
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState('learn'); // 'learn', 'quiz', 'admin'
  const [customCategories, setCustomCategories] = useState(INITIAL_CATEGORIES);
  const [cards, setCards] = useState([]);
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  // 自動整合預設分類、自訂分類與雲端單字卡中的所有分類
  const categories = useMemo(() => {
    const set = new Set([...customCategories]);
    cards.forEach(c => {
      if (c.category && c.category.trim()) set.add(c.category.trim());
    });
    return Array.from(set);
  }, [cards, customCategories]);

  // 1. Auth Setup (Google)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (!u) { setCards([]); setIsSyncing(true); }
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Sync
  useEffect(() => {
    if (!user) return;
    const cardsRef = collection(db, 'artifacts', appId, 'users', user.uid, 'cards');
    const unsub = onSnapshot(cardsRef, async (snapshot) => {
      if (snapshot.empty) {
        // Seed initial data first time
        INITIAL_CARDS.forEach(async (card, idx) => {
          await setDoc(doc(cardsRef, card.id.toString()), {
            ...card,
            id: card.id.toString(),
            order: idx + 1,
          });
        });
      } else {
        const loaded = sortCardsByOrder(snapshot.docs.map(d => d.data()));
        // 為每張卡標記它在所屬科目內的序號 (catSeq: 1, 2, 3...) 與全域序號 (globalSeq)
        const catCounters = {};
        const enriched = loaded.map((c, idx) => {
          const cat = c.category || '未分類';
          catCounters[cat] = (catCounters[cat] || 0) + 1;
          return {
            ...c,
            globalSeq: idx + 1,
            catSeq: catCounters[cat],
          };
        });
        setCards(enriched);
        setIsSyncing(false);
      }
    }, (error) => {
      console.error(error);
      setIsSyncing(false);
    });
    return () => unsub();
  }, [user]);
  
  // Quiz progress management (Cloud Sync)
  const updateCardMastery = useCallback(async (id, isCorrect) => {
    if (!user) return;
    const card = cards.find(c => c.id == id);
    if(!card) return;

    const newMastery = isCorrect ? Math.min(card.mastery + 1, 2) : 0;
    const newMistake = isCorrect ? (newMastery === 2 ? false : card.mistake) : true;
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', id.toString()), {
        mastery: newMastery,
        mistake: newMistake
      });
    } catch(e) { console.error("Update failed", e); }
  }, [cards, user]);

  const resetProgress = useCallback(async (targetCardsOrCategory = 'All') => {
    if (!user) return;
    const targetList = Array.isArray(targetCardsOrCategory)
      ? targetCardsOrCategory
      : cards.filter(
          card =>
            targetCardsOrCategory === 'All' ||
            card.category === targetCardsOrCategory ||
            (targetCardsOrCategory === '錯題本' && card.mistake)
        );
    try {
      for (let i = 0; i < targetList.length; i += 400) {
        const batch = writeBatch(db);
        targetList.slice(i, i + 400).forEach(card => {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', card.id.toString());
          batch.update(ref, { mastery: 0, mistake: false });
        });
        await batch.commit();
      }
    } catch (e) {
      console.error('Reset progress failed', e);
    }
  }, [cards, user]);

  if (!authReady) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-8 text-center">
        <div className="p-4 bg-indigo-500/20 rounded-2xl text-indigo-400 mb-6"><GraduationCap size={48} /></div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent mb-2">智能單字庫</h1>
        <p className="text-sm text-slate-500 mb-10">登入後，學習進度會在所有裝置同步</p>
        <button onClick={loginWithGoogle} className="w-full max-w-xs py-3.5 rounded-2xl bg-white text-slate-900 font-bold active:scale-95 transition-all shadow-lg">
          使用 Google 登入
        </button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-slate-950 text-slate-100 font-sans sm:bg-slate-900 sm:py-6 select-none flex flex-col justify-center">
      <style dangerouslySetInnerHTML={{ __html: customCss }} />
      
      <div className="w-full h-full sm:h-[844px] max-w-[430px] mx-auto bg-slate-950 sm:rounded-[2.75rem] sm:shadow-2xl sm:border-[6px] border-slate-800 flex flex-col overflow-hidden relative">
        
        <header className="px-5 pt-[max(0.65rem,env(safe-area-inset-top))] pb-2.5 border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-indigo-500/20 rounded-xl text-indigo-400">
                <GraduationCap size={20} />
              </div>
              <div>
                <h1 className="text-base font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-1.5 leading-tight">
                  智能單字庫 {user && !isSyncing && <Cloud size={15} className="text-cyan-400" />}
                </h1>
                <p className="text-[11px] text-slate-500 font-medium leading-tight">1680 大考必備</p>
              </div>
            </div>
            <button onClick={() => signOut(auth)} title={user.email || '登出'} className="p-2 text-slate-500 hover:text-slate-300 bg-slate-900 rounded-xl transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-slate-950">
          {activeTab === 'learn' && <LearnView categories={categories} cards={cards} />}
          {activeTab === 'quiz' && <QuizView categories={categories} cards={cards} updateCardMastery={updateCardMastery} resetProgress={resetProgress} />}
          {activeTab === 'admin' && <AdminView categories={categories} setCategories={setCustomCategories} cards={cards} user={user} />}
        </main>

        <nav className="shrink-0 w-full bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pt-1 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around items-center z-20">
          <NavButton icon={BookOpen} label="複習" isActive={activeTab === 'learn'} onClick={() => setActiveTab('learn')} />
          <NavButton icon={BrainCircuit} label="測驗" isActive={activeTab === 'quiz'} onClick={() => setActiveTab('quiz')} />
          <NavButton icon={Database} label="管理" isActive={activeTab === 'admin'} onClick={() => setActiveTab('admin')} />
        </nav>
      </div>
    </div>
  );
}

function NavButton({ icon: Icon, label, isActive, onClick }) {
  return (
    <button 
      onClick={onClick}
      className={`relative flex flex-col items-center py-1.5 px-3 transition-all duration-200 w-20 ${isActive ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
    >
      <Icon size={21} className={`mb-0.5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}`} />
      <span className="text-[11px] font-bold leading-tight">{label}</span>
    </button>
  );
}

// 共用範圍過濾 Hook（支援單一科目、多科目勾選、以及第 N ~ M 號單字範圍）
function useScopedCards(cards, activeCategory, selectedMultiCats, rangeStart, rangeEnd) {
  return useMemo(() => {
    let base = [];
    if (selectedMultiCats.length > 0) {
      base = cards.filter(c => selectedMultiCats.includes(c.category));
    } else if (activeCategory === 'All') {
      base = cards;
    } else if (activeCategory === '錯題本') {
      base = cards.filter(c => c.mistake);
    } else {
      base = cards.filter(c => c.category === activeCategory);
    }

    // 在目前選定的範圍內編號 1..N，方便用「第幾題 ~ 第幾題」切範圍
    const indexed = base.map((c, idx) => ({ ...c, scopeSeq: idx + 1 }));
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);

    const sliced = indexed.filter(c => {
      if (!Number.isNaN(start) && start > 0 && c.scopeSeq < start) return false;
      if (!Number.isNaN(end) && end > 0 && c.scopeSeq > end) return false;
      return true;
    });

    return { baseTotal: indexed.length, scopedCards: sliced };
  }, [cards, activeCategory, selectedMultiCats, rangeStart, rangeEnd]);
}

// --- LEARN VIEW COMPONENTS ---

function LearnView({ categories, cards }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedMultiCats, setSelectedMultiCats] = useState([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const { baseTotal, scopedCards: filteredCards } = useScopedCards(
    cards,
    activeCategory,
    selectedMultiCats,
    rangeStart,
    rangeEnd
  );

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [activeCategory, selectedMultiCats, rangeStart, rangeEnd]);

  const safeIndex = filteredCards.length > 0 ? Math.min(currentIndex, filteredCards.length - 1) : 0;

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev + 1) % filteredCards.length), 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length), 150);
  };

  return (
    <div className="flex flex-col min-h-full">
      <CategorySelector
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={cat => {
          setActiveCategory(cat);
          setSelectedMultiCats([]);
        }}
        selectedMultiCats={selectedMultiCats}
        setSelectedMultiCats={setSelectedMultiCats}
        rangeStart={rangeStart}
        setRangeStart={setRangeStart}
        rangeEnd={rangeEnd}
        setRangeEnd={setRangeEnd}
        baseTotal={baseTotal}
      />

      <div className="flex-1 flex flex-col justify-between items-center px-5 py-2 pb-4 min-h-0">
        {filteredCards.length > 0 ? (
          <>
            <div className="w-full flex justify-between items-center text-xs font-medium text-slate-500 mb-2 px-1 shrink-0">
              <span className="truncate max-w-[70%]">
                {filteredCards[safeIndex].category}{' '}
                <span className="text-indigo-400 font-mono">#{filteredCards[safeIndex].scopeSeq}</span>
              </span>
              <span className="font-mono">{safeIndex + 1} / {filteredCards.length}</span>
            </div>
            
            <div 
              className="w-full flex-1 min-h-[240px] max-h-[380px] perspective-1000 cursor-pointer group"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className={`relative w-full h-full transform-style-3d transition-transform duration-500 ease-out ${isFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* Front */}
                <div className="absolute inset-0 backface-hidden bg-slate-900 border border-slate-800 rounded-[1.75rem] shadow-xl flex flex-col items-center justify-center p-6 text-center group-hover:border-indigo-500/50 transition-colors">
                  <span className="absolute top-5 left-5 text-xs font-mono font-bold text-slate-500 bg-slate-800/80 px-2.5 py-1 rounded-full">
                    #{filteredCards[safeIndex].scopeSeq}
                  </span>
                  <RotateCcw size={18} className="absolute top-5 right-5 text-slate-600" />
                  <div className="flex flex-col items-center justify-center mb-2">
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-50 tracking-wide mb-3">{filteredCards[safeIndex].term}</h2>
                    <button 
                      onClick={(e) => { e.stopPropagation(); playAudio(filteredCards[safeIndex].term); }} 
                      className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full hover:bg-indigo-500/30 transition-colors active:scale-95"
                    >
                      <Volume2 size={26} />
                    </button>
                  </div>
                  <p className="text-base text-indigo-300/80 font-mono tracking-wider">{filteredCards[safeIndex].phonetic}</p>
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-800 border border-indigo-500/30 rounded-[1.75rem] shadow-xl flex flex-col p-5 overflow-y-auto no-scrollbar">
                  <div className="mb-3 pb-3 border-b border-slate-700/50">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded shrink-0">{filteredCards[safeIndex].pos}</span>
                      <h3 className="text-lg font-bold text-slate-100">{filteredCards[safeIndex].meaning}</h3>
                    </div>
                  </div>
                  
                  {filteredCards[safeIndex].phrases && filteredCards[safeIndex].phrases.length > 0 && (
                    <div className="flex-1">
                      <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">相關片語</h4>
                      <div className="space-y-2">
                        {filteredCards[safeIndex].phrases.map((phrase, idx) => (
                          <div key={idx} className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-700/30">
                            <div className="flex items-start justify-between gap-2 mb-0.5">
                              <p className="text-xs font-semibold text-slate-200">{phrase.en}</p>
                              <button 
                                onClick={(e) => { e.stopPropagation(); playAudio(phrase.en); }}
                                className="text-indigo-400 p-1 bg-indigo-500/10 hover:bg-indigo-500/30 rounded transition-colors shrink-0"
                              >
                                <Volume2 size={14} />
                              </button>
                            </div>
                            <p className="text-xs text-slate-400">{phrase.ch}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="w-full flex items-center gap-4 mt-4 shrink-0">
              <button onClick={handlePrev} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-300 hover:text-white transition-colors active:scale-95 shrink-0"><ChevronLeft size={24} /></button>
              <button onClick={() => setIsFlipped(!isFlipped)} className="flex-1 py-3.5 rounded-2xl bg-indigo-600/20 text-indigo-400 font-bold active:scale-95 transition-all border border-indigo-500/30 text-sm">
                {isFlipped ? '看單字' : '看解釋'}
              </button>
              <button onClick={handleNext} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-800 text-slate-300 hover:text-white transition-colors active:scale-95 shrink-0"><ChevronRight size={24} /></button>
            </div>
          </>
        ) : (
          <EmptyState isMistakeTab={activeCategory === '錯題本'} />
        )}
      </div>
    </div>
  );
}

// --- QUIZ ENGINE COMPONENTS ---

function QuizView({ categories, cards, updateCardMastery, resetProgress }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedMultiCats, setSelectedMultiCats] = useState([]);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  
  // Quiz State
  const [question, setQuestion] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [feedback, setFeedback] = useState(null); // 'correct', 'wrong', null
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizMode, setQuizMode] = useState('mixed'); // 'mixed', 'mc_meaning', 'mc_term', 'mc_phrase', 'spelling'

  const { baseTotal, scopedCards } = useScopedCards(
    cards,
    activeCategory,
    selectedMultiCats,
    rangeStart,
    rangeEnd
  );

  // Active pool: Cards in scope not yet fully mastered (mastery < 2)
  const pool = useMemo(() => {
    return scopedCards.filter(c => c.mastery < 2);
  }, [scopedCards]);

  const totalInCat = scopedCards.length;
  
  const progressPercent = totalInCat === 0 ? 0 : Math.round(((totalInCat - pool.length) / totalInCat) * 100);

  // Helper to shuffle arrays
  const shuffle = (array) => [...array].sort(() => Math.random() - 0.5);

  const generateQuestion = useCallback(() => {
    let currentPool = pool;
    if (quizMode === 'mc_phrase') {
      currentPool = pool.filter(c => c.phrases && c.phrases.length > 0);
    }

    if (currentPool.length === 0) {
      if (question !== null) setQuestion(null);
      return;
    }

    const targetCard = currentPool[Math.floor(Math.random() * currentPool.length)];
    
    // Determine question type based on mode or mastery level
    let type = 'mc_meaning';
    if (quizMode !== 'mixed') {
      type = quizMode;
    } else {
      if (targetCard.mastery === 0) {
        type = Math.random() > 0.5 ? 'mc_meaning' : 'mc_term';
      } else if (targetCard.mastery === 1) {
        const hasPhrases = targetCard.phrases && targetCard.phrases.length > 0;
        type = (hasPhrases && Math.random() > 0.5) ? 'mc_phrase' : 'spelling';
      }
    }

    let qData = { card: targetCard, type };

    if (type === 'mc_meaning') {
      const wrongOptions = cards
        .filter(c => c.id !== targetCard.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(c => c.meaning);
      qData.options = shuffle([targetCard.meaning, ...wrongOptions]);
    } 
    else if (type === 'mc_term') {
      const wrongOptions = cards
        .filter(c => c.id !== targetCard.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(c => c.term);
      qData.options = shuffle([targetCard.term, ...wrongOptions]);
    }
    else if (type === 'mc_phrase') {
      const correctPhrase = targetCard.phrases[Math.floor(Math.random() * targetCard.phrases.length)];
      qData.targetPhrase = correctPhrase;
      
      // Gather other phrases from other cards for distractors
      let allOtherPhrases = [];
      cards.filter(c => c.id !== targetCard.id).forEach(c => {
        if (c.phrases) allOtherPhrases.push(...c.phrases.map(p => p.en));
      });
      allOtherPhrases = shuffle(allOtherPhrases).slice(0, 3);
      
      // Fallback if not enough other phrases
      while (allOtherPhrases.length < 3) {
        allOtherPhrases.push(`Random Phrase ${Math.random().toString(36).substring(7)}`);
      }
      qData.options = shuffle([correctPhrase.en, ...allOtherPhrases]);
    }

    setQuestion(qData);
    setInputVal('');
    setFeedback(null);
    setShowAnswer(false);
  }, [pool, cards, quizMode, question]);

  // Generate question on mount or pool change
  useEffect(() => {
    let currentPool = pool;
    if (quizMode === 'mc_phrase') {
      currentPool = pool.filter(c => c.phrases && c.phrases.length > 0);
    }

    if (!question && currentPool.length > 0) {
      generateQuestion();
    }
  }, [pool, quizMode, question, generateQuestion]);

  const handleAnswer = (answer) => {
    if (feedback) return; // Prevent double click
    
    let isCorrect = false;
    if (question.type === 'mc_meaning') isCorrect = (answer === question.card.meaning);
    if (question.type === 'mc_term') isCorrect = (answer === question.card.term);
    if (question.type === 'mc_phrase') isCorrect = (answer === question.targetPhrase.en);
    if (question.type === 'spelling') isCorrect = (inputVal.trim().toLowerCase() === question.card.term.toLowerCase());

    setFeedback(isCorrect ? 'correct' : 'wrong');
    setShowAnswer(true);

    if (question.type === 'mc_term') {
      playAudio(question.card.term);
    }

    if (isCorrect) {
      setTimeout(() => {
        updateCardMastery(question.card.id, true);
        setQuestion(null); // Force regenerate
      }, 1000);
    } else {
      setTimeout(() => {
        updateCardMastery(question.card.id, false);
      }, 2000); // Give them time to read the correct answer
    }
  };

  const handleSpellingSubmit = (e) => {
    e.preventDefault();
    if (inputVal.trim()) handleAnswer(inputVal);
  };

  return (
    <div className="flex flex-col min-h-full pb-6">
      <CategorySelector
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={cat => {
          setActiveCategory(cat);
          setSelectedMultiCats([]);
          setQuestion(null);
        }}
        selectedMultiCats={selectedMultiCats}
        setSelectedMultiCats={next => {
          setSelectedMultiCats(next);
          setQuestion(null);
        }}
        rangeStart={rangeStart}
        setRangeStart={val => {
          setRangeStart(val);
          setQuestion(null);
        }}
        rangeEnd={rangeEnd}
        setRangeEnd={val => {
          setRangeEnd(val);
          setQuestion(null);
        }}
        baseTotal={baseTotal}
      />
      
      {/* Quiz Mode Selector */}
      <div className="px-6 py-1.5 shrink-0">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'mixed', label: '🧠 智能綜合' },
            { id: 'mc_meaning', label: '🎯 英選中' },
            { id: 'mc_term', label: '🔤 中選英' },
            { id: 'mc_phrase', label: '🧩 片語選擇' },
            { id: 'spelling', label: '📝 拼字測驗' }
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => { setQuizMode(mode.id); setQuestion(null); }}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                quizMode === mode.id 
                  ? 'bg-slate-800 text-indigo-400 border-indigo-500/50 shadow-sm' 
                  : 'bg-slate-900/50 text-slate-500 border-slate-800/50 hover:bg-slate-800'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-1 shrink-0">
        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5">
          <span>學習進度（目前範圍 {totalInCat} 字）</span>
          <span className="text-indigo-400">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="px-5 py-2 flex-1 flex flex-col">
        {!question ? (
           <div className="flex-1 flex flex-col items-center justify-center text-center py-6">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-3 border border-green-500/30">
              <Check size={34} className="text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-1.5">全部學會了！</h3>
            <p className="text-xs text-slate-400 mb-6 max-w-[240px]">
              {activeCategory === '錯題本' ? '太棒了！您的錯題本目前是空的！' : '目前選定範圍的單字皆已熟悉，或無符合此題型的單字！'}
            </p>
            {activeCategory !== '錯題本' && scopedCards.length > 0 && (
              <button 
                onClick={() => resetProgress(scopedCards)}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full text-sm font-bold transition-all border border-slate-700 active:scale-95"
              >
                <RotateCw size={16} /> 重新測驗此範圍 ({scopedCards.length} 字)
              </button>
            )}
           </div>
        ) : (
          <div className="flex-1 flex flex-col max-w-sm w-full mx-auto">
            
            {/* Question Card */}
            <div className={`bg-slate-900 border ${feedback === 'correct' ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : feedback === 'wrong' ? 'border-red-500/50 animate-shake' : 'border-slate-800'} rounded-3xl p-4 shadow-xl mb-3 transition-all`}>
              
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                <span>
                  {question.type === 'spelling'
                    ? '📝 拼字測驗'
                    : question.type === 'mc_phrase'
                    ? '🧩 片語測驗'
                    : question.type === 'mc_term'
                    ? '🔤 中選英測驗'
                    : '🎯 英選中測驗'}
                </span>
                <span className="font-mono text-indigo-400">
                  #{question.card.scopeSeq || question.card.catSeq || 1}
                  {feedback === 'wrong' && <span className="text-red-400 ml-2">需複習</span>}
                </span>
              </div>

              {question.type === 'mc_meaning' && (
                <div className="text-center py-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-bold mb-1">{question.card.pos}</span>
                  <div className="flex justify-center items-center gap-2.5 mb-0.5">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-50">{question.card.term}</h2>
                    <button 
                      onClick={() => playAudio(question.card.term)} 
                      className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-full hover:bg-indigo-500/30 transition-colors active:scale-95"
                    >
                      <Volume2 size={20} />
                    </button>
                  </div>
                  <p className="text-indigo-400 font-mono text-xs">{question.card.phonetic}</p>
                </div>
              )}

              {question.type === 'mc_term' && (
                <div className="text-center py-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-bold mb-1">{question.card.pos}</span>
                  <h2 className="text-xl font-bold text-slate-100 leading-snug">{question.card.meaning}</h2>
                  {showAnswer && (
                    <div className="flex justify-center items-center gap-2 mt-1 text-indigo-400">
                      <span className="font-mono text-xs">{question.card.phonetic}</span>
                      <button
                        onClick={() => playAudio(question.card.term)}
                        className="p-1 bg-indigo-500/10 rounded-full hover:bg-indigo-500/30"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {question.type === 'mc_phrase' && (
                <div className="text-center py-1.5">
                   <h2 className="text-lg font-bold text-slate-100 leading-snug">{question.targetPhrase.ch}</h2>
                </div>
              )}

              {question.type === 'spelling' && (
                <div className="text-center py-1">
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-xs font-bold mb-1">{question.card.pos}</span>
                  <h2 className="text-xl font-bold text-slate-100 mb-0.5">{question.card.meaning}</h2>
                  <p className="text-slate-500 font-mono text-xs">{question.card.phonetic}</p>
                </div>
              )}
            </div>

            {/* Answer Area */}
            <div className="flex flex-col gap-2">
              {(question.type === 'mc_meaning' || question.type === 'mc_term' || question.type === 'mc_phrase') && question.options.map((opt, idx) => {
                let btnClass = "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700";
                
                if (showAnswer) {
                  const isCorrectAnswer =
                    question.type === 'mc_meaning'
                      ? opt === question.card.meaning
                      : question.type === 'mc_term'
                      ? opt === question.card.term
                      : opt === question.targetPhrase.en;
                  if (isCorrectAnswer) {
                    btnClass = "bg-green-500/20 border-green-500 text-green-400 font-bold";
                  } else if (feedback === 'wrong') {
                    btnClass = "opacity-40 bg-slate-900 border-slate-800 text-slate-600";
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={showAnswer}
                    onClick={() => handleAnswer(opt)}
                    className={`w-full py-3 px-4 rounded-2xl border text-left text-sm font-medium transition-all active:scale-[0.98] leading-snug ${btnClass}`}
                  >
                    {opt}
                  </button>
                );
              })}

              {question.type === 'spelling' && (
                <form onSubmit={handleSpellingSubmit} className="flex flex-col gap-4">
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      disabled={showAnswer}
                      value={inputVal}
                      onChange={e => setInputVal(e.target.value)}
                      placeholder="輸入英文單字..."
                      className={`w-full bg-slate-900 border-2 rounded-2xl px-5 py-4 text-center text-xl font-bold transition-all focus:outline-none focus:ring-4 ${
                        feedback === 'correct' ? 'border-green-500 text-green-400' :
                        feedback === 'wrong' ? 'border-red-500 text-red-400' :
                        'border-indigo-500/50 text-slate-100 focus:border-indigo-500 focus:ring-indigo-500/20'
                      }`}
                    />
                    {showAnswer && feedback === 'wrong' && (
                      <div className="mt-3 text-center text-green-400 font-bold tracking-widest text-lg">
                        正解：{question.card.term}
                      </div>
                    )}
                  </div>
                  {!showAnswer && (
                    <button type="submit" className="w-full mt-2 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-colors active:scale-95 shadow-lg shadow-indigo-500/20">
                      送出答案
                    </button>
                  )}
                </form>
              )}

              {/* Next Button for Wrong Answers to proceed manually or just feedback indication */}
              {showAnswer && feedback === 'wrong' && (
                <button 
                  onClick={() => {
                    setQuestion(null); // Generate next
                  }}
                  className="mt-2 py-3.5 bg-slate-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all border border-slate-700"
                >
                  繼續 <ArrowRight size={20} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function CategorySelector({
  categories,
  activeCategory,
  setActiveCategory,
  selectedMultiCats = [],
  setSelectedMultiCats,
  rangeStart = '',
  setRangeStart,
  rangeEnd = '',
  setRangeEnd,
  baseTotal = 0,
}) {
  const [showScopePanel, setShowScopePanel] = useState(false);

  const hasCustomScope =
    selectedMultiCats.length > 0 || Boolean(rangeStart) || Boolean(rangeEnd);

  const toggleMultiCat = (cat) => {
    if (!setSelectedMultiCats) return;
    if (selectedMultiCats.includes(cat)) {
      setSelectedMultiCats(selectedMultiCats.filter(c => c !== cat));
    } else {
      setSelectedMultiCats([...selectedMultiCats, cat]);
    }
  };

  // 產生每 20 題的快速範圍按鈕
  const quickRanges = useMemo(() => {
    if (!baseTotal || baseTotal <= 10) return [];
    const step = 20;
    const chunks = [];
    for (let s = 1; s <= baseTotal; s += step) {
      const e = Math.min(s + step - 1, baseTotal);
      chunks.push({ start: String(s), end: String(e), label: `${s}-${e}` });
    }
    return chunks;
  }, [baseTotal]);

  return (
    <div className="pt-3 pb-1 pl-6 pr-4 shrink-0 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {['All', '錯題本', ...categories].map(cat => {
            const label = cat === 'All' ? '全部單字' : cat === '錯題本' ? '⚠️ 錯題本' : cat;
            const isSelected =
              selectedMultiCats.length > 0
                ? selectedMultiCats.includes(cat)
                : activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {setRangeStart && (
          <button
            type="button"
            onClick={() => setShowScopePanel(!showScopePanel)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
              hasCustomScope || showScopePanel
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
            }`}
          >
            🎯 範圍{rangeStart || rangeEnd ? ` (${rangeStart || 1}~${rangeEnd || baseTotal})` : selectedMultiCats.length > 0 ? ` (${selectedMultiCats.length}科)` : ''}
          </button>
        )}
      </div>

      {showScopePanel && setRangeStart && (
        <div className="mr-2 bg-slate-900/95 border border-slate-800 rounded-2xl p-3.5 space-y-3 text-xs shadow-lg">
          {/* 1. 多科目同時勾選 */}
          {categories.length > 1 && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="font-bold text-slate-300">📚 跨科目聯合範圍（可多選）</span>
                {selectedMultiCats.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMultiCats([])}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    清除多選
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {categories.map(cat => {
                  const active = selectedMultiCats.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleMultiCat(cat)}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition-all ${
                        active
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {active ? '✓ ' : '+ '}{cat}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. 序號區間範圍 */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-bold text-slate-300">
                🔢 單字序號範圍（共 {baseTotal} 字）
              </span>
              {(rangeStart || rangeEnd) && (
                <button
                  type="button"
                  onClick={() => {
                    setRangeStart('');
                    setRangeEnd('');
                  }}
                  className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold"
                >
                  重置為全部 (1~{baseTotal})
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">第</span>
              <input
                type="number"
                min={1}
                max={baseTotal || 9999}
                value={rangeStart}
                onChange={e => setRangeStart(e.target.value)}
                placeholder="1"
                className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-center font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-slate-400">～</span>
              <input
                type="number"
                min={1}
                max={baseTotal || 9999}
                value={rangeEnd}
                onChange={e => setRangeEnd(e.target.value)}
                placeholder={String(baseTotal || 20)}
                className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-center font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              />
              <span className="text-slate-400">號單字</span>
            </div>

            {quickRanges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRangeStart('');
                    setRangeEnd('');
                  }}
                  className={`px-2 py-1 rounded-lg font-mono text-[11px] border ${
                    !rangeStart && !rangeEnd
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}
                >
                  全部
                </button>
                {quickRanges.map(r => {
                  const isCurrent = rangeStart === r.start && rangeEnd === r.end;
                  return (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => {
                        setRangeStart(r.start);
                        setRangeEnd(r.end);
                      }}
                      className={`px-2 py-1 rounded-lg font-mono text-[11px] border ${
                        isCurrent
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 font-bold'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      #{r.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ isMistakeTab }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 opacity-60">
      {isMistakeTab ? (
        <>
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4 text-green-500">
            <Check size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-300 mb-2">沒有錯題紀錄</h3>
          <p className="text-sm text-slate-500">太棒了！您目前沒有需要複習的單字。</p>
        </>
      ) : (
        <>
          <Database size={48} className="text-slate-600 mb-4" />
          <h3 className="text-xl font-bold text-slate-300 mb-2">無單字卡</h3>
          <p className="text-sm text-slate-500">請至管理頁面新增。</p>
        </>
      )}
    </div>
  );
}

// --- ADMIN VIEW COMPONENTS ---

function AdminView({ categories, setCategories, cards, user }) {
  const [adminSubTab, setAdminSubTab] = useState('single'); // 'single' | 'batch' | 'categories'
  const [editingId, setEditingId] = useState(null);

  // Single Card Form State
  const [newTerm, setNewTerm] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newPos, setNewPos] = useState('n.');
  const [selectedCat, setSelectedCat] = useState(categories[0] || '大考 1680 Unit 1');
  const [phrases, setPhrases] = useState([{ en: '', ch: '' }]);

  // Category Management State
  const [newCatName, setNewCatName] = useState('');
  const [renameCatFrom, setRenameCatFrom] = useState(categories[0] || '');
  const [renameCatTo, setRenameCatTo] = useState('');
  const [mergeSourceCat, setMergeSourceCat] = useState(categories[0] || '');
  const [mergeTargetCat, setMergeTargetCat] = useState(categories[1] || categories[0] || '');
  const [splitSourceCat, setSplitSourceCat] = useState(categories[0] || '');
  const [splitMode, setSplitMode] = useState('range'); // 'range' | 'chunk'
  const [splitStartSeq, setSplitStartSeq] = useState('21');
  const [splitEndSeq, setSplitEndSeq] = useState('40');
  const [splitTargetCat, setSplitTargetCat] = useState('');
  const [splitChunkSize, setSplitChunkSize] = useState('20');
  const [deleteCatTarget, setDeleteCatTarget] = useState(categories[0] || '');
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(false);
  const [catOpStatus, setCatOpStatus] = useState('');

  // Batch Import State
  const [batchCategory, setBatchCategory] = useState(categories[0] || '大考 1680 Unit 1');
  const [batchText, setBatchText] = useState('');
  const [batchStatus, setBatchStatus] = useState('');

  // Filter & Search State for List
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCat, setFilterCat] = useState('All');

  useEffect(() => {
    if (!selectedCat && categories.length > 0) setSelectedCat(categories[0]);
    if (!batchCategory && categories.length > 0) setBatchCategory(categories[0]);
    if (!renameCatFrom && categories.length > 0) setRenameCatFrom(categories[0]);
    if (!mergeSourceCat && categories.length > 0) setMergeSourceCat(categories[0]);
    if (!mergeTargetCat && categories.length > 0) setMergeTargetCat(categories[1] || categories[0]);
    if (!splitSourceCat && categories.length > 0) setSplitSourceCat(categories[0]);
    if (!deleteCatTarget && categories.length > 0) setDeleteCatTarget(categories[0]);
  }, [categories, selectedCat, batchCategory, renameCatFrom, mergeSourceCat, mergeTargetCat, splitSourceCat, deleteCatTarget]);

  const showCatNotice = (msg) => {
    setCatOpStatus(msg);
    setTimeout(() => setCatOpStatus(''), 4000);
  };

  // 取得目前最大的 order 值，讓新匯入/新增的單字穩定排在最後面
  const getMaxOrder = () => {
    return cards.reduce((max, c, idx) => {
      const ord = typeof c.order === 'number' ? c.order : idx + 1;
      return Math.max(max, ord);
    }, 0);
  };

  const resetForm = () => {
    setEditingId(null);
    setNewTerm('');
    setNewMeaning('');
    setNewPhonetic('');
    setNewPos('n.');
    setPhrases([{ en: '', ch: '' }]);
  };

  const handleEditClick = (card) => {
    setAdminSubTab('single');
    setEditingId(card.id.toString());
    setNewTerm(card.term || '');
    setNewMeaning(card.meaning || '');
    setNewPhonetic(card.phonetic === '[]' ? '' : (card.phonetic || ''));
    setNewPos(card.pos || 'n.');
    setSelectedCat(card.category || categories[0] || '大考 1680 Unit 1');
    setPhrases(
      card.phrases && card.phrases.length > 0
        ? card.phrases.map(p => ({ en: p.en || '', ch: p.ch || '' }))
        : [{ en: '', ch: '' }]
    );
  };

  const handleSaveCard = async (e) => {
    e.preventDefault();
    if (!newTerm.trim() || !newMeaning.trim() || !selectedCat || !user) return;

    const cleanPhrases = phrases
      .map(p => ({ en: p.en.trim(), ch: p.ch.trim() }))
      .filter(p => p.en && p.ch);

    const cardId = editingId ? editingId.toString() : Date.now().toString();
    const existingCard = editingId ? cards.find(c => c.id.toString() === cardId) : null;

    const cardData = {
      id: cardId,
      term: newTerm.trim(),
      meaning: newMeaning.trim(),
      phonetic: newPhonetic.trim() || '[]',
      pos: newPos.trim() || 'n.',
      phrases: cleanPhrases,
      category: selectedCat.trim(),
      order: existingCard && typeof existingCard.order === 'number' ? existingCard.order : getMaxOrder() + 1,
      mastery: existingCard ? existingCard.mastery : 0,
      mistake: existingCard ? existingCard.mistake : false,
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', cardId), cardData);
      resetForm();
    } catch (error) {
      console.error('Error saving card: ', error);
    }
  };

  const handleDeleteCard = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', id.toString()));
      if (editingId === id.toString()) resetForm();
    } catch (error) {
      console.error('Error deleting card: ', error);
    }
  };

  // 新增分類
  const handleAddCategory = (e) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    setCategories(prev => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setSelectedCat(trimmed);
    setBatchCategory(trimmed);
    setNewCatName('');
    showCatNotice(`✅ 已新增科目「${trimmed}」`);
  };

  // 重新命名整個分類（同步更新雲端該分類所有單字）
  const handleRenameCategory = async (e) => {
    e.preventDefault();
    const targetName = renameCatTo.trim();
    if (!user || !renameCatFrom || !targetName || renameCatFrom === targetName) return;

    const affected = cards.filter(c => c.category === renameCatFrom);
    try {
      for (let i = 0; i < affected.length; i += 400) {
        const batch = writeBatch(db);
        affected.slice(i, i + 400).forEach(c => {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', c.id.toString());
          batch.update(ref, { category: targetName });
        });
        await batch.commit();
      }
      setCategories(prev => {
        const mapped = prev.map(cat => (cat === renameCatFrom ? targetName : cat));
        return Array.from(new Set(mapped));
      });
      setRenameCatFrom(targetName);
      setRenameCatTo('');
      showCatNotice(`✅ 已改名為「${targetName}」`);
    } catch (err) {
      console.error('Rename category failed:', err);
    }
  };

  // 合併 2 個科目（把 mergeSourceCat 所有單字併入 mergeTargetCat，並排在目標科目之後）
  const handleMergeCategories = async (e) => {
    e.preventDefault();
    if (!user || !mergeSourceCat || !mergeTargetCat || mergeSourceCat === mergeTargetCat) {
      showCatNotice('⚠️ 請選擇兩個不同的科目進行合併');
      return;
    }
    const sourceCards = cards.filter(c => c.category === mergeSourceCat);
    if (sourceCards.length === 0) {
      setCategories(prev => prev.filter(c => c !== mergeSourceCat));
      showCatNotice(`✅ 科目「${mergeSourceCat}」無單字，已直接移除空科目`);
      return;
    }

    let nextOrder = getMaxOrder() + 1;
    try {
      for (let i = 0; i < sourceCards.length; i += 400) {
        const batch = writeBatch(db);
        sourceCards.slice(i, i + 400).forEach(c => {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', c.id.toString());
          batch.update(ref, { category: mergeTargetCat, order: nextOrder++ });
        });
        await batch.commit();
      }
      setCategories(prev => prev.filter(c => c !== mergeSourceCat));
      showCatNotice(`✅ 已將「${mergeSourceCat}」(${sourceCards.length} 字) 合併至「${mergeTargetCat}」`);
    } catch (err) {
      console.error('Merge failed:', err);
    }
  };

  // 拆分科目（支援：1.依序號區間拆到新科目 2.每 N 個字自動拆成多科）
  const handleSplitCategory = async (e) => {
    e.preventDefault();
    if (!user || !splitSourceCat) return;
    const sourceCards = cards.filter(c => c.category === splitSourceCat);
    if (sourceCards.length === 0) {
      showCatNotice('⚠️ 該科目目前沒有單字可拆分');
      return;
    }

    try {
      if (splitMode === 'range') {
        const target = splitTargetCat.trim();
        const s = parseInt(splitStartSeq, 10);
        const end = parseInt(splitEndSeq, 10);
        if (!target || Number.isNaN(s) || Number.isNaN(end) || s < 1 || end < s) {
          showCatNotice('⚠️ 請輸入有效的起訖序號與新科目名稱');
          return;
        }
        const toMove = sourceCards.filter((_, idx) => idx + 1 >= s && idx + 1 <= end);
        if (toMove.length === 0) {
          showCatNotice(`⚠️ 找不到第 ${s} ~ ${end} 號單字（該科共 ${sourceCards.length} 字）`);
          return;
        }
        for (let i = 0; i < toMove.length; i += 400) {
          const batch = writeBatch(db);
          toMove.slice(i, i + 400).forEach(c => {
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', c.id.toString());
            batch.update(ref, { category: target });
          });
          await batch.commit();
        }
        setCategories(prev => (prev.includes(target) ? prev : [...prev, target]));
        setSplitTargetCat('');
        showCatNotice(`✅ 已將第 ${s}~${end} 號（共 ${toMove.length} 字）拆至「${target}」`);
      } else {
        const size = parseInt(splitChunkSize, 10);
        if (Number.isNaN(size) || size < 1) {
          showCatNotice('⚠️ 請輸入每科幾個字（需大於 0）');
          return;
        }
        const newCatNames = [];
        for (let i = 0; i < sourceCards.length; i += 400) {
          const batch = writeBatch(db);
          sourceCards.slice(i, i + 400).forEach((c, idx) => {
            const globalIdx = i + idx;
            const partNum = Math.floor(globalIdx / size) + 1;
            const newCat = `${splitSourceCat} (${partNum})`;
            if (!newCatNames.includes(newCat)) newCatNames.push(newCat);
            const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', c.id.toString());
            batch.update(ref, { category: newCat });
          });
          await batch.commit();
        }
        setCategories(prev => {
          const filtered = prev.filter(c => c !== splitSourceCat);
          return Array.from(new Set([...filtered, ...newCatNames]));
        });
        showCatNotice(`✅ 已按每 ${size} 字拆分為 ${newCatNames.length} 個子科目！`);
      }
    } catch (err) {
      console.error('Split category failed:', err);
    }
  };

  // 快速刪除整個科目及其所有單字
  const handleDeleteCategory = async () => {
    if (!user || !deleteCatTarget) return;
    const toDelete = cards.filter(c => c.category === deleteCatTarget);
    try {
      for (let i = 0; i < toDelete.length; i += 400) {
        const batch = writeBatch(db);
        toDelete.slice(i, i + 400).forEach(c => {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', c.id.toString());
          batch.delete(ref);
        });
        await batch.commit();
      }
      setCategories(prev => prev.filter(c => c !== deleteCatTarget));
      setConfirmDeleteCat(false);
      showCatNotice(`🗑️ 已刪除科目「${deleteCatTarget}」及其 ${toDelete.length} 個單字`);
    } catch (err) {
      console.error('Delete category failed:', err);
    }
  };

  // 重新整理排序（依匯入先後順序 或 依英文字母 A-Z 重新編號）
  const handleNormalizeOrder = async (mode = 'keep') => {
    if (!user || cards.length === 0) return;
    const targetList =
      mode === 'alpha'
        ? [...cards].sort((a, b) => (a.term || '').localeCompare(b.term || ''))
        : [...cards];

    try {
      for (let i = 0; i < targetList.length; i += 400) {
        const batch = writeBatch(db);
        targetList.slice(i, i + 400).forEach((c, idx) => {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', c.id.toString());
          batch.update(ref, { order: i + idx + 1 });
        });
        await batch.commit();
      }
      showCatNotice(
        mode === 'alpha'
          ? '✅ 已依英文字母 A-Z 重新排序並固定所有序號！'
          : '✅ 已依目前先後順序重新固定 #1 ~ #' + targetList.length + ' 序號！'
      );
    } catch (err) {
      console.error('Reorder failed:', err);
    }
  };

  // 批次匯入處理（支援 JSON 陣列 或 每行「單字 | 音標 | 詞性 | 解釋 | 片語英=片語中;片語2英=片語2中」）
  const handleBatchImport = async () => {
    if (!user || !batchText.trim()) return;
    setBatchStatus('處理中...');
    const raw = batchText.trim();
    let parsedCards = [];
    const baseOrder = getMaxOrder();
    const baseTs = Date.now();

    try {
      if (raw.startsWith('[') || raw.startsWith('{')) {
        const json = JSON.parse(raw);
        const arr = Array.isArray(json) ? json : [json];
        parsedCards = arr
          .filter(item => item && item.term && item.meaning)
          .map((item, idx) => ({
            id: item.id ? item.id.toString() : `${baseTs}_${idx}`,
            order: typeof item.order === 'number' ? item.order : baseOrder + idx + 1,
            term: String(item.term).trim(),
            phonetic: item.phonetic ? String(item.phonetic).trim() : '[]',
            pos: item.pos ? String(item.pos).trim() : 'n.',
            meaning: String(item.meaning).trim(),
            category: item.category ? String(item.category).trim() : batchCategory,
            phrases: Array.isArray(item.phrases)
              ? item.phrases
                  .map(p => ({ en: String(p.en || '').trim(), ch: String(p.ch || '').trim() }))
                  .filter(p => p.en && p.ch)
              : [],
            mastery: typeof item.mastery === 'number' ? item.mastery : 0,
            mistake: Boolean(item.mistake),
          }));
      } else {
        const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lines.forEach((line, idx) => {
          // 支援 | 或 Tab 分隔
          const parts = (line.includes('|') ? line.split('|') : line.split('\t')).map(s => s.trim());
          if (parts.length < 2) return;

          let term = '', phonetic = '[]', pos = 'n.', meaning = '', phraseRaw = '';
          if (parts.length === 2) {
            [term, meaning] = parts;
          } else if (parts.length === 3) {
            [term, pos, meaning] = parts;
          } else {
            [term, phonetic, pos, meaning, phraseRaw = ''] = parts;
          }

          const parsedPhrases = phraseRaw
            ? phraseRaw
                .split(';')
                .map(pair => {
                  const [en, ch] = pair.split('=').map(s => (s || '').trim());
                  return en && ch ? { en, ch } : null;
                })
                .filter(Boolean)
            : [];

          if (term && meaning) {
            parsedCards.push({
              id: `${baseTs}_${idx}`,
              order: baseOrder + idx + 1,
              term,
              phonetic: phonetic || '[]',
              pos: pos || 'n.',
              meaning,
              category: batchCategory,
              phrases: parsedPhrases,
              mastery: 0,
              mistake: false,
            });
          }
        });
      }

      if (parsedCards.length === 0) {
        setBatchStatus('❌ 解析不到有效單字，請檢查格式');
        return;
      }

      // Firestore batch 上限 500 筆，分批寫入
      for (let i = 0; i < parsedCards.length; i += 400) {
        const chunk = parsedCards.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(c => {
          const ref = doc(db, 'artifacts', appId, 'users', user.uid, 'cards', c.id.toString());
          batch.set(ref, c);
        });
        await batch.commit();
      }

      setBatchText('');
      setBatchStatus(`✅ 成功匯入 ${parsedCards.length} 個單字！`);
      setTimeout(() => setBatchStatus(''), 4000);
    } catch (err) {
      console.error(err);
      setBatchStatus('❌ 匯入失敗：格式有誤 (' + err.message + ')');
    }
  };

  // 匯出 JSON 備份檔
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(cards, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vocab-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredList = useMemo(() => {
    return cards.filter(c => {
      const matchCat = filterCat === 'All' || c.category === filterCat;
      if (!matchCat) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const inTerm = (c.term || '').toLowerCase().includes(q);
      const inMeaning = (c.meaning || '').toLowerCase().includes(q);
      const inPhrases = (c.phrases || []).some(
        p => (p.en || '').toLowerCase().includes(q) || (p.ch || '').toLowerCase().includes(q)
      );
      return inTerm || inMeaning || inPhrases;
    });
  }, [cards, filterCat, searchQuery]);

  return (
    <div className="p-6 space-y-6">
      {/* 頂部功能切換 */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
        {[
          { id: 'single', label: editingId ? '✏️ 編輯中' : '➕ 單筆管理' },
          { id: 'batch', label: '📥 批次匯入' },
          { id: 'categories', label: '📁 分類整理' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setAdminSubTab(tab.id)}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              adminSubTab === tab.id
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 1. 單筆新增 / 編輯 */}
      {adminSubTab === 'single' && (
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              {editingId ? <Edit2 size={18} className="text-amber-400" /> : <Plus size={18} className="text-indigo-400" />}
              {editingId ? '編輯單字卡' : '新增單字卡'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded-lg bg-slate-800"
              >
                取消編輯
              </button>
            )}
          </div>

          <form onSubmit={handleSaveCard} className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={newTerm}
                onChange={e => setNewTerm(e.target.value)}
                placeholder="單字 (ex: ability)"
                required
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                value={newPhonetic}
                onChange={e => setNewPhonetic(e.target.value)}
                placeholder="音標 (ex: [əˋbɪlətɪ])"
                className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                list="pos-options"
                value={newPos}
                onChange={e => setNewPos(e.target.value)}
                placeholder="詞性 (n. / vt.)"
                className="w-1/3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
              <datalist id="pos-options">
                {['n.', 'v.', 'vt.', 'vi.', 'a.', 'adv.', 'prep.', 'conj.', 'vt. / n.'].map(p => (
                  <option key={p} value={p} />
                ))}
              </datalist>
              <input
                type="text"
                value={newMeaning}
                onChange={e => setNewMeaning(e.target.value)}
                placeholder="中文解釋"
                required
                className="w-2/3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <select
              value={selectedCat}
              onChange={e => setSelectedCat(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  📂 {cat}
                </option>
              ))}
            </select>

            {/* 相關片語編輯區 */}
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">相關片語 / 例句（選填，可考片語測驗）</span>
                <button
                  type="button"
                  onClick={() => setPhrases([...phrases, { en: '', ch: '' }])}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                >
                  + 新增一組片語
                </button>
              </div>
              {phrases.map((p, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={p.en}
                    onChange={e => {
                      const next = [...phrases];
                      next[idx].en = e.target.value;
                      setPhrases(next);
                    }}
                    placeholder="英文片語 (ex: have the ability to V)"
                    className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={p.ch}
                    onChange={e => {
                      const next = [...phrases];
                      next[idx].ch = e.target.value;
                      setPhrases(next);
                    }}
                    placeholder="中文解釋 (ex: 有做…的能力)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  />
                  {phrases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPhrases(phrases.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-500 hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="submit"
              className={`w-full font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] text-white ${
                editingId ? 'bg-amber-600 hover:bg-amber-500' : 'bg-indigo-600 hover:bg-indigo-500'
              }`}
            >
              {editingId ? '儲存修改' : '新增至資料庫'}
            </button>
          </form>
        </section>
      )}

      {/* 2. 批次匯入 & 備份匯出 */}
      {adminSubTab === 'batch' && (
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <Upload size={18} className="text-indigo-400" /> 批次匯入單字
            </h2>
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-cyan-400 border border-slate-700"
            >
              <Download size={14} /> 匯出備份 (.json)
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400">匯入至目標分類</label>
            <select
              value={batchCategory}
              onChange={e => setBatchCategory(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  📂 {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3 text-[11px] text-slate-400 space-y-1 leading-relaxed">
            <p className="font-bold text-slate-300">💡 支援 2 種格式直接貼上：</p>
            <p>1. <span className="text-indigo-400 font-semibold">文字格式（一行一字）</span>：<code className="text-slate-300">單字 | 音標 | 詞性 | 中文 | 片語英=片語中;片語2英=片語2中</code>（也支援只寫 <code className="text-slate-300">單字 | 中文</code>）</p>
            <p>2. <span className="text-cyan-400 font-semibold">JSON 陣列格式</span>：把課本拍照丟給 AI 轉換的 JSON 直接貼上即可。</p>
          </div>

          <textarea
            rows={6}
            value={batchText}
            onChange={e => setBatchText(e.target.value)}
            placeholder={`範例：\nabandon | [əˋbændən] | vt. | 放棄；遺棄 | abandon oneself to=沉溺於...\nbenefit | [ˋbɛnəfɪt] | n./vt. | 利益；使受益 | benefit from=從…獲益;for the benefit of=為了…的利益`}
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-xs font-mono text-slate-200 focus:border-indigo-500 focus:outline-none"
          />

          {batchStatus && (
            <p className="text-xs font-bold text-center text-indigo-300">{batchStatus}</p>
          )}

          <button
            type="button"
            onClick={handleBatchImport}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]"
          >
            一鍵寫入雲端資料庫
          </button>
        </section>
      )}

      {/* 3. 分類新增、改名、合併、拆分、刪除、排序管理 */}
      {adminSubTab === 'categories' && (
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg space-y-5">
          {catOpStatus && (
            <div className="bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-xs font-bold px-3.5 py-2.5 rounded-xl text-center">
              {catOpStatus}
            </div>
          )}

          {/* A. 新增科目 */}
          <div>
            <h2 className="text-sm font-bold text-slate-200 mb-2.5 flex items-center gap-2">
              <FolderPlus size={16} className="text-indigo-400" /> 1. 新增科目 / 單元
            </h2>
            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="例如：大考 1680 Unit 2"
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shrink-0"
              >
                新增
              </button>
            </form>
          </div>

          {/* B. 合併兩個科目 */}
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 mb-2">🔗 2. 合併兩個科目</h3>
            <form onSubmit={handleMergeCategories} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">將此科目（來源）</label>
                  <select
                    value={mergeSourceCat}
                    onChange={e => setMergeSourceCat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat} ({cards.filter(c => c.category === cat).length}字)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">併入此科目（目標）</label>
                  <select
                    value={mergeTargetCat}
                    onChange={e => setMergeTargetCat(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {cat} ({cards.filter(c => c.category === cat).length}字)
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold rounded-xl border border-slate-700"
              >
                確認合併科目（來源單字會接在目標科目後面）
              </button>
            </form>
          </div>

          {/* C. 拆分科目 */}
          <div className="pt-4 border-t border-slate-800 space-y-2.5">
            <h3 className="text-sm font-bold text-slate-200">✂️ 3. 拆開科目內容</h3>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">選擇要拆開的科目</label>
              <select
                value={splitSourceCat}
                onChange={e => setSplitSourceCat(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}（共 {cards.filter(c => c.category === cat).length} 字）
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSplitMode('range')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                  splitMode === 'range' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500'
                }`}
              >
                按序號區間拆出
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('chunk')}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${
                  splitMode === 'chunk' ? 'bg-slate-800 text-indigo-400' : 'text-slate-500'
                }`}
              >
                每 N 字自動拆成多科
              </button>
            </div>

            <form onSubmit={handleSplitCategory} className="space-y-2">
              {splitMode === 'range' ? (
                <>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">把第</span>
                    <input
                      type="number"
                      min={1}
                      value={splitStartSeq}
                      onChange={e => setSplitStartSeq(e.target.value)}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-center font-mono text-slate-200"
                    />
                    <span className="text-slate-400">～</span>
                    <input
                      type="number"
                      min={1}
                      value={splitEndSeq}
                      onChange={e => setSplitEndSeq(e.target.value)}
                      className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-center font-mono text-slate-200"
                    />
                    <span className="text-slate-400">號拆到：</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={splitTargetCat}
                      onChange={e => setSplitTargetCat(e.target.value)}
                      placeholder="輸入新科目名稱 (例: Unit 1-2)"
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold rounded-xl border border-slate-700 shrink-0"
                    >
                      拆出
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">每</span>
                  <input
                    type="number"
                    min={1}
                    value={splitChunkSize}
                    onChange={e => setSplitChunkSize(e.target.value)}
                    className="w-20 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-center font-mono text-xs text-slate-200"
                  />
                  <span className="text-xs text-slate-400">個字拆成一科</span>
                  <button
                    type="submit"
                    className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-bold rounded-xl border border-slate-700 shrink-0"
                  >
                    自動均分拆開
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* D. 重新命名科目 */}
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 mb-2">✏️ 4. 重新命名科目</h3>
            <form onSubmit={handleRenameCategory} className="space-y-2">
              <select
                value={renameCatFrom}
                onChange={e => setRenameCatFrom(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    原名稱：{cat} ({cards.filter(c => c.category === cat).length} 字)
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={renameCatTo}
                  onChange={e => setRenameCatTo(e.target.value)}
                  placeholder="輸入新科目名稱..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 shrink-0"
                >
                  確認改名
                </button>
              </div>
            </form>
          </div>

          {/* E. 單字序號與排序整理 */}
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-slate-200 mb-1.5">🔢 5. 資料庫序號整理</h3>
            <p className="text-[11px] text-slate-400 mb-2">
              匯入時預設依先後順序編號（#1, #2...），方便考試時指定第幾題到第幾題。
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleNormalizeOrder('keep')}
                className="py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800"
              >
                依匯入先後重新編號
              </button>
              <button
                type="button"
                onClick={() => handleNormalizeOrder('alpha')}
                className="py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800"
              >
                依字母 A-Z 重新排序
              </button>
            </div>
          </div>

          {/* F. 快速刪除整個科目 */}
          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-sm font-bold text-red-400 mb-2">🗑️ 6. 快速刪除整個科目</h3>
            <div className="space-y-2">
              <select
                value={deleteCatTarget}
                onChange={e => {
                  setDeleteCatTarget(e.target.value);
                  setConfirmDeleteCat(false);
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>
                    {cat}（含 {cards.filter(c => c.category === cat).length} 個單字）
                  </option>
                ))}
              </select>

              {!confirmDeleteCat ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteCat(true)}
                  className="w-full py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-xl border border-red-500/30"
                >
                  刪除此科目與底下所有單字
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteCategory}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl"
                  >
                    確定永久刪除「{deleteCatTarget}」
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCat(false)}
                    className="px-4 py-2.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 單字庫列表（含搜尋與分類篩選） */}
      <section className="space-y-3">
        <div className="flex justify-between items-center ml-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            資料庫內容 ({filteredList.length} / {cards.length})
          </h2>
        </div>

        {/* 搜尋與分類過濾列 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜尋單字、中文或片語..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none max-w-[140px]"
          >
            <option value="All">全部分類</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2.5">
          {filteredList.map(card => (
            <div
              key={card.id}
              className={`bg-slate-900 border rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors ${
                editingId === card.id.toString() ? 'border-amber-500/60' : 'border-slate-800'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300">
                    #{card.catSeq || card.globalSeq}
                  </span>
                  <h3 className="font-bold text-slate-200 truncate">{card.term}</h3>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                    {card.pos}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 whitespace-nowrap">
                    {card.category}
                  </span>
                  {card.phrases && card.phrases.length > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
                      片語×{card.phrases.length}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">{card.meaning}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="flex gap-1 mr-1" title={`熟練度 ${card.mastery}/2`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${card.mastery > 0 ? 'bg-green-500' : 'bg-slate-700'}`} />
                  <div className={`w-1.5 h-1.5 rounded-full ${card.mastery > 1 ? 'bg-green-500' : 'bg-slate-700'}`} />
                </div>
                <button
                  onClick={() => handleEditClick(card)}
                  title="編輯單字"
                  className="p-2 text-slate-400 hover:text-amber-400 bg-slate-800 rounded-xl transition-colors"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  onClick={() => handleDeleteCard(card.id)}
                  title="刪除單字"
                  className="p-2 text-slate-500 hover:text-red-400 bg-slate-800 rounded-xl transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}