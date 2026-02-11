import React, { useState, useEffect } from 'react';
import { findCep, findAddress } from './services/geminiService';
import { AddressForm, SearchResult, LoadingState, SearchMode, HistoryItem } from './types';
import { InputField } from './components/InputField';
import { 
  MagnifyingGlassIcon, 
  ArrowPathIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  SparklesIcon,
  ClockIcon,
  TrashIcon,
  SunIcon
} from '@heroicons/react/24/outline';

const STATES = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

const MAX_HISTORY_ITEMS = 5;

export default function App() {
  const [mode, setMode] = useState<SearchMode>(SearchMode.ADDRESS_TO_CEP);
  
  const [addressForm, setAddressForm] = useState<AddressForm>({
    street: '',
    number: '',
    city: '',
    state: 'SP',
    complement: '',
    isRural: false
  });
  
  const [cepInput, setCepInput] = useState('');
  
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history on mount
  useEffect(() => {
    try {
        const saved = localStorage.getItem('cep_search_history');
        if (saved) {
            setHistory(JSON.parse(saved));
        }
    } catch (e) {
        console.error("Failed to load history", e);
    }
  }, []);

  const saveHistory = (newHistory: HistoryItem[]) => {
      setHistory(newHistory);
      localStorage.setItem('cep_search_history', JSON.stringify(newHistory));
  };

  const addToHistory = (currentMode: SearchMode, data: AddressForm | string) => {
      let label = '';
      
      if (currentMode === SearchMode.ADDRESS_TO_CEP) {
          const addr = data as AddressForm;
          const streetLabel = addr.isRural ? 'Rural' : addr.street;
          label = `${streetLabel}, ${addr.number} - ${addr.city}/${addr.state}`;
          if (addr.isRural) label += ' (Rural)';
      } else {
          label = `CEP: ${data as string}`;
      }

      const newItem: HistoryItem = {
          mode: currentMode,
          data,
          label,
          timestamp: Date.now()
      };

      // Remove duplicates (simple check based on label) and keep recent
      const filtered = history.filter(h => h.label !== label);
      const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      
      saveHistory(updated);
  };

  const clearHistory = () => {
      saveHistory([]);
  };

  const handleAddressChange = (field: keyof AddressForm) => (val: string | boolean) => {
    setAddressForm(prev => ({ ...prev, [field]: val }));
  };

  const handleCepChange = (val: string) => {
    let v = val.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = `${v.slice(0, 5)}-${v.slice(5)}`;
    setCepInput(v);
  };

  // Reusable search logic
  const executeSearch = async (searchMode: SearchMode, searchData: AddressForm | string) => {
    setLoading(LoadingState.LOADING);
    setResult(null);
    setError('');
    setCopied(false);

    try {
        let data: SearchResult;
        
        if (searchMode === SearchMode.ADDRESS_TO_CEP) {
            const form = searchData as AddressForm;
             if (!form.street || !form.number || !form.city || !form.state) {
                throw new Error("Dados incompletos para a busca.");
            }
            data = await findCep(form);
        } else {
            const cep = searchData as string;
            if (cep.replace(/\D/g, '').length !== 8) {
                throw new Error("CEP inválido.");
            }
            data = await findAddress(cep);
        }

        setResult(data);
        setLoading(LoadingState.SUCCESS);

        // Only save to history if found
        if (data.found) {
            addToHistory(searchMode, searchData);
        }

    } catch (err: any) {
        console.error(err);
        setError(err.message || "Erro na comunicação. Tente novamente.");
        setLoading(LoadingState.ERROR);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation before calling execute
    if (mode === SearchMode.ADDRESS_TO_CEP) {
        if (!addressForm.street || !addressForm.number || !addressForm.city || !addressForm.state) {
            setError("Preencha campos obrigatórios: Cidade, UF, Endereço e Número.");
            return;
        }
        await executeSearch(mode, addressForm);
    } else {
        if (cepInput.length < 9) {
            setError("Digite um CEP válido (8 dígitos).");
            return;
        }
        await executeSearch(mode, cepInput);
    }
  };

  const handleHistoryClick = (item: HistoryItem) => {
      // Update UI state to match history item
      setMode(item.mode);
      if (item.mode === SearchMode.ADDRESS_TO_CEP) {
          setAddressForm(item.data as AddressForm);
      } else {
          setCepInput(item.data as string);
      }
      
      // Trigger search
      executeSearch(item.mode, item.data);
  };

  const toggleMode = (newMode: SearchMode) => {
    setMode(newMode);
    setResult(null);
    setError('');
    setCopied(false);
  };

  const copyToClipboard = () => {
    if (result?.mainText) {
      navigator.clipboard.writeText(result.mainText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getConfidenceConfig = (level: string) => {
      switch(level) {
          case 'high': 
            return { 
                text: 'Alta Confiabilidade', 
                classes: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500/20', 
                icon: ShieldCheckIcon 
            };
          case 'medium': 
            return { 
                text: 'Média Confiabilidade', 
                classes: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-500/20',
                icon: ExclamationTriangleIcon 
            };
          case 'low': 
            return { 
                text: 'Baixa Confiabilidade', 
                classes: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-500/20',
                icon: ExclamationTriangleIcon
            };
          default: 
            return { 
                text: 'Verificado', 
                classes: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-500/20',
                icon: ShieldCheckIcon 
            };
      }
  };

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center p-4 lg:p-8 font-sans text-slate-900">
      
      {/* Main Desktop Container */}
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[600px] ring-1 ring-slate-900/5">
        
        {/* Left Column: Form Area - Scrollable if content overflows */}
        <div className="lg:col-span-5 flex flex-col bg-white z-10 h-full max-h-[90vh] lg:max-h-[800px] overflow-y-auto custom-scrollbar">
            <div className="p-8 lg:p-10 flex flex-col flex-grow">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 text-indigo-600 mb-2">
                        <MapPinIcon className="w-6 h-6" />
                        <span className="font-bold tracking-tight text-lg">BuscaCEP.ai</span>
                    </div>
                    <h1 className="text-3xl font-extrabold text-slate-900 leading-tight">
                        Localize endereços <br/> com precisão.
                    </h1>
                </div>

                {/* Mode Toggle */}
                <div className="bg-slate-100 p-1.5 rounded-xl flex mb-8 flex-shrink-0">
                    <button 
                        onClick={() => toggleMode(SearchMode.ADDRESS_TO_CEP)}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                            mode === SearchMode.ADDRESS_TO_CEP 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Buscar CEP
                    </button>
                    <button 
                        onClick={() => toggleMode(SearchMode.CEP_TO_ADDRESS)}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 ${
                            mode === SearchMode.CEP_TO_ADDRESS 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        Buscar Endereço
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 mb-8">
                    {mode === SearchMode.ADDRESS_TO_CEP ? (
                        <>
                            {/* Rural Toggle */}
                            <div className="flex items-center gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox"
                                        id="rural-checkbox"
                                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-indigo-300 transition-all checked:border-indigo-600 checked:bg-indigo-600 focus:ring-2 focus:ring-indigo-200"
                                        checked={addressForm.isRural || false}
                                        onChange={(e) => handleAddressChange('isRural')(e.target.checked)}
                                    />
                                    <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                        </svg>
                                    </div>
                                </div>
                                <label htmlFor="rural-checkbox" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                                    Endereço de <span className="text-indigo-600 font-bold">Zona Rural / Sítio</span>
                                </label>
                            </div>

                            <div className="grid grid-cols-12 gap-4">
                                <div className="col-span-4 relative group">
                                    <label htmlFor="uf-select" className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">
                                        UF
                                    </label>
                                    <div className="relative">
                                        <select 
                                            id="uf-select"
                                            className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-slate-800 text-sm font-medium appearance-none cursor-pointer"
                                            value={addressForm.state}
                                            onChange={(e) => handleAddressChange('state')(e.target.value)}
                                        >
                                            {STATES.map(uf => (
                                                <option key={uf} value={uf}>{uf}</option>
                                            ))}
                                        </select>
                                        <ChevronDownIcon className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="col-span-8">
                                    <InputField 
                                        id="city-input"
                                        label="Cidade" 
                                        value={addressForm.city} 
                                        onChange={handleAddressChange('city')} 
                                        placeholder="Ex: Piracicaba" 
                                    />
                                </div>
                                <div className="col-span-12">
                                    <InputField 
                                        id="street-input"
                                        label={addressForm.isRural ? "Nome da Propriedade / Estrada" : "Endereço (Rua/Av)"} 
                                        value={addressForm.street} 
                                        onChange={handleAddressChange('street')} 
                                        placeholder={addressForm.isRural ? "Ex: Sítio Santa Luzia" : "Ex: Av. Paulista"} 
                                    />
                                </div>
                                <div className="col-span-4">
                                    <InputField 
                                        id="number-input"
                                        label={addressForm.isRural ? "Referência / KM" : "Número"}
                                        value={addressForm.number} 
                                        onChange={handleAddressChange('number')} 
                                        placeholder={addressForm.isRural ? "Km 12" : "123"} 
                                    />
                                </div>
                                <div className="col-span-8">
                                    <InputField 
                                        id="complement-input"
                                        label="Comp. (Opcional)" 
                                        value={addressForm.complement || ''} 
                                        onChange={handleAddressChange('complement')} 
                                        placeholder="Apto 101" 
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-8">
                            <label htmlFor="cep-input" className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wider">
                                Digite o CEP
                            </label>
                            <input
                                id="cep-input"
                                type="text"
                                value={cepInput}
                                onChange={(e) => handleCepChange(e.target.value)}
                                placeholder="00000-000"
                                className="w-full text-left text-4xl font-bold tracking-wider p-0 border-none bg-transparent focus:ring-0 outline-none text-slate-900 placeholder-slate-200"
                                maxLength={9}
                                inputMode="numeric"
                            />
                            <div className="h-px w-full bg-slate-200 mt-2"></div>
                            <p className="text-slate-400 text-xs mt-2">Digite apenas números</p>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-100 flex items-center gap-2 text-rose-600 text-sm animate-fade-in">
                        <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                        {error}
                        </div>
                    )}

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading === LoadingState.LOADING}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all transform active:scale-[0.99] disabled:opacity-70 disabled:scale-100 flex justify-center items-center gap-2"
                        >
                            {loading === LoadingState.LOADING ? (
                                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            ) : (
                                <MagnifyingGlassIcon className="h-5 w-5" />
                            )}
                            {loading === LoadingState.LOADING ? 'Processando...' : 'Pesquisar Agora'}
                        </button>
                    </div>
                </form>

                {/* History Section */}
                {history.length > 0 && (
                    <div className="mt-auto pt-6 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <ClockIcon className="w-3.5 h-3.5" />
                                Recentes
                            </h4>
                            <button onClick={clearHistory} className="text-[10px] text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-1">
                                <TrashIcon className="w-3 h-3" />
                                Limpar
                            </button>
                        </div>
                        <ul className="space-y-2">
                            {history.map((item, index) => (
                                <li key={index}>
                                    <button 
                                        onClick={() => handleHistoryClick(item)}
                                        className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all group flex items-start gap-3"
                                    >
                                        <div className="mt-0.5 text-slate-400 group-hover:text-indigo-500 transition-colors">
                                            {item.mode === SearchMode.ADDRESS_TO_CEP ? (
                                                (item.data as AddressForm).isRural ? 
                                                    <SunIcon className="w-4 h-4 text-emerald-500" /> : 
                                                    <MapPinIcon className="w-4 h-4" />
                                            ) : (
                                                <div className="w-4 h-4 font-bold text-[10px] border border-current rounded flex items-center justify-center">#</div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-medium text-slate-700 truncate group-hover:text-slate-900">
                                                {item.label}
                                            </p>
                                            <p className="text-[10px] text-slate-400">
                                                {new Date(item.timestamp).toLocaleDateString('pt-BR')} • {new Date(item.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit'})}
                                            </p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>

        {/* Right Column: Result / Hero Area */}
        <div className="lg:col-span-7 bg-slate-50 border-l border-slate-100 relative overflow-hidden flex flex-col justify-center items-center p-10 text-center min-h-[500px]">
            
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-blue-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-indigo-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

            <div className="relative z-10 w-full max-w-lg">
                {result && loading === LoadingState.SUCCESS ? (
                    <div className="animate-fade-in text-left bg-white p-8 rounded-2xl shadow-sm border border-slate-100 ring-1 ring-slate-900/5">
                        <div className="flex items-center justify-between mb-6">
                            {(() => {
                                const conf = getConfidenceConfig(result.confidence);
                                const Icon = conf.icon;
                                return (
                                    <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full border ring-1 flex items-center gap-1.5 ${conf.classes}`}>
                                        <Icon className="w-3.5 h-3.5" />
                                        {conf.text}
                                    </span>
                                );
                            })()}
                            <div className="flex gap-2">
                                <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider">
                                    {mode === SearchMode.ADDRESS_TO_CEP ? 'CEP Encontrado' : 'Endereço'}
                                </span>
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="group relative inline-block">
                                <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-none mb-2 break-words">
                                    {result.mainText}
                                </h2>
                                <button 
                                    onClick={copyToClipboard}
                                    className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg"
                                    title="Copiar"
                                >
                                    {copied ? <ClipboardDocumentCheckIcon className="w-6 h-6" /> : <ClipboardDocumentIcon className="w-6 h-6" />}
                                </button>
                            </div>
                        </div>

                        {result.secondaryText && (
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                <p className="text-slate-600 text-sm font-medium leading-relaxed">
                                    {result.secondaryText}
                                </p>
                            </div>
                        )}
                        
                        {copied && (
                            <div className="mt-4 text-center">
                                <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-3 py-1 rounded-full">
                                    <ClipboardDocumentCheckIcon className="w-3 h-3" />
                                    Copiado com sucesso!
                                </span>
                            </div>
                        )}
                    </div>
                ) : result && !result.found ? (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-rose-100 text-center animate-fade-in">
                        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ExclamationTriangleIcon className="w-8 h-8 text-rose-500" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Não encontrado</h3>
                        <p className="text-slate-500">{result.secondaryText || "Não conseguimos localizar o endereço com os dados informados."}</p>
                    </div>
                ) : (
                    <div className="text-slate-400">
                        {loading === LoadingState.LOADING ? (
                            <div className="flex flex-col items-center animate-pulse">
                                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                                    <ArrowPathIcon className="w-10 h-10 text-indigo-400 animate-spin" />
                                </div>
                                <h3 className="text-xl font-medium text-slate-900 mb-2">Analisando dados...</h3>
                                <p className="text-sm text-slate-500 max-w-xs mx-auto">
                                    Estamos cruzando informações em múltiplas fontes para garantir precisão.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center">
                                <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-6 ring-1 ring-slate-100">
                                    <SparklesIcon className="w-12 h-12 text-indigo-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-2">Pronto para buscar</h3>
                                <p className="text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
                                    Preencha os dados ao lado para obter o CEP ou endereço verificado instantaneamente.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Info */}
            <div className="absolute bottom-6 w-full text-center px-6">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                    Segurança e Precisão via Gemini AI
                </p>
            </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        /* Custom scrollbar for left panel */
        .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: #e2e8f0;
            border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: #cbd5e1;
        }
      `}</style>
    </div>
  );
}