
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Stroke, ToolType, AppMode } from './types';
import CanvasEditor, { CanvasEditorRef } from './components/CanvasEditor';
import ComparisonView from './components/ComparisonView';
import StoryboardGenerator from './components/StoryboardGenerator';
import ImageSplitter from './components/ImageSplitter';
import { 
  BrushIcon, HandIcon, UndoIcon, TrashIcon, 
  UploadIcon, MagicIcon, DownloadIcon, CheckIcon,
  ArrowLeftIcon, ArrowRightIcon, HomeIcon, FilmIcon, GridSplitIcon
} from './components/Icons';
import { removeWatermark } from './services/geminiService';

// History State Interface
interface HistorySnapshot {
  appState: AppState;
  originalImage: string | null;
  processedImage: string | null;
  strokes: Stroke[];
}

const App: React.FC = () => {
  // Global Mode
  const [appMode, setAppMode] = useState<AppMode>(AppMode.HOME);

  // --- Watermark Feature State ---
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolType>(ToolType.BRUSH);
  const [brushSize, setBrushSize] = useState<number>(20);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [hasMask, setHasMask] = useState(false);
  const [loadingText, setLoadingText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Navigation History Stack (Watermark)
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const canvasRef = useRef<CanvasEditorRef>(null);

  // Helper: Restore state from snapshot
  const restoreSnapshot = (snapshot: HistorySnapshot) => {
    setAppState(snapshot.appState);
    setOriginalImage(snapshot.originalImage);
    setProcessedImage(snapshot.processedImage);
    setStrokes(snapshot.strokes);
    setHasMask(snapshot.strokes.length > 0);
    setErrorMsg(null);
  };

  // Helper: Record a new history entry (and clear future history if any)
  const pushNewState = (newState: HistorySnapshot) => {
    let currentHistory = [...history];
    if (historyIndex >= 0 && historyIndex < currentHistory.length) {
      currentHistory[historyIndex] = {
        appState,
        originalImage,
        processedImage,
        strokes: [...strokes] 
      };
    }
    const upToCurrent = currentHistory.slice(0, historyIndex + 1);
    const newHistory = [...upToCurrent, newState];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    restoreSnapshot(newState);
  };

  // Handlers
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newImage = event.target.result as string;
          const initialState: HistorySnapshot = {
            appState: AppState.EDIT,
            originalImage: newImage,
            processedImage: null,
            strokes: []
          };
          setHistory([initialState]);
          setHistoryIndex(0);
          restoreSnapshot(initialState);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleStartProcessing = async () => {
    if (!originalImage || !canvasRef.current) return;
    setAppState(AppState.PROCESSING);
    setLoadingText("magic郑正在施法前摇......");
    setErrorMsg(null);
    try {
      const maskDataUrl = canvasRef.current.getMaskDataURL();
      const result = await removeWatermark(originalImage, maskDataUrl);
      const resultState: HistorySnapshot = {
        appState: AppState.COMPARE,
        originalImage: originalImage,
        processedImage: result,
        strokes: strokes 
      };
      pushNewState(resultState);
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "处理失败，请重试。");
      setAppState(AppState.EDIT); 
    }
  };

  const handleUndo = () => setStrokes(prev => prev.slice(0, -1));
  const handleReset = () => setStrokes([]);
  
  const handleApplyEffect = () => {
    if (processedImage) {
      const newEditState: HistorySnapshot = {
        appState: AppState.EDIT,
        originalImage: processedImage,
        processedImage: null,
        strokes: []
      };
      pushNewState(newEditState);
    }
  };

  const handleDownload = () => {
    if (processedImage) {
      const link = document.createElement('a');
      link.href = processedImage;
      link.download = `magic-zheng-edited-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleResetWatermarkTool = () => {
    setAppState(AppState.UPLOAD);
    setOriginalImage(null);
    setProcessedImage(null);
    setStrokes([]);
    setHasMask(false);
    setHistory([]);
    setHistoryIndex(-1);
  };

  const handleBackToHome = () => {
    setAppMode(AppMode.HOME);
  };

  const handleStepBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      restoreSnapshot(history[newIndex]);
    } else {
      handleResetWatermarkTool();
    }
  };

  const handleStepForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      restoreSnapshot(history[newIndex]);
    }
  };

  const canGoBack = historyIndex > 0 || appState !== AppState.UPLOAD;
  const canGoForward = historyIndex < history.length - 1;

  // Render Tool Selection (Home)
  if (appMode === AppMode.HOME) {
      return (
        <div className="flex flex-col h-screen w-full bg-cyber-dark text-cyber-text font-sans items-center justify-center p-4">
             <div className="text-center mb-12">
                 <h1 className="text-5xl font-bold tracking-wider cyber-glitch mb-4">用户增长涨涨涨</h1>
                 <p className="text-cyber-dim text-lg">AI 图像增强工具箱</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
                 {/* Card 1: Watermark */}
                 <button 
                    onClick={() => setAppMode(AppMode.WATERMARK)}
                    className="group relative bg-cyber-panel border border-gray-800 rounded-2xl p-6 hover:border-cyber-secondary transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(244,63,94,0.2)] text-left"
                 >
                     <div className="absolute top-4 right-4 bg-cyber-secondary/20 text-cyber-secondary px-3 py-1 rounded-full text-xs font-mono border border-cyber-secondary/50">HOT</div>
                     <MagicIcon className="w-12 h-12 text-cyber-secondary mb-6 group-hover:scale-110 transition-transform" />
                     <h2 className="text-xl font-bold text-white mb-2">AI 去水印/消除</h2>
                     <p className="text-gray-400 text-sm">涂抹图像中不需要的物体、水印或瑕疵，AI 智能填充背景。</p>
                 </button>

                 {/* Card 2: Storyboard */}
                 <button 
                    onClick={() => setAppMode(AppMode.STORYBOARD)}
                    className="group relative bg-cyber-panel border border-gray-800 rounded-2xl p-6 hover:border-cyber-primary transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(6,182,212,0.2)] text-left"
                 >
                     <div className="absolute top-4 right-4 bg-cyber-primary/20 text-cyber-primary px-3 py-1 rounded-full text-xs font-mono border border-cyber-primary/50">NEW</div>
                     <FilmIcon className="w-12 h-12 text-cyber-primary mb-6 group-hover:scale-110 transition-transform" />
                     <h2 className="text-xl font-bold text-white mb-2">AI 分镜咒语生成</h2>
                     <p className="text-gray-400 text-sm">上传参考图，反推场景并生成 9 宫格分镜提示词，支持双语。</p>
                 </button>

                 {/* Card 3: Splitter */}
                 <button 
                    onClick={() => setAppMode(AppMode.SPLITTER)}
                    className="group relative bg-cyber-panel border border-gray-800 rounded-2xl p-6 hover:border-green-500 transition-all hover:-translate-y-2 hover:shadow-[0_0_30px_rgba(34,197,94,0.2)] text-left"
                 >
                     <GridSplitIcon className="w-12 h-12 text-green-500 mb-6 group-hover:scale-110 transition-transform" />
                     <h2 className="text-xl font-bold text-white mb-2">九宫格/拼图切片</h2>
                     <p className="text-gray-400 text-sm">批量上传图片，自定义行列数切分，一键打包下载 ZIP。</p>
                 </button>
             </div>
        </div>
      );
  }

  // Common Header for Tools
  return (
    <div className="flex flex-col h-screen w-full bg-cyber-dark text-cyber-text font-sans">
      <header className="h-16 border-b border-gray-800 bg-cyber-panel flex items-center justify-between px-6 shadow-lg z-20 shrink-0">
        <div className="flex items-center gap-4">
           {/* Home Button */}
           <button 
             onClick={handleBackToHome}
             className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
             title="返回主页"
           >
             <HomeIcon className="w-5 h-5" />
           </button>

           <div className="h-6 w-px bg-gray-700"></div>

           {/* Watermark Specific Navigation */}
           {appMode === AppMode.WATERMARK && (
              <div className="flex items-center gap-2">
                 <button 
                   onClick={handleStepBack}
                   disabled={!canGoBack || appState === AppState.PROCESSING}
                   className={`p-2 rounded-lg border border-gray-700 transition-all ${canGoBack && appState !== AppState.PROCESSING ? 'hover:text-cyber-secondary hover:border-cyber-secondary' : 'opacity-30 cursor-not-allowed'}`}
                 >
                   <ArrowLeftIcon className="w-5 h-5" />
                 </button>
                 <button 
                   onClick={handleStepForward}
                   disabled={!canGoForward || appState === AppState.PROCESSING}
                   className={`p-2 rounded-lg border border-gray-700 transition-all ${canGoForward && appState !== AppState.PROCESSING ? 'hover:text-cyber-secondary hover:border-cyber-secondary' : 'opacity-30 cursor-not-allowed'}`}
                 >
                   <ArrowRightIcon className="w-5 h-5" />
                 </button>
              </div>
           )}

           {appMode === AppMode.STORYBOARD && (
             <div className="flex items-center gap-2 text-cyber-primary font-bold">
                <FilmIcon className="w-5 h-5" />
                <span>分镜咒语生成器</span>
             </div>
           )}

           {appMode === AppMode.SPLITTER && (
             <div className="flex items-center gap-2 text-green-500 font-bold">
                <GridSplitIcon className="w-5 h-5" />
                <span>九宫格切片器</span>
             </div>
           )}
        </div>
        
        {/* Title / Logo */}
        <div className="hidden md:flex items-center gap-2 opacity-50">
             <div className={`w-3 h-3 rounded-full ${
                appMode === AppMode.WATERMARK ? 'bg-cyber-secondary' : 
                appMode === AppMode.STORYBOARD ? 'bg-cyber-primary' : 'bg-green-500'
             }`}></div>
             <span className="text-sm font-mono tracking-widest">用户增长涨涨涨 v1.0</span>
        </div>
      </header>

      {/* --- CONTENT FOR WATERMARK MODE --- */}
      {appMode === AppMode.WATERMARK && (
          <>
            <main className="flex-1 relative overflow-hidden flex items-center justify-center">
                {appState === AppState.UPLOAD && (
                <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-xl hover:border-cyber-secondary transition-colors bg-cyber-panel/50 backdrop-blur-sm group">
                    <UploadIcon className="w-16 h-16 mx-auto mb-4 text-gray-500 group-hover:text-cyber-secondary transition-colors" />
                    <h2 className="text-2xl font-bold mb-2">上传图片 (去水印)</h2>
                    <p className="text-gray-400 mb-6">涂抹消除任意物体</p>
                    <label className="bg-cyber-secondary hover:bg-rose-600 text-white font-bold py-3 px-8 rounded cursor-pointer transition-transform active:scale-95 shadow-[0_0_15px_rgba(244,63,94,0.4)]">
                    选择文件
                    <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
                    </label>
                </div>
                )}

                {appState === AppState.EDIT && originalImage && (
                <CanvasEditor 
                    ref={canvasRef}
                    imageSrc={originalImage}
                    tool={tool}
                    brushSize={brushSize}
                    onMaskChange={setHasMask}
                    strokes={strokes}
                    setStrokes={setStrokes}
                />
                )}

                {appState === AppState.PROCESSING && (
                <div className="absolute inset-0 bg-cyber-dark/90 z-50 flex flex-col items-center justify-center">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-cyber-dim rounded-full opacity-20"></div>
                        <div className="absolute inset-0 border-4 border-t-cyber-secondary border-r-transparent border-b-cyber-primary border-l-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-xl font-mono animate-pulse text-cyber-secondary">{loadingText}</p>
                </div>
                )}

                {appState === AppState.COMPARE && originalImage && processedImage && (
                <ComparisonView originalSrc={originalImage} processedSrc={processedImage} />
                )}

                {errorMsg && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-6 py-3 rounded border border-red-500 shadow-xl z-50">
                    {errorMsg}
                    <button onClick={() => setErrorMsg(null)} className="ml-4 font-bold">X</button>
                </div>
                )}
            </main>

            {/* Footer for Watermark */}
            {appState !== AppState.UPLOAD && appState !== AppState.PROCESSING && (
                <footer className="h-20 bg-cyber-panel border-t border-gray-800 flex items-center justify-center px-4 md:px-8 gap-4 md:gap-8 z-20 shrink-0">
                    {appState === AppState.EDIT && (
                        <>
                        <div className="flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700">
                            <button onClick={() => setTool(ToolType.BRUSH)} className={`p-3 rounded ${tool === ToolType.BRUSH ? 'bg-cyber-secondary text-white' : 'text-gray-400'}`}><BrushIcon /></button>
                            <button onClick={() => setTool(ToolType.HAND)} className={`p-3 rounded ${tool === ToolType.HAND ? 'bg-cyber-primary text-black' : 'text-gray-400'}`}><HandIcon /></button>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 rounded-lg border border-gray-700 w-48 hidden sm:flex">
                            <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyber-secondary [&::-webkit-slider-thumb]:rounded-full" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={handleUndo} className="p-3 text-gray-400 hover:text-white"><UndoIcon /></button>
                            <button onClick={handleReset} className="p-3 text-gray-400 hover:text-red-500"><TrashIcon /></button>
                        </div>
                        <div className="h-8 w-px bg-gray-700 mx-2"></div>
                        <button onClick={handleStartProcessing} disabled={!hasMask} className={`flex items-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${hasMask ? 'bg-gradient-to-r from-cyber-secondary to-purple-600 text-white' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}>
                            <MagicIcon /> <span className="hidden md:inline">开始消除</span>
                        </button>
                        </>
                    )}
                    {appState === AppState.COMPARE && (
                        <>
                        <button onClick={handleApplyEffect} className="flex items-center gap-2 px-5 py-2 rounded border border-cyber-secondary text-cyber-secondary font-bold"><CheckIcon /> 应用</button>
                        <button onClick={handleDownload} className="flex items-center gap-2 px-6 py-3 rounded bg-cyber-secondary text-white font-bold"><DownloadIcon /> 下载</button>
                        <button onClick={handleResetWatermarkTool} className="px-4 py-2 text-gray-400 hover:text-white border border-gray-700 rounded">新图</button>
                        </>
                    )}
                </footer>
            )}
          </>
      )}

      {/* --- CONTENT FOR STORYBOARD MODE --- */}
      {appMode === AppMode.STORYBOARD && (
         <main className="flex-1 overflow-hidden bg-cyber-dark">
             <StoryboardGenerator />
         </main>
      )}

      {/* --- CONTENT FOR SPLITTER MODE --- */}
      {appMode === AppMode.SPLITTER && (
          <main className="flex-1 overflow-hidden bg-cyber-dark">
              <ImageSplitter />
          </main>
      )}

    </div>
  );
};

export default App;
