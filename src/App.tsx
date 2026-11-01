import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BookOpen, Database, Plus, ChevronLeft, ChevronRight, RotateCcw, Trash2, GraduationCap, BrainCircuit, Check, X, ArrowRight, RotateCw, Volume2, Cloud, LogOut } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, updateDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';

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

export default function App() {
  const [activeTab, setActiveTab] = useState('learn'); // 'learn', 'quiz', 'admin'
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [cards, setCards] = useState([]);
  const [user, setUser] = useState(null);
  const [isSyncing, setIsSyncing] = useState(true);
  const [authReady, setAuthReady] = useState(false);

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
        INITIAL_CARDS.forEach(async (card) => {
          await setDoc(doc(cardsRef, card.id.toString()), { ...card, id: card.id.toString() });
        });
      } else {
        const loaded = snapshot.docs.map(d => d.data());
        // Sort by id to keep original order roughly
        setCards(loaded.sort((a,b) => Number(a.id) - Number(b.id)));
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

  const resetProgress = useCallback(async (category = 'All') => {
    if (!user) return;
    cards.forEach(async (card) => {
      if (category === 'All' || card.category === category || (category === '錯題本' && card.mistake)) {
         try {
           await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', card.id.toString()), {
             mastery: 0,
             mistake: false
           });
         } catch(e) {}
      }
    });
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans sm:bg-slate-900 sm:py-8 select-none">
      <style dangerouslySetInnerHTML={{ __html: customCss }} />
      
      <div className="w-full h-[100dvh] sm:h-[850px] max-w-md mx-auto bg-slate-950 sm:rounded-[2.5rem] sm:shadow-2xl sm:border-8 border-slate-900 flex flex-col overflow-hidden relative">
        
        <header className="px-6 py-4 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md z-10 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                <GraduationCap size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-2">
                  智能單字庫 {user && !isSyncing && <Cloud size={18} className="text-cyan-400" />}
                </h1>
                <p className="text-xs text-slate-500 font-medium">1680 大考必備</p>
              </div>
            </div>
            <button onClick={() => signOut(auth)} title={user.email || '登出'} className="p-2 text-slate-500 hover:text-slate-300 bg-slate-900 rounded-xl transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto pb-24 bg-slate-950">
          {activeTab === 'learn' && <LearnView categories={categories} cards={cards} />}
          {activeTab === 'quiz' && <QuizView categories={categories} cards={cards} updateCardMastery={updateCardMastery} resetProgress={resetProgress} />}
          {activeTab === 'admin' && <AdminView categories={categories} setCategories={setCategories} cards={cards} user={user} />}
        </main>

        <nav className="absolute bottom-0 w-full bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 pb-safe pt-2 px-4 pb-6 flex justify-around items-center z-20">
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
      className={`flex flex-col items-center p-3 transition-all duration-300 w-20 ${isActive ? 'text-indigo-400 transform -translate-y-1' : 'text-slate-500 hover:text-slate-300'}`}
    >
      <Icon size={24} className={`mb-1.5 ${isActive ? 'drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]' : ''}`} />
      <span className="text-[11px] font-bold">{label}</span>
      {isActive && <div className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-400" />}
    </button>
  );
}

// --- LEARN VIEW COMPONENTS ---

