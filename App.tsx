import React, { useState, useEffect, useRef } from 'react';
import { 
  PlusCircle, Trash2, Printer, Loader2, GraduationCap, 
  FileText, Presentation, GitGraph, Image as ImageIcon, X, ChevronLeft, Download,
  ExternalLink, Lock, ArrowRight, Upload, Users, Sparkles,
  Calendar, CalendarDays, CalendarRange, Clock, ShieldCheck, Crown, MessageCircle, Camera, RefreshCcw, LogOut, ArrowLeft,
  CheckCircle2, BrainCircuit, ScanLine, ChevronRight, Zap
} from 'lucide-react';
import { generateLessonPlan, extractTextFromImage, generateTest, correctTestWithIA } from './services/geminiService';
import { LessonPlan, LessonPlanRequest, Subject, PlanningType, GeneratedTest } from './types';

// Define the UserPlan type to resolve missing type errors
type UserPlan = 'free' | 'premium' | null;

// Use AIStudio type for window.aistudio to match existing declarations in the environment
declare global {
  interface Window {
    aistudio: any;
  }
}

const SUBJECTS: Subject[] = ['Matemática', 'Português', 'História', 'Geografia', 'Ciências', 'Biologia', 'Física', 'Química', 'Artes', 'Educação Física', 'Inglês', 'Outro'];

const GRADES = [
  'Educação Infantil (Creche)',
  'Educação Infantil (Pré-escola)',
  '1º Ano - Fundamental I',
  '2º Ano - Fundamental I',
  '3º Ano - Fundamental I',
  '4º Ano - Fundamental I',
  '5º Ano - Fundamental I',
  '6º Ano - Fundamental II',
  '7º Ano - Fundamental II',
  '8º Ano - Fundamental II',
  '9º Ano - Fundamental II',
  '1ª Série - Ensino Médio',
  '2ª Série - Ensino Médio',
  '3ª Série - Ensino Médio',
  'EJA - Fundamental',
  'EJA - Médio',
  'Ensino Superior',
  'Ensino Técnico / Profissionalizante'
];

