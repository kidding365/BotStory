import React, { useState, useEffect, useRef } from 'react';
import { StateManager } from './core/StateManager';
import { TriggerProcessor } from './core/TriggerProcessor';
import { PromptComposer } from './core/PromptComposer';
import { AIService } from './services/AIService';
import type { WorldSchema, GameState } from './types/schema';
import { cn } from './lib/utils';
import {
  Send,
  Settings as SettingsIcon,
  Book,
  User,
  PlusCircle,
  ChevronRight,
  LogOut,
  RefreshCw
} from 'lucide-react';

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('gemini_api_key') || '');
  const [modelName, setModelName] = useState<string>(localStorage.getItem('botstory_model_name') || 'gemini-1.5-flash');
  const [state, setState] = useState<GameState | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWorldImport, setShowWorldImport] = useState(false);
  const [worldJson, setWorldJson] = useState('');

  const stateManager = useRef(new StateManager());
  const triggerProcessor = useRef(new TriggerProcessor(stateManager.current));
  const promptComposer = useRef(new PromptComposer());
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedState = stateManager.current.getState();
    if (savedState) {
      setState(savedState);
    } else {
        setShowWorldImport(true);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state?.session.history]);

  const handleImportWorld = () => {
    try {
      const world: WorldSchema = JSON.parse(worldJson);
      // For simplicity, pick the first character
      const newState = stateManager.current.createSession(world, world.possibleCharacters[0].characterId);
      setState(newState);
      setShowWorldImport(false);
    } catch (e) {
      alert('Invalid World JSON');
    }
  };

  const handleSend = async (customInput?: string) => {
    const text = customInput || input;
    if (!text || !state || !apiKey) return;

    setLoading(true);
    setInput('');

    try {
      const aiService = new AIService(apiKey);
      const prompt = promptComposer.current.assemblePrompt(state, text);

      // Add user message to history
      stateManager.current.addToHistory('user', text);
      setState({ ...stateManager.current.getState()! });

      const response = await aiService.generateStoryResponse(prompt, modelName);

      // Apply state updates from AI
      if (response.stateUpdates) {
        response.stateUpdates.forEach((update: any) => {
          stateManager.current.updateItem(update.itemId, update.newValue);
        });
      }

      // Process triggers
      triggerProcessor.current.processTriggers(response.narrative);

      // Optional: Generate image if prompt provided
      let imageUrl = '';
      if (response.imagePrompt) {
        imageUrl = await aiService.generateImage(response.imagePrompt);
      }

      stateManager.current.addToHistory('model', response.narrative, response.narrative, imageUrl ? [imageUrl] : []);
      setState({ ...stateManager.current.getState()! });
    } catch (e) {
      console.error(e);
      alert('Error interacting with AI');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    localStorage.setItem('botstory_model_name', modelName);
    setShowSettings(false);
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset the game?')) {
        stateManager.current.clear();
        setState(null);
        setShowWorldImport(true);
    }
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="w-80 bg-neutral-900 border-r border-neutral-800 flex flex-col">
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
          <h1 className="text-xl font-bold tracking-tight text-white">BotStory</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
              <SettingsIcon size={20} />
            </button>
            <button onClick={handleReset} className="p-2 hover:bg-neutral-800 rounded-lg transition-colors text-red-400">
                <LogOut size={20} />
            </button>
          </div>
        </div>

        {state && (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
                <User size={14} /> Character
              </h2>
              <div className="bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50">
                <p className="font-bold text-white mb-1">{state.session.character.name}</p>
                <p className="text-sm text-neutral-400 line-clamp-3">{state.session.character.description}</p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3 flex items-center gap-2">
                <Book size={14} /> World State
              </h2>
              <div className="space-y-2">
                {state.world.trackedItems.map(item => (
                  <div key={item.id} className="bg-neutral-800/30 p-3 rounded-lg border border-neutral-700/30">
                    <p className="text-xs text-neutral-500">{item.name}</p>
                    <p className="text-sm font-medium text-neutral-200">
                        {item.dataType === 'xml' ? '[Complex State]' : String(state.session.currentValues[item.id])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth">
          {state?.session.history.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center max-w-2xl mx-auto text-center space-y-4">
              <h2 className="text-4xl font-bold text-white">{state.world.title}</h2>
              <p className="text-lg text-neutral-400 leading-relaxed">{state.world.background}</p>
              <button
                onClick={() => handleSend(state.world.firstInput)}
                className="mt-8 px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-colors flex items-center gap-2"
              >
                Begin Journey <ChevronRight size={20} />
              </button>
            </div>
          )}

          {state?.session.history.map((msg, i) => (
            <div key={i} className={cn("max-w-3xl mx-auto space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500", msg.role === 'user' ? "text-right" : "text-left")}>
              {msg.role === 'user' ? (
                <div className="inline-block bg-neutral-800 px-4 py-2 rounded-2xl text-neutral-100 border border-neutral-700">
                  {msg.content}
                </div>
              ) : (
                <div className="space-y-6">
                  {msg.images && msg.images[0] && (
                    <img src={msg.images[0]} alt="Story scene" className="w-full rounded-2xl shadow-2xl border border-neutral-800" />
                  )}
                  <div className="prose prose-invert max-w-none text-lg text-neutral-300 leading-relaxed">
                    {msg.narrative}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-gradient-to-t from-neutral-950 via-neutral-950 to-transparent">
          <div className="max-w-3xl mx-auto">
            {loading && <div className="flex items-center gap-2 text-neutral-500 mb-4 animate-pulse"><RefreshCw size={16} className="animate-spin" /> The Storyteller is thinking...</div>}

            <div className="relative group">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="What do you do next?"
                disabled={loading}
                className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl py-4 pl-6 pr-16 text-white focus:outline-none focus:border-white transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-white text-black rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:bg-neutral-700"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-white">Settings</h2>

            <div className="space-y-4">
                <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400">Google AI Studio API Key</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white"
                    placeholder="Enter your API key..."
                />
                </div>

                <div className="space-y-2">
                <label className="text-sm font-medium text-neutral-400">AI Model</label>
                <select
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white appearance-none"
                >
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    <option value="gemma-2-27b">Gemma 2 27b</option>
                    <option value="gemma-2-9b">Gemma 2 9b</option>
                </select>
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <button onClick={handleSaveSettings} className="flex-1 bg-white text-black font-bold py-3 rounded-xl hover:bg-neutral-200 transition-colors">Save</button>
                <button onClick={() => setShowSettings(false)} className="flex-1 bg-neutral-800 text-white font-bold py-3 rounded-xl hover:bg-neutral-700 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showWorldImport && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-2xl w-full space-y-6 shadow-2xl">
            <div className="flex items-center gap-3 text-white">
                <PlusCircle size={32} className="text-blue-500" />
                <h2 className="text-3xl font-bold">Import World</h2>
            </div>
            <p className="text-neutral-400">Paste your world JSON schema to begin a new adventure.</p>
            <textarea
              value={worldJson}
              onChange={(e) => setWorldJson(e.target.value)}
              className="w-full h-64 bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-white"
              placeholder='{ "title": "My Epic World", ... }'
            />
            <button
                onClick={handleImportWorld}
                className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-neutral-200 transition-colors"
            >
              Start Adventure
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
