import React, { useState, useRef, useEffect } from 'react';
import { AppState, Stroke, ToolType } from './types';
import CanvasEditor, { CanvasEditorRef } from './components/CanvasEditor';
import ComparisonView from './components/ComparisonView';
import { 
  BrushIcon, HandIcon, UndoIcon, TrashIcon, 
  UploadIcon, MagicIcon, DownloadIcon, CheckIcon,
  ArrowLeftIcon, ArrowRightIcon
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
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolType>(ToolType.BRUSH);
  const [brushSize, setBrushSize] = useState<number>(20);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [hasMask, setHasMask] = useState(false);
  const [loadingText, setLoadingText] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Navigation History Stack
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
    // 1. Capture the current state (before transition) into the current history slot
    // This ensures that if we go back, we see the state exactly as we left it (e.g. with strokes)
    let currentHistory = [...history];
    
    if (historyIndex >= 0 && historyIndex < currentHistory.length) {
      currentHistory[historyIndex] = {
        appState,
        originalImage,
        processedImage,
        strokes: [...strokes] // Save current strokes
      };
    }
    
    // 2. Discard any future history (redo stack)
    const upToCurrent = currentHistory.slice(0, historyIndex + 1);
    
    // 3. Add new state
    const newHistory = [...upToCurrent, newState];
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    
    // 4. Apply new state to UI
    restoreSnapshot(newState);
  };

  // Handlers
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const newImage = event.target.result as string;
          
          // Initial State for a new file
          const initialState: HistorySnapshot = {
            appState: AppState.EDIT,
            originalImage: newImage,
            processedImage: null,
            strokes: []
          };

          // Reset history completely for new upload
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
      
      // Create the new snapshot for the result view
      const resultState: HistorySnapshot = {
        appState: AppState.COMPARE,
        originalImage: originalImage,
        processedImage: result,
        strokes: strokes // Keep strokes in memory but they might not show in compare view
      };

      pushNewState(resultState);

    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "处理失败，请重试。");
      setAppState(AppState.EDIT); // Revert UI to edit mode if failed
    }
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleReset = () => {
    setStrokes([]);
  };

  const handleApplyEffect = () => {
    if (processedImage) {
      // Create new edit state with the processed image as the new original
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

  const handleBackToHome = () => {
    // Completely reset app
    setAppState(AppState.UPLOAD);
    setOriginalImage(null);
    setProcessedImage(null);
    setStrokes([]);
    setHasMask(false);
    setHistory([]);
    setHistoryIndex(-1);
  };

  // Logic for Back Button
  const handleStepBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      restoreSnapshot(history[newIndex]);
    } else {
      handleBackToHome();
    }
  };

  // Logic for Forward Button
  const handleStepForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      restoreSnapshot(history[newIndex]);
    }
  };

  const canGoBack = historyIndex > 0 || appState !== AppState.UPLOAD;
  const canGoForward = historyIndex < history.length - 1;

  return (
    <div className="flex flex-col h-screen w-full bg-cyber-dark text-cyber-text font-sans">
      
      {/* HEADER */}
      <header className="h-16 border-b border-gray-800 bg-cyber-panel flex items-center justify-between px-6 shadow-lg z-20">
        <div className="flex items-center gap-4">
           
           {/* Navigation Controls */}
           <div className="flex items-center gap-2">
             {/* Back Button */}
             <button 
               onClick={handleStepBack}
               disabled={!canGoBack || appState === AppState.PROCESSING}
               className={`group flex items-center justify-center p-2 rounded-lg border border-gray-700 transition-all
                 ${canGoBack && appState !== AppState.PROCESSING
                   ? 'bg-gray-900/50 hover:bg-cyber-primary/20 hover:border-cyber-primary text-gray-300 hover:text-cyber-primary' 
                   : 'opacity-30 cursor-not-allowed text-gray-600 border-gray-800'}
               `}
               title="返回上一步"
             >
               <ArrowLeftIcon className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
             </button>

             {/* Forward Button */}
             <button 
               onClick={handleStepForward}
               disabled={!canGoForward || appState === AppState.PROCESSING}
               className={`group flex items-center justify-center p-2 rounded-lg border border-gray-700 transition-all
                 ${canGoForward && appState !== AppState.PROCESSING
                   ? 'bg-gray-900/50 hover:bg-cyber-primary/20 hover:border-cyber-primary text-gray-300 hover:text-cyber-primary' 
                   : 'opacity-30 cursor-not-allowed text-gray-600 border-gray-800'}
               `}
               title="下一步"
             >
               <ArrowRightIcon className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
             </button>
           </div>

           {/* Divider */}
           <div className="h-6 w-px bg-gray-700"></div>

           {/* Logo */}
           <div className="flex items-center gap-2 cursor-pointer group" onClick={handleBackToHome}>
              <div className="w-4 h-4 bg-cyber-primary rounded-full animate-pulse shadow-[0_0_10px_#06b6d4]"></div>
              <h1 className="text-xl font-bold tracking-wider cyber-glitch group-hover:opacity-80 transition-opacity">
                用户增长涨涨涨
              </h1>
           </div>
        </div>
        
        {appState === AppState.EDIT && (
           <div className="text-xs text-cyber-dim font-mono hidden md:block">
              MODE: EDIT // MASK_POINTS: {strokes.length}
           </div>
        )}
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 relative overflow-hidden flex items-center justify-center">
        
        {/* State: UPLOAD */}
        {appState === AppState.UPLOAD && (
          <div className="text-center p-10 border-2 border-dashed border-gray-700 rounded-xl hover:border-cyber-primary transition-colors bg-cyber-panel/50 backdrop-blur-sm group">
            <UploadIcon className="w-16 h-16 mx-auto mb-4 text-gray-500 group-hover:text-cyber-primary transition-colors" />
            <h2 className="text-2xl font-bold mb-2">上传图片</h2>
            <p className="text-gray-400 mb-6">支持 JPG, PNG. 自动识别水印</p>
            <label className="bg-cyber-primary hover:bg-cyan-400 text-black font-bold py-3 px-8 rounded cursor-pointer transition-transform active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.4)]">
              选择文件
              <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
            </label>
          </div>
        )}

        {/* State: EDIT */}
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

        {/* State: PROCESSING */}
        {appState === AppState.PROCESSING && (
           <div className="absolute inset-0 bg-cyber-dark/90 z-50 flex flex-col items-center justify-center">
             <div className="relative w-24 h-24 mb-6">
                <div className="absolute inset-0 border-4 border-cyber-dim rounded-full opacity-20"></div>
                <div className="absolute inset-0 border-4 border-t-cyber-primary border-r-transparent border-b-cyber-secondary border-l-transparent rounded-full animate-spin"></div>
             </div>
             <p className="text-xl font-mono animate-pulse text-cyber-primary">{loadingText}</p>
             <p className="text-sm text-gray-500 mt-2 font-mono">USING MODEL: gemini-2.5-flash-image</p>
           </div>
        )}

        {/* State: COMPARE */}
        {appState === AppState.COMPARE && originalImage && processedImage && (
           <ComparisonView originalSrc={originalImage} processedSrc={processedImage} />
        )}

        {/* Error Toast */}
        {errorMsg && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-900/90 text-white px-6 py-3 rounded border border-red-500 shadow-xl z-50">
             {errorMsg}
             <button onClick={() => setErrorMsg(null)} className="ml-4 font-bold">X</button>
          </div>
        )}

      </main>

      {/* FOOTER TOOLBAR */}
      {appState !== AppState.UPLOAD && appState !== AppState.PROCESSING && (
        <footer className="h-20 bg-cyber-panel border-t border-gray-800 flex items-center justify-center px-4 md:px-8 gap-4 md:gap-8 z-20">
          
          {/* Controls for EDIT mode */}
          {appState === AppState.EDIT && (
            <>
               <div className="flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700">
                  <button 
                    onClick={() => setTool(ToolType.BRUSH)}
                    className={`p-3 rounded transition-all ${tool === ToolType.BRUSH ? 'bg-cyber-secondary text-white shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 'text-gray-400 hover:text-white'}`}
                    title="画笔"
                  >
                    <BrushIcon />
                  </button>
                  <button 
                    onClick={() => setTool(ToolType.HAND)}
                    className={`p-3 rounded transition-all ${tool === ToolType.HAND ? 'bg-cyber-primary text-black shadow-[0_0_10px_rgba(6,182,212,0.5)]' : 'text-gray-400 hover:text-white'}`}
                    title="抓手 (平移)"
                  >
                    <HandIcon />
                  </button>
               </div>

               <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 rounded-lg border border-gray-700 w-48 hidden sm:flex">
                  <span className="text-xs text-gray-400 font-mono">SIZE</span>
                  <input 
                    type="range" 
                    min="5" 
                    max="100" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyber-secondary [&::-webkit-slider-thumb]:rounded-full"
                  />
               </div>

               <div className="flex items-center gap-2">
                  <button onClick={handleUndo} className="p-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-colors" title="撤销">
                    <UndoIcon />
                  </button>
                  <button onClick={handleReset} className="p-3 text-gray-400 hover:text-red-500 hover:bg-gray-800 rounded-full transition-colors" title="重置">
                    <TrashIcon />
                  </button>
               </div>

               <div className="h-8 w-px bg-gray-700 mx-2"></div>

               <button 
                  onClick={handleStartProcessing}
                  disabled={!hasMask}
                  className={`
                    flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm md:text-base transition-all
                    ${hasMask 
                      ? 'bg-gradient-to-r from-cyber-secondary to-purple-600 text-white hover:scale-105 shadow-[0_0_20px_rgba(244,63,94,0.4)]' 
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'}
                  `}
               >
                  <MagicIcon />
                  <span className="hidden md:inline">开始去水印</span>
                  <span className="md:hidden">开始</span>
               </button>
            </>
          )}

          {/* Controls for COMPARE mode */}
          {appState === AppState.COMPARE && (
             <>
               <div className="flex items-center gap-4">
                  <button 
                    onClick={handleApplyEffect}
                    className="flex items-center gap-2 px-5 py-2 rounded border border-cyber-primary text-cyber-primary hover:bg-cyber-primary hover:text-black transition-all font-bold"
                  >
                    <CheckIcon />
                    应用当前效果
                  </button>

                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-3 rounded bg-cyber-primary text-black font-bold hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all"
                  >
                    <DownloadIcon />
                    下载图片
                  </button>

                  <button 
                    onClick={handleBackToHome}
                    className="flex items-center gap-2 px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-700 rounded transition-all text-sm"
                  >
                    <UploadIcon className="w-4 h-4"/>
                    上传新图
                  </button>

                   <button 
                    onClick={() => {
                        // Abandon changes, go back to edit?
                        // Actually "Abandon" usually means "Clear processed image"
                        // Or effectively "Go Back"
                        handleStepBack();
                    }}
                    className="px-4 py-2 text-gray-400 hover:text-white text-sm"
                  >
                    放弃
                  </button>
               </div>
             </>
          )}

        </footer>
      )}
    </div>
  );
};

export default App;