const Logo = ({ size = "md", isPremium = false }: { size?: "sm" | "md" | "lg", isPremium?: boolean }) => (
  <div className="flex items-center gap-2 group">
    <div className={`relative flex items-center justify-center ${size === 'lg' ? 'h-20' : size === 'md' ? 'h-12' : 'h-8'} aspect-square rounded-2xl ${isPremium ? 'bg-amber-500' : 'bg-indigo-600'} transition-transform group-hover:rotate-3 shadow-lg`}>
      <GraduationCap className={`${size === 'lg' ? 'w-10 h-10' : 'w-6 h-6'} text-white`} />
      {isPremium && <Crown className="absolute -top-1 -right-1 w-4 h-4 text-white fill-white bg-amber-600 rounded-full p-0.5" />}
    </div>
    <div className="flex flex-col leading-none">
      <span className={`font-black tracking-tighter ${size === 'lg' ? 'text-4xl' : 'text-xl'} text-slate-900`}>EduPlan<span className={isPremium ? 'text-amber-500' : 'text-indigo-600'}>AI</span></span>
      <span className={`font-bold uppercase tracking-[0.2em] text-[8px] text-slate-400`}>Pedagogia Digital</span>
    </div>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);
  const [userPlan, setUserPlan] = useState<UserPlan>(null);
  const [loginCode, setLoginCode] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<LessonPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'test'>('plan');
  const [showHistory, setShowHistory] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraMode, setCameraMode] = useState<'ocr' | 'correct'>('ocr');
  const [isProcessingCamera, setIsProcessingCamera] = useState(false);
  const [correctionResult, setCorrectionResult] = useState<{ score: string, feedback: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [formData, setFormData] = useState<LessonPlanRequest>({ 
    subject: 'Matemática', 
    grade: '6º Ano - Fundamental II', 
    topic: '', 
    duration: '50 minutos', 
    planningType: 'Individual' 
  });

  useEffect(() => {
    checkAuth();
    checkApiKey();
  }, []);

  const checkAuth = () => {
    const auth = sessionStorage.getItem('eduplan_auth');
    const type = sessionStorage.getItem('eduplan_plan') as UserPlan;
    if (auth === 'true' && type) { 
      setIsAuthenticated(true); 
      setUserPlan(type); 
    }
    const saved = localStorage.getItem('eduplan_history');
    if (saved) setPlans(JSON.parse(saved));
  };

  const checkApiKey = async () => {
    if (window.aistudio) {
      const selected = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
    }
  };

  const handleConnectIA = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume the key selection was successful after triggering openSelectKey() to mitigate race conditions
      setHasApiKey(true);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginCode === '2026' || loginCode === '150718') { 
      const plan = loginCode === '150718' ? 'premium' : 'free';
      setIsAuthenticated(true); 
      setUserPlan(plan); 
      sessionStorage.setItem('eduplan_auth', 'true'); 
      sessionStorage.setItem('eduplan_plan', plan); 
    } else {
      setLoginError(true);
    }
  };

  const startCamera = (mode: 'ocr' | 'correct') => {
    setCameraMode(mode);
    setIsCameraActive(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }).then(stream => {
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => {
      alert("Acesso à câmera negado.");
      setIsCameraActive(false);
    });
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    setIsCameraActive(false);
  };

  const handleCameraCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsProcessingCamera(true);
    const context = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    context?.drawImage(videoRef.current, 0, 0);
    const base64 = canvasRef.current.toDataURL('image/jpeg').split(',')[1];
    
    try {
      if (cameraMode === 'ocr') {
        const text = await extractTextFromImage(base64, 'image/jpeg');
        if (text) setFormData(p => ({ ...p, topic: text }));
      } else if (cameraMode === 'correct' && currentPlan?.test) {
        const result = await correctTestWithIA(base64, currentPlan.test);
        setCorrectionResult(result);
      }
      stopCamera();
    } catch (e) { 
      alert("Erro ao processar imagem."); 
    }
    setIsProcessingCamera(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasApiKey && window.aistudio) {
      await handleConnectIA();
      return;
    }
    setIsLoading(true);
    try {
      const plan = await generateLessonPlan(formData);
      const updatedHistory = [plan, ...plans];
      setPlans(updatedHistory);
      setCurrentPlan(plan);
      setActiveTab('plan');
      localStorage.setItem('eduplan_history', JSON.stringify(updatedHistory));
    } catch (e: any) { 
      // If the request fails with "Requested entity was not found.", reset key selection state
      if (e.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        await handleConnectIA();
      } else {
        alert(e.message || "A IA não respondeu. Tente conectar novamente."); 
      }
    }
    setIsLoading(false);
  };

  const createTest = async (type: 'objective' | 'subjective') => {
    if (!currentPlan) return;
    setIsLoading(true);
    try {
      const test = await generateTest(currentPlan, type);
      const updatedPlan = { ...currentPlan, test };
      setCurrentPlan(updatedPlan);
      
      const updatedHistory = plans.map(p => p.id === currentPlan.id ? updatedPlan : p);
      setPlans(updatedHistory);
      localStorage.setItem('eduplan_history', JSON.stringify(updatedHistory));
    } catch (e: any) {
      if (e.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        await handleConnectIA();
      } else {
        alert("Erro ao gerar avaliação. Tente novamente.");
      }
    }
    setIsLoading(false);
  };

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <Logo size="lg" />
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
            <Zap className="w-3 h-3 fill-current" /> IA Conectada
          </div>
        </div>
        
        <form onSubmit={handleLogin} className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 space-y-6 shadow-2xl">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Senha do Professor</label>
            <input 
              type="password" 
              placeholder="Digite a senha para acessar o sistema" 
              value={loginCode} 
              onChange={e => { setLoginCode(e.target.value); setLoginError(false); }} 
              className={`w-full p-4 bg-slate-950 border ${loginError ? 'border-red-500' : 'border-slate-800'} rounded-2xl text-white outline-none focus:border-indigo-500 transition-colors font-bold text-center`} 
            />
          </div>
          <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all active:scale-95 shadow-xl shadow-indigo-900/40">ACESSAR SISTEMA</button>
          
          <div className="space-y-4 pt-4 border-t border-slate-800/50">
            <p className="text-[9px] text-slate-500 text-center font-bold uppercase tracking-widest leading-relaxed">O EduPlan utiliza tecnologia Google Gemini Flash para garantir planos de aula eficientes e inovadores para o seu dia a dia.</p>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 font-inter">
      <aside className={`fixed md:relative z-30 w-72 h-screen bg-white border-r transition-transform duration-300 ${showHistory ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b flex justify-between items-center">
          <Logo size="sm" isPremium={userPlan === 'premium'} />
          <button className="md:hidden p-2 text-slate-400" onClick={() => setShowHistory(false)}><X /></button>
        </div>
        <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-140px)]">
          <button onClick={() => { setCurrentPlan(null); setActiveTab('plan'); setShowHistory(false); }} className="w-full flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"><PlusCircle className="w-4 h-4" /> NOVO PLANO IA</button>
          
          {!hasApiKey && (
            <button onClick={handleConnectIA} className="w-full p-4 bg-amber-50 text-amber-600 border border-amber-200 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 animate-pulse">
              <Zap className="w-4 h-4 fill-current" /> Conectar a IA
            </button>
          )}

          <div className="space-y-2 pt-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Histórico Salvo</p>
            {plans.map(p => (
              <div key={p.id} onClick={() => { setCurrentPlan(p); setActiveTab('plan'); setShowHistory(false); }} className={`p-3 rounded-xl cursor-pointer transition-all border ${currentPlan?.id === p.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border-transparent'}`}>
                <p className="font-bold text-sm truncate text-slate-700">{p.title}</p>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{p.subject} • {p.planningType}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="p-4 border-t absolute bottom-0 w-full bg-white">
          <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} className="w-full flex items-center justify-center gap-2 text-slate-400 font-bold text-xs hover:text-red-500 transition-colors"><LogOut className="w-4 h-4" /> Sair da Conta</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="p-4 bg-white border-b flex justify-between items-center no-print shadow-sm z-10">
          <button className="md:hidden p-2 bg-slate-100 rounded-lg" onClick={() => setShowHistory(true)}><Calendar className="w-5 h-5" /></button>
          {currentPlan && (
            <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
              <button onClick={() => setActiveTab('plan')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'plan' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Plano</button>
              <button onClick={() => setActiveTab('test')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'test' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>Avaliação</button>
            </div>
          )}
          <div className="flex gap-2">
            {currentPlan && <button onClick={() => window.print()} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg"><Printer className="w-5 h-5" /></button>}
            <button onClick={() => startCamera('ocr')} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg transition-colors"><Camera className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-10">
          {isLoading && (
            <div className="fixed inset-0 z-50 bg-white/90 backdrop-blur-md flex flex-col items-center justify-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-amber-500 animate-bounce" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-lg font-black text-slate-900 uppercase tracking-tighter">A IA está gerando sua aula...</p>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Processando conteúdo alinhado à BNCC</p>
              </div>
            </div>
          )}

          {!currentPlan ? (
            <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-bottom-6 duration-700">
              <div className="text-center space-y-2">
                 <Logo size="lg" isPremium={userPlan === 'premium'} />
                 <p className="text-slate-400 font-medium text-sm">A inteligência pedagógica definitiva para o seu dia a dia.</p>
              </div>
              
              <form onSubmit={handleSubmit} className="bg-white p-8 md:p-12 rounded-[3rem] shadow-2xl border border-slate-100 space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matéria / Disciplina</label>
                    <select value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value as Subject })} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all">{SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ano / Série</label>
                    <select value={formData.grade} onChange={e => setFormData({ ...formData, grade: e.target.value })} className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all">{GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Conteúdo ou Habilidade BNCC</label>
                  <div className="relative group">
                    <textarea 
                      placeholder="Ex: Frações, Independência do Brasil, O Ciclo da Água..." 
                      value={formData.topic} 
                      onChange={e => setFormData({ ...formData, topic: e.target.value })} 
                      className="w-full p-5 bg-slate-50 border-none rounded-[2rem] h-40 font-bold resize-none text-slate-700 focus:ring-2 focus:ring-indigo-500 transition-all" 
                      required 
                    />
                    <button type="button" onClick={() => startCamera('ocr')} className="absolute bottom-4 right-4 p-3 bg-white text-indigo-600 rounded-xl shadow-lg border border-slate-100 hover:bg-indigo-50 transition-all"><Camera className="w-5 h-5" /></button>
                  </div>
                </div>

                <button disabled={isLoading} className="w-full py-6 bg-indigo-600 text-white rounded-3xl font-black text-xl flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 active:scale-[0.97]">
                  <Sparkles className="w-6 h-6" /> CRIAR PLANO AGORA
                </button>
              </form>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
              {activeTab === 'plan' && (
                <article className="bg-white p-8 md:p-16 rounded-[3.5rem] shadow-2xl border border-slate-100 space-y-12">
                  <div className="text-center pb-10 border-b-2 border-slate-100 relative">
                    <div className="absolute top-0 right-0">
                       <span className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter shadow-lg">{currentPlan.planningType}</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black uppercase text-slate-900 leading-[1.1] tracking-tighter">{currentPlan.title}</h1>
                    <div className="flex flex-wrap justify-center gap-2 mt-8">
                      {currentPlan.bnccCodes.map(code => (
                        <span key={code} className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-[11px] font-black border border-indigo-100 shadow-sm">{code}</span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                     <div className="md:col-span-2 space-y-10">
                        <section className="space-y-4">
                           <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-3"><FileText className="w-5 h-5" /> Desenvolvimento</h3>
                           <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-base font-medium bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 shadow-inner">{currentPlan.content}</div>
                        </section>
                        
                        <section className="space-y-4">
                           <h3 className="text-sm font-black text-indigo-600 uppercase tracking-[0.2em] flex items-center gap-3"><CheckCircle2 className="w-5 h-5" /> Objetivos</h3>
                           <ul className="grid gap-3">
                              {currentPlan.objectives.map((obj, i) => (
                                <li key={i} className="flex gap-4 p-4 bg-white border border-slate-100 rounded-2xl text-sm text-slate-600 font-bold shadow-sm transition-all hover:translate-x-1"><CheckCircle2 className="w-5 h-5 text-indigo-500 shrink-0" /> {obj}</li>
                              ))}
                           </ul>
                        </section>
                     </div>

                     <div className="space-y-10">
                        <section className="bg-indigo-600 p-8 rounded-[3rem] text-white shadow-2xl shadow-indigo-200">
                           <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 opacity-80">Metodologia</h3>
                           <p className="text-sm font-medium leading-relaxed">{currentPlan.methodology}</p>
                        </section>

                        <section className="bg-slate-900 p-8 rounded-[3rem] text-white border-b-4 border-indigo-500">
                           <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-6 opacity-80">Recursos</h3>
                           <div className="flex flex-wrap gap-2">
                              {currentPlan.resources.map((res, i) => (
                                <span key={i} className="bg-white/10 px-3 py-1.5 rounded-lg text-[10px] font-bold text-white border border-white/5 uppercase">{res}</span>
                              ))}
                           </div>
                        </section>

                        <section className="p-8 rounded-[3rem] border-2 border-dashed border-slate-200 space-y-4">
                           <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Avaliação</h3>
                           <p className="text-xs font-bold text-slate-600 leading-relaxed italic">"{currentPlan.assessment}"</p>
                        </section>
                     </div>
                  </div>
                </article>
              )}

              {activeTab === 'test' && (
                <div className="space-y-10">
                   {!currentPlan.test ? (
                     <div className="bg-white p-12 md:p-20 rounded-[3.5rem] text-center space-y-8 shadow-2xl border border-slate-100">
                        <div className="w-24 h-24 bg-indigo-100 rounded-full flex items-center justify-center mx-auto shadow-inner"><BrainCircuit className="w-12 h-12 text-indigo-600" /></div>
                        <div className="space-y-2">
                           <h2 className="text-3xl font-black uppercase text-slate-900">Avaliação IA</h2>
                           <p className="text-slate-400 text-sm max-w-xs mx-auto font-medium">Gere uma prova completa baseada no seu plano agora mesmo.</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                           <button onClick={() => createTest('objective')} className="px-10 py-5 bg-indigo-600 text-white rounded-3xl font-black text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">PROVA OBJETIVA</button>
                           <button onClick={() => createTest('subjective')} className="px-10 py-5 border-2 border-indigo-600 text-indigo-600 rounded-3xl font-black text-xs hover:bg-indigo-50 transition-all">PROVA SUBJETIVA</button>
                        </div>
                     </div>
                   ) : (
                      <article className="bg-white p-10 md:p-20 rounded-[3.5rem] shadow-2xl border border-slate-100 space-y-14">
                         <div className="text-center border-b-2 border-dashed pb-12 border-slate-200 space-y-4">
                            <Logo size="sm" isPremium />
                            <h2 className="text-3xl font-black uppercase mt-4 tracking-tight">Avaliação de Aprendizagem</h2>
                            <div className="flex justify-center gap-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                               <span>{currentPlan.grade}</span>
                               <span>•</span>
                               <span>{currentPlan.subject}</span>
                            </div>
                         </div>
                         <div className="space-y-12">
                            {currentPlan.test.questions.map(q => (
                              <div key={q.number} className="space-y-6">
                                 <div className="flex gap-5">
                                    <span className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black shrink-0 shadow-lg">{q.number}</span>
                                    <p className="font-black text-xl text-slate-800 leading-tight pt-2">{q.question}</p>
                                 </div>
                                 {q.options ? (
                                   <div className="grid gap-3 pl-16">
                                      {q.options.map((opt, i) => (
                                        <div key={i} className="text-sm font-bold text-slate-600 flex items-center gap-4 group cursor-default">
                                           <span className="w-8 h-8 border-2 border-slate-200 rounded-xl flex items-center justify-center text-[10px] font-black group-hover:border-indigo-400 transition-colors uppercase">{String.fromCharCode(65 + i)}</span> {opt}
                                        </div>
                                      ))}
                                   </div>
                                 ) : (
                                   <div className="h-32 border-b-2 border-slate-100 ml-16 relative">
                                      <span className="absolute bottom-2 left-0 text-[10px] font-black text-slate-200 uppercase">Espaço para resposta do aluno</span>
                                   </div>
                                 )}
                              </div>
                            ))}
                         </div>
                         <div className="mt-20 p-10 bg-slate-50 rounded-[3rem] border border-slate-200 no-print">
                            <h4 className="text-center font-black uppercase tracking-[0.3em] mb-8 text-slate-400 text-xs">Gabarito Oficial para o Professor</h4>
                            <div className="flex flex-wrap gap-4 justify-center">
                               {currentPlan.test.questions.map(q => (
                                 <div key={q.number} className="px-6 py-4 bg-white border-2 border-indigo-600 rounded-2xl flex items-center gap-3 shadow-sm">
                                    <span className="text-[10px] font-black text-slate-400">Q{q.number}</span>
                                    <span className="text-xl font-black text-indigo-600">{q.correctAnswer}</span>
                                 </div>
                               ))}
                            </div>
                         </div>
                      </article>
                   )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Camera Modal */}
      {isCameraActive && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6">
          <div className="relative w-full max-w-3xl aspect-[3/4] md:aspect-video bg-slate-900 overflow-hidden rounded-[3rem] shadow-2xl border-4 border-slate-800">
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
               <div className="w-64 h-64 md:w-80 md:h-80 border-4 border-indigo-500/50 rounded-3xl animate-pulse shadow-[0_0_100px_rgba(79,70,229,0.3)]" />
            </div>
            <button onClick={stopCamera} className="absolute top-8 right-8 p-4 bg-black/50 text-white rounded-full transition-transform active:scale-90"><X className="w-6 h-6" /></button>
            <div className="absolute bottom-12 inset-x-0 flex justify-center">
               <button onClick={handleCameraCapture} disabled={isProcessingCamera} className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-all border-8 border-slate-800">
                  {isProcessingCamera ? <Loader2 className="animate-spin text-indigo-600 w-10 h-10" /> : <div className="w-16 h-16 border-4 border-slate-100 rounded-full" />}
               </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan { 0% { top: 0; } 100% { top: 100%; } }
        @media print { .no-print { display: none !important; } }
        .font-inter { font-family: 'Inter', sans-serif; }
      `}</style>
    </div>
  );
};

export default App;