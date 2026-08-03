import React, { useState } from 'react';
import { UploadCloud, Image as ImageIcon, Link as LinkIcon, Check, X } from 'lucide-react';

interface CloudImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}

export const CloudImageUploader: React.FC<CloudImageUploaderProps> = ({ value, onChange, label }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [inputUrl, setInputUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      uploadMockCloud(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadMockCloud(e.target.files[0]);
    }
  };

  const uploadMockCloud = (file: File) => {
    setIsUploading(true);
    // Simulate direct client-side cloud upload (e.g., Cloudinary API response)
    const reader = new FileReader();
    reader.onload = (event) => {
      setTimeout(() => {
        const cloudUrl = event.target?.result as string;
        onChange(cloudUrl);
        setIsUploading(false);
      }, 600);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="w-full space-y-2">
      {label && <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</label>}

      {value ? (
        <div className="relative group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 max-w-xs">
          <img src={value} alt="Uploaded Cloud Asset" className="w-full h-36 object-cover" />
          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
            <button
              onClick={() => onChange('')}
              className="p-2 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center space-x-1 shadow hover:bg-rose-700"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500/50 bg-slate-50 dark:bg-slate-900/50'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Uploading to Cloud Storage...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                <label className="font-bold text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                  Click to upload
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>{' '}
                or drag & drop to cloud storage
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">SVG, PNG, JPG, GIF (Direct Cloud CDN)</p>

              <button
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="mt-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center space-x-1"
              >
                <LinkIcon className="w-3 h-3" />
                <span>or paste image URL</span>
              </button>

              {showUrlInput && (
                <div className="flex items-center space-x-2 mt-2 w-full max-w-xs">
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100"
                  />
                  <button
                    onClick={() => {
                      if (inputUrl) {
                        onChange(inputUrl);
                        setShowUrlInput(false);
                      }
                    }}
                    className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
