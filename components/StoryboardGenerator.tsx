
import React, { useState } from 'react';
import { generateStoryboardData, regenerateSingleShot } from '../services/geminiService';
import { UploadIcon, MagicIcon, CopyIcon, TranslateIcon, FilmIcon, CheckIcon } from './Icons';
import { StoryboardData, StoryboardShot } from '../types';

interface StoryboardGeneratorProps {
  // Empty for now, self-contained
}

const SHOT_STYLES = [
  { id: 'mix', label: '混合景别 (Cinematic Mix)' },
  { id: 'closeup', label: '特写为主 (Close-up Focus)' },
  { id: 'wide', label: '全景/大远景 (Wide/Epic)' },
  { id: 'action', label: '动态动作 (Dynamic Action)' },
];

const COMMON_SHOT_TYPES = [
  { en: 'Extreme Long Shot', cn: '大远景' },
  { en: 'Long Shot', cn: '远景' },
  { en: 'Full Shot', cn: '全景' },
  { en: 'Medium Shot', cn: '中景' },
  { en: 'Close-up', cn: '特写' },
  { en: 'Extreme Close-up', cn: '大特写' },
  { en: 'Low Angle', cn: '低角度 (仰视)' },
  { en: 'High Angle', cn: '高角度 (俯视)' },
  { en: 'Over the Shoulder', cn: '过肩镜头' },
  { en: 'Point of View', cn: '第一人称' },
];

