
import React, { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { UploadIcon, GridSplitIcon, DownloadIcon, ZipIcon, TrashIcon } from './Icons';

interface SplitImage {
  id: string;
  originalName: string;
  blob: Blob; // Original blob for display
  parts: string[]; // DataURLs of parts
  status: 'pending' | 'processing' | 'done';
}

const ImageSplitter: React.FC = () => {
  const [images, setImages] = useState<SplitImage[]>([]);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const newImages: SplitImage[] = files.map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        originalName: file.name,
        blob: file,
        parts: [],
        status: 'pending'
      }));
      setImages(prev => [...prev, ...newImages]);
      // Reset input value to allow re-uploading same file if needed
      e.target.value = '';
    }
  };

  const processImage = (img: SplitImage, r: number, c: number): Promise<string[]> => {
    return new Promise((resolve) => {
      const imageObj = new Image();
      imageObj.src = URL.createObjectURL(img.blob);
      imageObj.onload = () => {
        const parts: string[] = [];
        const partW = imageObj.width / c;
        const partH = imageObj.height / r;

        for (let row = 0; row < r; row++) {
          for (let col = 0; col < c; col++) {
            const canvas = document.createElement('canvas');
            canvas.width = partW;
            canvas.height = partH;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(
                imageObj,
                col * partW, row * partH, partW, partH, // Source
                0, 0, partW, partH // Dest
              );
              parts.push(canvas.toDataURL('image/jpeg', 0.9));
            }
          }
        }
        URL.revokeObjectURL(imageObj.src);
        resolve(parts);
      };
    });
  };

  const handleProcessAll = async () => {
    setIsProcessing(true);
    const updatedImages = [...images];
    
    for (let i = 0; i < updatedImages.length; i++) {
      if (updatedImages[i].status !== 'done') {
        updatedImages[i].status = 'processing';
        setImages([...updatedImages]); // Update UI to show spinner
        
        try {
            const parts = await processImage(updatedImages[i], rows, cols);
            updatedImages[i].parts = parts;
            updatedImages[i].status = 'done';
        } catch (err) {
            console.error(err);
        }
        setImages([...updatedImages]);
      }
    }
    setIsProcessing(false);
  };

  const handleClear = () => {
    setImages([]);
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleDownloadZip = async () => {
    if (images.length === 0) return;
    
    const zip = new JSZip();
    
    images.forEach(img => {
      if (img.status === 'done' && img.parts.length > 0) {
        // Create a folder for each image if there are multiple, or just root if single? 
        // Best practice: Folder per original image to keep it clean.
        const safeName = img.originalName.replace(/\.[^/.]+$/, ""); // remove extension
        const folder = zip.folder(safeName);
        
        if (folder) {
            img.parts.forEach((partDataUrl, index) => {
                // Remove data:image/jpeg;base64, prefix
                const data = partDataUrl.split(',')[1];
                const row = Math.floor(index / cols) + 1;
                const col = (index % cols) + 1;
                folder.file(`${safeName}_${row}_${col}.jpg`, data, { base64: true });
            });
        }
      }
    });

    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `split_images_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full flex flex-col p-4 md:p-8 max-w-6xl mx-auto overflow-hidden">
      
      {/* HEADER & CONTROLS */}
      <div className="bg-cyber-panel border border-gray-800 rounded-2xl p-6 mb-6 shadow-xl shrink-0">
         <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            
            {/* Title & Inputs */}
            <div className="flex flex-col gap-4 w-full md:w-auto">
               <div className="flex items-center gap-3 text-cyber-primary">
                  <GridSplitIcon className="w-8 h-8" />
                  <h2 className="text-2xl font-bold text-white">九宫格切片器</h2>
               </div>
               
               <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700">
                     <span className="text-gray-400 text-sm font-bold">行数:</span>
                     <input 
                        type="number" min="1" max="10" 
                        value={rows} 
                        onChange={(e) => setRows(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 bg-transparent text-white font-mono text-center outline-none border-b border-gray-600 focus:border-cyber-primary"
                     />
                  </div>
                  <span className="text-gray-500">X</span>
                  <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded-lg border border-gray-700">
                     <span className="text-gray-400 text-sm font-bold">列数:</span>
                     <input 
                        type="number" min="1" max="10" 
                        value={cols} 
                        onChange={(e) => setCols(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-12 bg-transparent text-white font-mono text-center outline-none border-b border-gray-600 focus:border-cyber-primary"
                     />
                  </div>
               </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <label className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition-colors border border-gray-700">
                    <UploadIcon className="w-5 h-5" />
                    <span>添加图片</span>
                    <input type="file" multiple accept="image/*" className="hidden" onChange={handleUpload} />
                </label>

                <button 
                    onClick={handleProcessAll}
                    disabled={images.length === 0 || isProcessing}
                    className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                        images.length > 0 && !isProcessing
                        ? 'bg-cyber-primary text-black hover:bg-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                        : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    {isProcessing ? (
                        <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                        <GridSplitIcon className="w-5 h-5" />
                    )}
                    开始切分
                </button>

                <button 
                   onClick={handleDownloadZip}
                   disabled={images.filter(i => i.status === 'done').length === 0}
                   className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold transition-all ${
                       images.filter(i => i.status === 'done').length > 0
                       ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg'
                       : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                   }`}
                >
                    <ZipIcon className="w-5 h-5" />
                    打包下载 (ZIP)
                </button>
                
                {images.length > 0 && (
                     <button onClick={handleClear} className="p-3 text-red-500 hover:bg-red-900/20 rounded-lg border border-transparent hover:border-red-900/50" title="清空列表">
                         <TrashIcon className="w-5 h-5" />
                     </button>
                )}
            </div>
         </div>
      </div>

      {/* CONTENT LIST */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
         {images.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-2xl text-gray-600 bg-gray-900/20">
                 <GridSplitIcon className="w-16 h-16 mb-4 opacity-20" />
                 <p className="text-lg">拖入或上传图片开始制作九宫格</p>
                 <p className="text-sm opacity-50">支持批量上传</p>
             </div>
         ) : (
             images.map(img => (
                 <div key={img.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex flex-col md:flex-row gap-6 animate-[fadeIn_0.3s_ease-out]">
                    {/* Preview Thumbnail */}
                    <div className="relative w-full md:w-32 h-32 bg-black rounded-lg overflow-hidden shrink-0 border border-gray-800">
                        <img 
                            src={URL.createObjectURL(img.blob)} 
                            alt={img.originalName} 
                            className="w-full h-full object-contain opacity-50" 
                            onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                        />
                         <button 
                            onClick={() => removeImage(img.id)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 hover:opacity-100 transition-opacity"
                         >
                             <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <h4 className="font-bold text-gray-300 mb-2 truncate max-w-md">{img.originalName}</h4>
                        
                        {img.status === 'pending' && (
                            <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gray-600"></span>
                                等待切分...
                            </div>
                        )}
                        
                        {img.status === 'processing' && (
                            <div className="text-sm text-cyber-primary flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyber-primary animate-pulse"></span>
                                处理中...
                            </div>
                        )}

                        {img.status === 'done' && (
                             <div className="mt-2">
                                 <div 
                                    className="grid gap-1 w-fit" 
                                    style={{ 
                                        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` 
                                    }}
                                 >
                                     {img.parts.map((part, idx) => (
                                         <div key={idx} className="w-12 h-12 md:w-16 md:h-16 bg-black border border-gray-700 rounded-sm overflow-hidden relative group">
                                             <img src={part} className="w-full h-full object-cover" />
                                             <a 
                                                href={part} 
                                                download={`${img.originalName.split('.')[0]}_${idx+1}.jpg`}
                                                className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                             >
                                                 <DownloadIcon className="w-4 h-4 text-white" />
                                             </a>
                                         </div>
                                     ))}
                                 </div>
                                 <p className="text-xs text-gray-500 mt-2">共 {img.parts.length} 张切片</p>
                             </div>
                        )}
                    </div>
                 </div>
             ))
         )}
      </div>

    </div>
  );
};

export default ImageSplitter;
