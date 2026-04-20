/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, X, Loader2, Sparkles, ChevronRight, Copy, Check, Camera, Film, ArrowLeft, History, ScanSearch, UploadCloud } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type PromptPayload = Record<string, any>;

type Message = {
  id: string;
  role: 'user' | 'assistant';
  type: 'text' | 'generation' | 'error';
  content: string;
  media?: { data: string; mimeType: string }[];
  status?: 'prompting' | 'complete' | 'error';
  jsonPayload?: PromptPayload;
  targetMode?: 'image' | 'video' | 'extractor';
};

function MessageBubble({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (msg.jsonPayload) {
      navigator.clipboard.writeText(JSON.stringify(msg.jsonPayload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (msg.role === 'user') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-6"
      >
        <div className="max-w-[80%] bg-[#1A1A1A] border-2 border-[#333] p-4 text-sm leading-relaxed font-mono">
          {msg.media && msg.media.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {msg.media.map((m, i) => {
                if (!m.data) {
                  return (
                    <div key={i} className="w-24 h-24 border border-[#333] bg-[#0A0A0A] flex items-center justify-center text-[#555] font-mono text-xs uppercase text-center p-2">
                       {m.mimeType.startsWith('video/') ? "Video File" : "Image File"}
                    </div>
                  );
                }
                return m.mimeType.startsWith('video/') ? (
                  <video key={i} src={m.data} className="w-48 h-auto border border-[#333]" controls />
                ) : (
                  <img key={i} src={m.data} alt="upload" className="w-24 h-24 object-cover border border-[#333]" />
                );
              })}
            </div>
          )}
          {msg.content && <p className="whitespace-pre-wrap">{msg.content}</p>}
        </div>
      </motion.div>
    );
  }

  if (msg.type === 'error') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start mb-6"
      >
        <div className="max-w-[80%] bg-red-500/10 border-2 border-red-500/20 p-4 text-sm text-red-400 font-mono">
          {msg.content}
        </div>
      </motion.div>
    );
  }

  if (msg.type === 'generation') {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start mb-6"
      >
        <div className="max-w-[90%] w-full">
          <div className="flex items-center gap-2 mb-2 text-[#FFCC00] text-xs uppercase tracking-widest font-mono">
            <Sparkles className="w-4 h-4" />
            <span>PROMPT TO JSON</span>
          </div>
          
          <div className="bg-[#0A0A0A] border-2 border-[#333] overflow-hidden shadow-xl inline-block w-full">
            {msg.status === 'prompting' && (
              <div className="p-8 flex flex-col items-center justify-center text-[#888] gap-4">
                <Loader2 className="w-6 h-6 animate-spin text-[#FFCC00]" />
                <span className="text-sm font-mono animate-pulse uppercase tracking-widest text-[#FFCC00]">Writing JSON...</span>
              </div>
            )}
            
            {msg.status === 'complete' && msg.jsonPayload && (
              <div className="flex flex-col">
                <div className="p-4 bg-[#0A0A0A]">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-xs font-mono text-[#FFCC00] flex items-center gap-2 select-none uppercase tracking-widest">
                      <ChevronRight className="w-4 h-4 rotate-90" />
                      GENERATED JSON
                    </div>
                    <button 
                      onClick={handleCopy}
                      className="text-[#FFCC00] hover:text-white transition-colors cursor-pointer p-1"
                      title="Copy JSON"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="text-left border-2 border-[#333] w-full max-w-full">
                    <SyntaxHighlighter 
                      language="json" 
                      style={vscDarkPlus} 
                      wrapLongLines={true}
                      customStyle={{ 
                        borderRadius: '0', 
                        background: '#050505', 
                        fontSize: '0.75rem', 
                        padding: '1rem', 
                        margin: 0
                      }}
                      codeTagProps={{
                        style: {
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word'
                        }
                      }}
                    >
                      {JSON.stringify(msg.jsonPayload, null, 2)}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return null;
}

function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [media, setMedia] = useState<{data: string, mimeType: string}[]>([]);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [targetMode, setTargetMode] = useState<'image' | 'video' | 'extractor' | null>(null);
  const [savedHistory, setSavedHistory] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem('prompt_history');
    if (saved) {
      try {
        setSavedHistory(JSON.parse(saved));
      } catch (e) { }
    }
  }, []);

  const currentMessages = messages.filter(m => m.targetMode === targetMode);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > 20 * 1024 * 1024) {
        alert('File size exceeds 20MB limit.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setMedia(prev => [...prev, {
          data: reader.result as string,
          mimeType: file.type
        }]);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() && media.length === 0) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: Message = {
      id: userMsgId,
      role: 'user',
      type: 'text',
      content: input,
      media: [...media],
      targetMode: targetMode as 'image' | 'video' | 'extractor'
    };

    setMessages(prev => [...prev, newUserMsg]);
    
    const currentInput = input;
    const currentMedia = [...media];
    
    setInput('');
    setMedia([]);
    setIsGeneratingPrompt(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const newAssistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      type: 'generation',
      content: '',
      status: 'prompting',
      targetMode: targetMode as 'image' | 'video' | 'extractor'
    };
    setMessages(prev => [...prev, newAssistantMsg]);

    try {
      let promptRes;
      if (targetMode === 'extractor') {
        promptRes = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media: currentMedia })
        });
      } else {
        promptRes = await fetch('/api/generate/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: currentInput, media: currentMedia, targetMode })
        });
      }
      
      const promptData = await promptRes.json();
      
      if (!promptRes.ok) {
        throw new Error(promptData.error || 'Failed to generate prompt.');
      }

      const payload = promptData.payload;

      setMessages(prev => prev.map(msg => 
        msg.id === assistantMsgId 
          ? { ...msg, status: 'complete', jsonPayload: payload }
          : msg
      ));
      
      // Save successful generation to local storage history
      setSavedHistory(prev => {
         const strippedUserMsg = { 
           ...newUserMsg, 
           media: newUserMsg.media?.map(m => ({ data: '', mimeType: m.mimeType })) 
         };
         const updated = [...prev, strippedUserMsg, { ...newAssistantMsg, status: 'complete' as const, jsonPayload: payload }];
         try {
           localStorage.setItem('prompt_history', JSON.stringify(updated));
         } catch(e) {
           console.warn("Could not save to localStorage (quota exceeded)");
         }
         return updated;
      });

    } catch (error: any) {
      console.error("Generation error:", error);
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMsgId 
          ? { ...msg, status: 'error', type: 'error', content: error.message || "Failed to generate." }
          : msg
      ));
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

      if (!targetMode) {
        return (
          <div className="flex flex-col min-h-screen bg-[#050505] font-sans text-[#EAEAEA] items-center p-6 relative">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-4xl w-full my-auto py-12"
            >
              <div className="flex flex-col items-center mb-16 text-center">
                <h1 className="font-serif italic text-4xl md:text-6xl text-[#FFCC00] uppercase tracking-tighter mb-4" style={{ textShadow: '0 10px 30px rgba(255, 204, 0, 0.2)' }}>Select Target</h1>
                <p className="font-mono text-[#888] text-xs md:text-sm uppercase tracking-widest border-t border-b border-[#333] py-2 px-6">Configure the output format</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <button
                  onClick={() => setTargetMode('image')}
                  className="group relative bg-[#0A0A0A] border-2 border-[#333] hover:border-[#FFCC00] p-10 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,204,0,0.15)] overflow-hidden cursor-pointer"
                >
                  <div className="absolute inset-0 bg-[#FFCC00]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <Camera className="w-12 h-12 md:w-16 md:h-16 text-[#FFCC00] group-hover:scale-110 transition-transform duration-500 relative z-10" strokeWidth={1} />
                  <div className="relative z-10 text-center">
                    <h2 className="font-display font-medium text-xl md:text-2xl tracking-widest uppercase mb-3 text-[#AAAAAA]">Image JSON</h2>
                    <p className="font-mono text-xs text-[#888] leading-relaxed">Convert simple image text prompts into detailed scaled json</p>
                  </div>
                </button>

                <button
                  onClick={() => setTargetMode('video')}
                  className="group relative bg-[#0A0A0A] border-2 border-[#333] hover:border-[#FFCC00] p-10 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,204,0,0.15)] overflow-hidden cursor-pointer"
                >
                  <div className="absolute inset-0 bg-[#FFCC00]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <Film className="w-12 h-12 md:w-16 md:h-16 text-[#FFCC00] group-hover:scale-110 transition-transform duration-500 relative z-10" strokeWidth={1} />
                  <div className="relative z-10 text-center">
                    <h2 className="font-display font-medium text-xl md:text-2xl tracking-widest uppercase mb-3 text-[#AAAAAA]">Video JSON</h2>
                    <p className="font-mono text-xs text-[#888] leading-relaxed">Convert simple video text prompts into detailed scaled json</p>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <button
                  onClick={() => setTargetMode('extractor')}
                  className="group relative bg-[#0A0A0A] border-2 border-[#333] hover:border-[#FFCC00] p-10 flex flex-col items-center justify-center gap-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,204,0,0.15)] overflow-hidden cursor-pointer w-full"
                >
                  <div className="absolute inset-0 bg-[#FFCC00]/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                  <ScanSearch className="w-12 h-12 md:w-16 md:h-16 text-[#FFCC00] group-hover:scale-110 transition-transform duration-500 relative z-10" strokeWidth={1} />
                  <div className="relative z-10 text-center max-w-lg mx-auto">
                    <h2 className="font-display font-medium text-xl md:text-2xl tracking-widest uppercase mb-3 text-[#AAAAAA]">JSON Extractor</h2>
                    <p className="font-mono text-xs text-[#888] leading-relaxed">Drop any image or video. Every detail extracted and structured into JSON.</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        );
      }

      return (
        <div className="flex flex-col h-screen bg-[#050505] font-sans text-[#EAEAEA]">
          {/* Header Bar */}
          <div className="flex-none p-4 border-b-2 border-[#333] bg-[#0A0A0A] flex items-center justify-between z-20">
            <button 
              onClick={() => { setTargetMode(null); setMedia([]); setInput(''); }}
              className="flex items-center gap-2 text-[#888] hover:text-[#FFCC00] transition-colors font-mono text-xs uppercase tracking-widest cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" /> Switch Target
            </button>
            <div className="font-mono text-xs text-[#FFCC00] uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#FFCC00] animate-pulse"></span>
              {targetMode === 'extractor' ? 'EXTRACTOR' : targetMode.toUpperCase()} ACTIVE
            </div>
            <button 
              onClick={() => setShowHistory(true)}
              className="flex items-center gap-2 text-[#888] hover:text-white transition-colors font-mono text-xs uppercase tracking-widest cursor-pointer"
              title="View History"
            >
              <History className="w-4 h-4" /> HISTORY
            </button>
          </div>

          <AnimatePresence>
            {showHistory && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-50 bg-[#050505]/95 backdrop-blur-sm flex flex-col"
              >
                <div className="flex-none p-4 border-b-2 border-[#333] bg-[#0A0A0A] flex items-center justify-between">
                  <div className="font-mono text-[#FFCC00] uppercase tracking-widest text-sm font-bold flex items-center gap-2">
                    <History className="w-4 h-4" /> {targetMode.toUpperCase()} HISTORY
                  </div>
                  <button onClick={() => setShowHistory(false)} className="text-[#888] hover:text-white transition-colors cursor-pointer p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-4xl mx-auto w-full">
                  {savedHistory.filter(m => m.targetMode === targetMode).length === 0 ? (
                    <div className="text-center font-mono text-[#888] mt-20 text-sm">NO HISTORY YET</div>
                  ) : (
                    savedHistory.filter(m => m.targetMode === targetMode).map(msg => (
                      <MessageBubble key={msg.id} msg={msg} />
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Area */}
          <main className="flex-1 overflow-y-auto p-6 scroll-smooth relative">
        <div className="max-w-4xl mx-auto relative z-10">
          {currentMessages.length === 0 ? (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center relative w-full">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex flex-col items-center"
              >
                <div className="relative flex flex-col items-center justify-center gap-2">
                  <motion.h1 
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    className="font-serif italic text-[15vw] leading-none text-[#FFCC00] uppercase tracking-tighter z-10 relative"
                    style={{ textShadow: '0 10px 30px rgba(255, 204, 0, 0.15)' }}
                  >
                    {targetMode === 'extractor' ? 'EXTRACT' : targetMode === 'image' ? 'IMAGE' : 'VIDEO'}
                  </motion.h1>
                  <motion.h1 
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    className="font-display text-[18vw] leading-none text-[#FFCC00] uppercase tracking-tighter mix-blend-screen relative"
                  >
                    {targetMode === 'extractor' ? 'JSON' : 'TO JSON'}
                  </motion.h1>
                </div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-8 font-mono text-[#FFCC00] text-xs md:text-sm tracking-widest uppercase flex items-center gap-4 border-t border-b border-[#FFCC00]/30 py-3 px-8"
                >
                  <span>{targetMode === 'extractor' ? 'Drop any image or video to extract deeply nested structure' : `Enhance your ${targetMode} prompts with Gemini`}</span>
                </motion.div>
              </motion.div>
            </div>
          ) : (
            currentMessages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Area */}
      <footer className="flex-none p-4 md:p-8 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent relative z-20">
        <div className="max-w-4xl mx-auto">
          {targetMode === 'extractor' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {media.length > 0 ? (
                <div className="relative border-2 border-[#333] hover:border-[#FFCC00] transition-colors bg-[#0A0A0A] p-6 flex flex-col items-center justify-center gap-6 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                  {media[0].mimeType.startsWith('video/') ? (
                    <video src={media[0].data} className="max-h-64 border-2 border-[#333]" />
                  ) : (
                    <img src={media[0].data} alt="preview" className="max-h-64 object-cover border-2 border-[#333]" />
                  )}
                  <button 
                    type="button"
                    onClick={() => setMedia([])}
                    className="absolute top-4 right-4 p-2 bg-[#FFCC00] text-black hover:bg-white transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingPrompt}
                    className="w-full p-4 bg-[#FFCC00] text-black font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isGeneratingPrompt ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> EXTRACTING...</>
                    ) : (
                      <><ScanSearch className="w-5 h-5" /> EXTRACT JSON</>
                    )}
                  </button>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-[#333] hover:border-[#FFCC00] bg-[#0A0A0A] transition-colors cursor-pointer group flex flex-col items-center justify-center p-8 md:p-12 shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:shadow-[0_0_40px_rgba(255,204,0,0.1)]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="w-12 h-12 md:w-16 md:h-16 text-[#333] group-hover:text-[#FFCC00] mb-4 transition-colors" />
                  <span className="font-display text-lg md:text-xl text-[#555] group-hover:text-[#FFCC00] transition-colors uppercase tracking-widest text-center">DROP IMAGE OR VIDEO</span>
                  <span className="font-mono text-[#555] mt-2 text-xs">MAX SIZE: 20MB</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
            </form>
          ) : (
            <>
              {/* Media Preview */}
              {media.length > 0 && (
                <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                  {media.map((m, i) => (
                    <div key={i} className="relative flex-none">
                      {m.mimeType.startsWith('video/') ? (
                        <video src={m.data} className="w-16 h-16 object-cover border-2 border-[#FFCC00]/30" />
                      ) : (
                        <img src={m.data} alt="preview" className="w-16 h-16 object-cover border-2 border-[#FFCC00]/30" />
                      )}
                      <button 
                        onClick={() => removeMedia(i)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-[#FFCC00] hover:bg-white text-black flex items-center justify-center transition-colors cursor-pointer shadow-[0_0_10px_rgba(255,204,0,0.5)]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-[#0A0A0A] border-2 border-[#FFCC00]/20 p-2 focus-within:border-[#FFCC00] transition-all shadow-[0_0_30px_rgba(0,0,0,0.8)]">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-[#FFCC00] hover:text-black hover:bg-[#FFCC00] transition-colors flex-none cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                
                <textarea
                  value={input}
                  onChange={handleInput}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={targetMode === 'image' ? "Describe your image..." : "Describe your video..."}
                  className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none outline-none resize-none py-3 px-2 text-sm placeholder:text-[#555] font-mono text-[#FFCC00]"
                  rows={1}
                />
                

                <button
                  type="submit"
                  disabled={(!input.trim() && media.length === 0) || isGeneratingPrompt}
                  className="p-3 bg-[#FFCC00] text-black hover:bg-white disabled:opacity-50 disabled:hover:bg-[#FFCC00] transition-colors flex-none cursor-pointer shadow-[0_0_15px_rgba(255,204,0,0.3)] hover:shadow-[0_0_20px_rgba(255,204,0,0.6)]"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </>
          )}
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return <ChatInterface />;
}