const StoryboardGenerator: React.FC<StoryboardGeneratorProps> = () => {
  const [image, setImage] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("16:9");
  const [shotStyle, setShotStyle] = useState<string>("mix");
  
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<StoryboardData | null>(null);
  
  const [displayLang, setDisplayLang] = useState<'cn' | 'en'>('cn');
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Initialize empty grid for visual structure before loading
  const emptyShots = Array.from({ length: 9 }, (_, i) => ({ id: i + 1 }));

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImage(event.target.result as string);
          setData(null); 
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleGenerateAll = async () => {
    if (!image) return;
    setIsLoading(true);
    try {
      const res = await generateStoryboardData(image, SHOT_STYLES.find(s => s.id === shotStyle)?.label || 'Mix');
      setData(res);
    } catch (e) {
      console.error(e);
      alert("生成失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateShot = async (index: number, desiredTypeEn: string) => {
    if (!image || !data) return;
    
    // Set loading state for specific shot
    const newShots = [...data.shots];
    newShots[index] = { ...newShots[index], isRegenerating: true };
    setData({ ...data, shots: newShots });

    try {
        const updatedShot = await regenerateSingleShot(
            image, 
            data.shots[index], 
            data.mainPromptEn,
            desiredTypeEn
        );
        
        const finalShots = [...data.shots];
        finalShots[index] = { ...updatedShot, isRegenerating: false };
        setData({ ...data, shots: finalShots });
    } catch (e) {
        console.error(e);
        // Revert loading state
        const revertShots = [...data.shots];
        revertShots[index] = { ...revertShots[index], isRegenerating: false };
        setData({ ...data, shots: revertShots });
    }
  };

  const handleShotContentChange = (index: number, newVal: string) => {
    if (!data) return;
    const newShots = [...data.shots];
    if (displayLang === 'cn') {
        newShots[index].contentCn = newVal;
    } else {
        newShots[index].contentEn = newVal;
    }
    setData({ ...data, shots: newShots });
  };

  const handleShotTypeChange = (index: number, newTypeEn: string) => {
     if (!data) return;
     // Update type immediately for UI, then trigger regen
     const typeObj = COMMON_SHOT_TYPES.find(t => t.en === newTypeEn);
     const newShots = [...data.shots];
     newShots[index].shotTypeEn = newTypeEn;
     newShots[index].shotTypeCn = typeObj ? typeObj.cn : newTypeEn;
     setData({ ...data, shots: newShots });

     // Automatically regenerate content to match new type
     handleRegenerateShot(index, newTypeEn);
  };

  const constructFinalPrompt = () => {
      if (!data) return "";
      const isCn = displayLang === 'cn';
      const mainDesc = isCn ? data.mainPromptCn : data.mainPromptEn;
      
      let finalStr = "";
      if (isCn) {
          finalStr = `根据${mainDesc}，生成一张具有凝聚力的[3x3]网格图像，包含在同一环境中的[9]个不同摄像机镜头，严格保持人物/物体、服装和光线的一致性，[8K]分辨率，[${aspectRatio}]画幅。\n`;
      } else {
          finalStr = `Based on ${mainDesc}, generate a cohesive [3x3] grid image containing [9] different camera shots in the same environment, strictly maintaining character/object, clothing, and lighting consistency, [8K] resolution, [${aspectRatio}] aspect ratio.\n`;
      }

      data.shots.forEach((shot, i) => {
          const type = isCn ? shot.shotTypeCn : shot.shotTypeEn;
          const content = isCn ? shot.contentCn : shot.contentEn;
          const prefix = isCn ? `镜头${String(i + 1).padStart(2, '0')}` : `Shot ${String(i + 1).padStart(2, '0')}`;
          // Combine Type + Content for the line
          finalStr += `${prefix}: [${type}] ${content}\n`;
      });

      return finalStr;
  };

  const handleCopy = () => {
    const text = constructFinalPrompt();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto p-4 md:p-6 flex flex-col xl:flex-row gap-6 h-full overflow-hidden">
      
      {/* LEFT COLUMN: INPUT & SETTINGS (Fixed width) */}
      <div className="w-full xl:w-[400px] flex flex-col gap-6 shrink-0 h-full overflow-y-auto">
        
        {/* Upload Card */}
        <div className="bg-cyber-panel border border-gray-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group shrink-0">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <FilmIcon className="w-32 h-32 text-cyber-primary" />
          </div>
          
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-cyber-primary">
            <FilmIcon className="w-5 h-5" />
            1. 上传参考图
          </h2>

          <div className="relative w-full aspect-video bg-black/40 border-2 border-dashed border-gray-700 rounded-xl flex flex-col items-center justify-center hover:border-cyber-primary transition-all overflow-hidden">
            {image ? (
              <>
                <img src={image} alt="Ref" className="w-full h-full object-contain" />
                <button 
                  onClick={() => setImage(null)} 
                  className="absolute top-2 right-2 bg-black/60 hover:bg-red-500/80 p-2 rounded-full text-white transition-colors"
                >
                  ✕
                </button>
              </>
            ) : (
              <label className="cursor-pointer flex flex-col items-center p-8 w-full h-full justify-center text-center">
                 <UploadIcon className="w-8 h-8 text-gray-500 mb-2" />
                 <span className="text-gray-300 font-bold text-sm">点击上传图片</span>
                 <input type="file" className="hidden" accept="image/*" onChange={handleUpload} />
              </label>
            )}
          </div>
        </div>

        {/* Controls Card */}
        <div className="bg-cyber-panel border border-gray-800 rounded-2xl p-6 shadow-xl shrink-0">
           <h3 className="text-sm font-mono text-cyber-dim mb-4">2. 全局设置 (SETTINGS)</h3>
           
           <div className="space-y-6">
             {/* Aspect Ratio */}
             <div>
                <label className="block text-xs text-gray-400 mb-2 font-bold">生成画幅 (ASPECT RATIO)</label>
                <div className="flex bg-gray-900 p-1 rounded-lg border border-gray-700">
                  {['16:9', '9:16'].map(ratio => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                        aspectRatio === ratio 
                        ? 'bg-cyber-primary text-black shadow-lg' 
                        : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
             </div>

             {/* Shot Style */}
             <div>
                <label className="block text-xs text-gray-400 mb-2 font-bold">分镜风格 (STYLE)</label>
                <select 
                  value={shotStyle}
                  onChange={(e) => setShotStyle(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-cyber-primary focus:border-cyber-primary block p-2.5 outline-none"
                >
                  {SHOT_STYLES.map(style => (
                    <option key={style.id} value={style.id}>{style.label}</option>
                  ))}
                </select>
             </div>

             <button
                onClick={handleGenerateAll}
                disabled={!image || isLoading}
                className={`w-full py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all ${
                !image || isLoading 
                ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-cyber-secondary to-purple-600 text-white hover:scale-[1.02] shadow-[0_0_15px_rgba(244,63,94,0.4)]'
                }`}
            >
                {isLoading ? (
                <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    正在反推...
                </>
                ) : (
                <>
                    <MagicIcon className="w-5 h-5" />
                    生成九宫格分镜
                </>
                )}
            </button>
           </div>
        </div>

        {/* Global Output Actions */}
        {data && (
            <div className="bg-[#020610] border border-gray-800 rounded-2xl p-6 shadow-inner shrink-0">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-cyber-text">输出 (OUTPUT)</h3>
                    <button 
                        onClick={() => setDisplayLang(prev => prev === 'cn' ? 'en' : 'cn')}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-800 border border-gray-600 text-[10px] text-cyber-primary hover:bg-gray-700 transition-colors"
                    >
                        <TranslateIcon className="w-3 h-3" />
                        {displayLang === 'cn' ? 'EN' : 'CN'}
                    </button>
                </div>
                <button 
                    onClick={handleCopy}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold transition-all ${
                    copyFeedback 
                    ? 'bg-green-600 text-white'
                    : 'bg-cyber-primary text-black hover:bg-cyan-400'
                    }`}
                >
                    {copyFeedback ? <CheckIcon className="w-5 h-5" /> : <CopyIcon className="w-5 h-5" />}
                    {copyFeedback ? '已复制全部咒语' : '复制最终咒语'}
                </button>
            </div>
        )}
      </div>

      {/* RIGHT COLUMN: 3x3 GRID */}
      <div className="flex-1 h-full overflow-y-auto pr-2">
        <div className="mb-4 flex items-center gap-2">
           <div className="bg-cyber-secondary w-2 h-6 rounded-sm"></div>
           <h2 className="text-xl font-bold text-white">3. 分镜网格编辑 (3x3)</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {(data ? data.shots : emptyShots).map((shot: any, index: number) => {
                const isLoaded = !!data;
                const shotData = shot as StoryboardShot;
                
                return (
                    <div 
                        key={index} 
                        className={`
                            relative flex flex-col rounded-xl border transition-all h-[280px]
                            ${isLoaded 
                                ? 'bg-[#0f172a] border-gray-700 hover:border-cyber-primary/50' 
                                : 'bg-gray-900/30 border-gray-800'
                            }
                        `}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3 border-b border-gray-800/50 bg-black/20 rounded-t-xl">
                            <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-cyber-primary text-xs font-mono border border-gray-700">
                                    {index + 1}
                                </span>
                                {isLoaded ? (
                                    <select 
                                        className="bg-transparent text-sm text-gray-300 font-bold outline-none cursor-pointer hover:text-cyber-primary max-w-[120px]"
                                        value={shotData.shotTypeEn}
                                        onChange={(e) => handleShotTypeChange(index, e.target.value)}
                                        disabled={shotData.isRegenerating}
                                    >
                                        {COMMON_SHOT_TYPES.map(t => (
                                            <option key={t.en} value={t.en} className="bg-gray-900 text-gray-300">
                                                {displayLang === 'cn' ? t.cn : t.en}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
                                )}
                            </div>
                            
                            {isLoaded && (
                                <button 
                                    onClick={() => handleRegenerateShot(index, shotData.shotTypeEn)}
                                    disabled={shotData.isRegenerating}
                                    title="Regenerate this shot"
                                    className={`p-1.5 rounded-md hover:bg-gray-700 text-gray-400 transition-colors ${shotData.isRegenerating ? 'animate-spin text-cyber-secondary' : ''}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                                        <path d="M3 3v5h5"/>
                                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                                        <path d="M16 16h5v5"/>
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-3 relative">
                            {isLoaded ? (
                                shotData.isRegenerating ? (
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-cyber-dim gap-2 bg-[#0f172a]/80 z-10 backdrop-blur-sm">
                                        <div className="w-6 h-6 border-2 border-cyber-secondary/30 border-t-cyber-secondary rounded-full animate-spin"></div>
                                        <span className="text-xs">重绘中...</span>
                                    </div>
                                ) : (
                                    <textarea 
                                        className="w-full h-full bg-transparent resize-none text-sm text-gray-400 leading-relaxed outline-none border-none focus:ring-0 placeholder-gray-700"
                                        value={displayLang === 'cn' ? shotData.contentCn : shotData.contentEn}
                                        onChange={(e) => handleShotContentChange(index, e.target.value)}
                                    />
                                )
                            ) : (
                                <div className="space-y-3 mt-2">
                                    <div className="h-2 w-full bg-gray-800/50 rounded animate-pulse" />
                                    <div className="h-2 w-3/4 bg-gray-800/50 rounded animate-pulse" />
                                    <div className="h-2 w-5/6 bg-gray-800/50 rounded animate-pulse" />
                                    {isLoading && (
                                        <div className="mt-8 text-center text-xs text-gray-600 animate-pulse">等待生成...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
      </div>

    </div>
  );
};

export default StoryboardGenerator;