function LearnView({ categories, cards }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const filteredCards = activeCategory === 'All' ? cards 
                      : activeCategory === '錯題本' ? cards.filter(c => c.mistake)
                      : cards.filter(c => c.category === activeCategory);

  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [activeCategory]);

  const handleNext = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev + 1) % filteredCards.length), 150);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setTimeout(() => setCurrentIndex((prev) => (prev - 1 + filteredCards.length) % filteredCards.length), 150);
  };

  return (
    <div className="flex flex-col h-full">
      <CategorySelector categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />

      <div className="flex-1 flex flex-col justify-center items-center px-6 py-2 pb-8">
        {filteredCards.length > 0 ? (
          <>
            <div className="w-full flex justify-between items-center text-sm font-medium text-slate-500 mb-4 px-2">
              <span>{filteredCards[currentIndex].category}</span>
              <span>{currentIndex + 1} / {filteredCards.length}</span>
            </div>
            
            <div 
              className="w-full aspect-[3/4] max-h-[420px] perspective-1000 cursor-pointer group"
              onClick={() => setIsFlipped(!isFlipped)}
            >
              <div className={`relative w-full h-full transform-style-3d transition-transform duration-500 ease-out ${isFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* Front */}
                <div className="absolute inset-0 backface-hidden bg-slate-900 border border-slate-800 rounded-[2rem] shadow-xl flex flex-col items-center justify-center p-8 text-center group-hover:border-indigo-500/50 transition-colors">
                  <RotateCcw size={20} className="absolute top-6 right-6 text-slate-600" />
                  <div className="flex flex-col items-center justify-center mb-3">
                    <h2 className="text-4xl font-extrabold text-slate-50 tracking-wide mb-3">{filteredCards[currentIndex].term}</h2>
                    <button 
                      onClick={(e) => { e.stopPropagation(); playAudio(filteredCards[currentIndex].term); }} 
                      className="p-3 bg-indigo-500/10 text-indigo-400 rounded-full hover:bg-indigo-500/30 transition-colors active:scale-95"
                    >
                      <Volume2 size={28} />
                    </button>
                  </div>
                  <p className="text-lg text-indigo-300/80 font-mono tracking-wider">{filteredCards[currentIndex].phonetic}</p>
                </div>

                {/* Back */}
                <div className="absolute inset-0 backface-hidden rotate-y-180 bg-slate-800 border border-indigo-500/30 rounded-[2rem] shadow-xl flex flex-col p-6 overflow-y-auto no-scrollbar">
                  <div className="mb-4 pb-4 border-b border-slate-700/50">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">{filteredCards[currentIndex].pos}</span>
                      <h3 className="text-xl font-bold text-slate-100">{filteredCards[currentIndex].meaning}</h3>
                    </div>
                  </div>
                  
                  {filteredCards[currentIndex].phrases && filteredCards[currentIndex].phrases.length > 0 && (
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">相關片語</h4>
                      <div className="space-y-3">
                        {filteredCards[currentIndex].phrases.map((phrase, idx) => (
                          <div key={idx} className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
                            <div className="flex items-start justify-between gap-2 mb-1">
                              <p className="text-sm font-semibold text-slate-200">{phrase.en}</p>
                              <button 
                                onClick={(e) => { e.stopPropagation(); playAudio(phrase.en); }}
                                className="text-indigo-400 p-1 bg-indigo-500/10 hover:bg-indigo-500/30 rounded transition-colors shrink-0"
                              >
                                <Volume2 size={16} />
                              </button>
                            </div>
                            <p className="text-sm text-slate-400">{phrase.ch}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 mt-8">
              <button onClick={handlePrev} className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:text-white transition-colors active:scale-95"><ChevronLeft size={24} /></button>
              <button onClick={() => setIsFlipped(!isFlipped)} className="flex-1 py-3.5 rounded-2xl bg-indigo-600/20 text-indigo-400 font-bold active:scale-95 transition-all border border-indigo-500/30">
                {isFlipped ? '看單字' : '看解釋'}
              </button>
              <button onClick={handleNext} className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:text-white transition-colors active:scale-95"><ChevronRight size={24} /></button>
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
  
  // Quiz State
  const [question, setQuestion] = useState(null);
  const [inputVal, setInputVal] = useState('');
  const [feedback, setFeedback] = useState(null); // 'correct', 'wrong', null
  const [showAnswer, setShowAnswer] = useState(false);
  const [quizMode, setQuizMode] = useState('mixed'); // 'mixed', 'mc_meaning', 'mc_phrase', 'spelling'

  // Active pool: Cards not yet fully mastered (mastery < 2)
  const pool = useMemo(() => {
    const filtered = activeCategory === 'All' ? cards 
                   : activeCategory === '錯題本' ? cards.filter(c => c.mistake)
                   : cards.filter(c => c.category === activeCategory);
    return filtered.filter(c => c.mastery < 2);
  }, [cards, activeCategory]);

  const totalInCat = useMemo(() => {
    return activeCategory === 'All' ? cards.length 
         : activeCategory === '錯題本' ? cards.filter(c => c.mistake).length
         : cards.filter(c => c.category === activeCategory).length;
  }, [cards, activeCategory]);
  
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
      if (targetCard.mastery === 1) {
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
    if (question.type === 'mc_phrase') isCorrect = (answer === question.targetPhrase.en);
    if (question.type === 'spelling') isCorrect = (inputVal.trim().toLowerCase() === question.card.term.toLowerCase());

    setFeedback(isCorrect ? 'correct' : 'wrong');
    setShowAnswer(true);

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
    <div className="flex flex-col h-full">
      <CategorySelector categories={categories} activeCategory={activeCategory} setActiveCategory={setActiveCategory} />
      
      {/* Quiz Mode Selector */}
      <div className="px-6 py-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'mixed', label: '🧠 智能綜合' },
            { id: 'mc_meaning', label: '🎯 字義選擇' },
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

      <div className="px-6 py-1">
        <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
          <span>學習進度</span>
          <span className="text-indigo-400">{progressPercent}%</span>
        </div>
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="px-6 py-4 flex-1 flex flex-col">
        {!question ? (
           <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-4 border border-green-500/30">
              <Check size={40} className="text-green-400" />
            </div>
            <h3 className="text-2xl font-bold text-slate-100 mb-2">全部學會了！</h3>
            <p className="text-slate-400 mb-8 max-w-[250px]">
              {activeCategory === '錯題本' ? '太棒了！您的錯題本目前是空的！' : '此分類的單字皆已熟悉，或目前無符合此題型的單字！'}
            </p>
            {activeCategory !== '錯題本' && (
              <button 
                onClick={() => resetProgress(activeCategory)}
                className="flex items-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-full font-bold transition-all border border-slate-700 active:scale-95"
              >
                <RotateCw size={18} /> 重新測驗
              </button>
            )}
           </div>
        ) : (
          <div className="flex-1 flex flex-col max-w-sm w-full mx-auto">
            
            {/* Question Card */}
            <div className={`bg-slate-900 border ${feedback === 'correct' ? 'border-green-500/50 shadow-[0_0_15px_rgba(34,197,94,0.2)]' : feedback === 'wrong' ? 'border-red-500/50 animate-shake' : 'border-slate-800'} rounded-[2rem] p-6 shadow-xl mb-6 transition-all`}>
              
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex justify-between items-center">
                <span>{question.type === 'spelling' ? '📝 拼字測驗' : question.type === 'mc_phrase' ? '🧩 片語測驗' : '🎯 字義測驗'}</span>
                {feedback === 'wrong' && <span className="text-red-400">需複習</span>}
              </div>

              {question.type === 'mc_meaning' && (
                <div className="text-center py-4">
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-sm font-bold mb-3">{question.card.pos}</span>
                  <div className="flex justify-center items-center gap-3 mb-2">
                    <h2 className="text-3xl font-extrabold text-slate-50">{question.card.term}</h2>
                    <button 
                      onClick={() => playAudio(question.card.term)} 
                      className="p-2 bg-indigo-500/10 text-indigo-400 rounded-full hover:bg-indigo-500/30 transition-colors active:scale-95"
                    >
                      <Volume2 size={24} />
                    </button>
                  </div>
                  <p className="text-indigo-400 font-mono">{question.card.phonetic}</p>
                </div>
              )}

              {question.type === 'mc_phrase' && (
                <div className="text-center py-4">
                   <h2 className="text-xl font-bold text-slate-100 leading-snug">{question.targetPhrase.ch}</h2>
                </div>
              )}

              {question.type === 'spelling' && (
                <div className="text-center py-4">
                  <span className="inline-block px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 text-sm font-bold mb-2">{question.card.pos}</span>
                  <h2 className="text-2xl font-bold text-slate-100 mb-2">{question.card.meaning}</h2>
                  <p className="text-slate-500 font-mono">{question.card.phonetic}</p>
                </div>
              )}
            </div>

            {/* Answer Area */}
            <div className="flex-1 flex flex-col gap-3">
              {(question.type === 'mc_meaning' || question.type === 'mc_phrase') && question.options.map((opt, idx) => {
                let btnClass = "bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700";
                
                if (showAnswer) {
                  const isCorrectAnswer = question.type === 'mc_meaning' ? opt === question.card.meaning : opt === question.targetPhrase.en;
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
                    className={`w-full p-4 rounded-2xl border text-left font-medium transition-all active:scale-[0.98] ${btnClass}`}
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
                      <div className="absolute -bottom-10 left-0 right-0 text-center text-green-400 font-bold tracking-widest text-lg">
                        {question.card.term}
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
                  className="mt-auto py-4 bg-slate-800 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all border border-slate-700"
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

function CategorySelector({ categories, activeCategory, setActiveCategory }) {
  return (
    <div className="py-3 pl-6 pr-2 shrink-0">
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 pr-6">
        {['All', '錯題本', ...categories].map(cat => {
          const label = cat === 'All' ? '全部單字' : cat === '錯題本' ? '⚠️ 錯題本' : cat;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                activeCategory === cat 
                  ? 'bg-indigo-500 text-white border-indigo-500 shadow-lg shadow-indigo-500/20' 
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
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
  const [newTerm, setNewTerm] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newPos, setNewPos] = useState('n.');
  const [selectedCat, setSelectedCat] = useState(categories[0] || '');

  const handleAddCard = async (e) => {
    e.preventDefault();
    if (newTerm.trim() && newMeaning.trim() && selectedCat && user) {
      const newId = Date.now().toString();
      const newCard = {
        id: newId,
        term: newTerm.trim(),
        meaning: newMeaning.trim(),
        phonetic: newPhonetic.trim() || '[]',
        pos: newPos,
        phrases: [], // simplified for manual entry, can be expanded
        category: selectedCat,
        mastery: 0,
        mistake: false
      };
      
      try {
        await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', newId), newCard);
        setNewTerm('');
        setNewMeaning('');
        setNewPhonetic('');
      } catch(error) {
        console.error("Error adding card: ", error);
      }
    }
  };

  const handleDeleteCard = async (id) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'cards', id.toString()));
    } catch(error) {
      console.error("Error deleting card: ", error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg">
        <h2 className="text-base font-bold text-slate-200 mb-4 flex items-center gap-2">
          <Plus size={18} className="text-indigo-400" /> 快速新增單字
        </h2>
        
        <form onSubmit={handleAddCard} className="space-y-3">
          <div className="flex gap-3">
            <input 
              type="text" value={newTerm} onChange={e => setNewTerm(e.target.value)}
              placeholder="單字 (ex: apple)" required
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
            <input 
              type="text" value={newPhonetic} onChange={e => setNewPhonetic(e.target.value)}
              placeholder="音標 (ex: [æpl])"
              className="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          
          <div className="flex gap-3">
            <select 
              value={newPos} onChange={e => setNewPos(e.target.value)}
              className="w-1/3 bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none appearance-none"
            >
              {['n.', 'v.', 'vt.', 'vi.', 'a.', 'adv.', 'prep.', 'conj.'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <input 
              type="text" value={newMeaning} onChange={e => setNewMeaning(e.target.value)}
              placeholder="中文解釋" required
              className="w-2/3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <select 
            value={selectedCat} onChange={e => setSelectedCat(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none appearance-none"
          >
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>

          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98]">
            新增至資料庫
          </button>
        </form>
      </section>

      <section>
        <div className="flex justify-between items-center mb-3 ml-1">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">資料庫內容 ({cards.length})</h2>
        </div>
        <div className="space-y-3">
          {cards.map(card => (
            <div key={card.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3 group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-slate-200 truncate">{card.term}</h3>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 whitespace-nowrap">{card.category}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{card.meaning}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Visual indicator of mastery */}
                <div className="flex gap-1 mr-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${card.mastery > 0 ? 'bg-green-500' : 'bg-slate-700'}`} />
                  <div className={`w-1.5 h-1.5 rounded-full ${card.mastery > 1 ? 'bg-green-500' : 'bg-slate-700'}`} />
                </div>
                <button onClick={() => handleDeleteCard(card.id)} className="p-2 text-slate-500 hover:text-red-400 bg-slate-800 rounded-xl transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}