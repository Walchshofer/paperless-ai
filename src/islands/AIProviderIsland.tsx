import { h, ComponentChildren } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { AIProviderSettings } from '../ui/contracts/Settings.AIProvider.contract';
import { AIProviderSettingsSchema } from '../ui/contracts/Settings.AIProvider.contract';
import { RangeNumberInput } from './components/RangeNumberInput';

/**
 * AIProviderIsland - Precision AI Infrastructure Management
 *
 * Implements the "Cyber Lab" aesthetic for high-density expert model configuration.
 * Optimized for readability, logical grouping, and rapid configuration.
 */

interface AIProviderProps extends Partial<AIProviderSettings> {
  expertModels?: Record<string, unknown>;
}

/** Inline tooltip: renders a circled "?" with hover text */
function Tooltip({ text }: { text: string }) {
  return (
    <span className="ai-tooltip-wrapper" data-testid="tooltip">
      <span className="ai-tooltip-icon" tabIndex={0} aria-label={text}>?</span>
      <span className="ai-tooltip-content">{text}</span>
    </span>
  );
}

/** 
 * ModelCard - Precision model configuration component
 */
function ModelCard({
  id,
  title,
  description,
  name,
  promptId,
  limits,
  onNameChange,
  onLimitsChange,
  onReset,
  testId,
  showPromptLink = false
}: {
  id: string;
  title: string;
  description: string;
  name: string;
  promptId?: string;
  limits: { contextWindow: number; maxResponseTokens: number };
  onNameChange: (name: string) => void;
  onLimitsChange: (limits: { contextWindow: number; maxResponseTokens: number }) => void;
  onReset?: () => void;
  testId: string;
  showPromptLink?: boolean;
}) {
  return (
    <div className="model-config-card p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm hover:shadow-md transition-all flex flex-col h-full group" data-testid={testId}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-500 transition-colors">
              {title}
            </h4>
            {showPromptLink && promptId && (
              <a 
                href={`#prompts/${promptId}`}
                title={`View ${promptId} Template`}
                className="text-[9px] bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-100 dark:border-cyan-800 hover:bg-cyan-100 transition-colors inline-flex items-center gap-1 font-mono"
              >
                <i className="fas fa-terminal scale-75"></i>
                {promptId}
              </a>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight line-clamp-2" title={description}>{description}</p>
        </div>
        {onReset && (
          <button
            onClick={onReset}
            title="Reset to factory default"
            className="p-1 text-slate-300 hover:text-cyan-500 transition-colors flex-shrink-0"
            data-testid={`${id}-reset`}
          >
            <i className="fas fa-undo-alt text-[10px]"></i>
          </button>
        )}
      </div>

      <div className="space-y-3 mt-auto">
        <div className="space-y-1.5">
          <input
            id={`${id}-name`}
            type="text"
            value={name}
            onInput={(e: Event) => onNameChange((e.target as HTMLInputElement).value)}
            placeholder="e.g. llama3.1:8b"
            className="w-full px-2.5 py-1.5 rounded-lg text-xs font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-cyan-50 focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 outline-none transition-all"
            data-testid={`${id}-input`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Context</label>
            <div className="relative">
              <input
                type="number"
                value={limits.contextWindow}
                onInput={(e: Event) => onLimitsChange({ ...limits, contextWindow: parseInt((e.target as HTMLInputElement).value) || 0 })}
                className="w-full pl-2 pr-6 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-mono outline-none focus:border-cyan-500"
                data-testid={`${id}-context-window`}
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 pointer-events-none">CTX</span>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Output</label>
            <div className="relative">
              <input
                type="number"
                value={limits.maxResponseTokens}
                onInput={(e: Event) => onLimitsChange({ ...limits, maxResponseTokens: parseInt((e.target as HTMLInputElement).value) || 0 })}
                className="w-full pl-2 pr-6 py-1 rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] font-mono outline-none focus:border-cyan-500"
                data-testid={`${id}-max-response`}
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400 pointer-events-none">OUT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 
 * CyberLabSection - High-density collapsible grouping component
 */
function CyberLabSection({
  id, title, description, icon, color, expanded, onToggle, children, testId, badge
}: {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: 'indigo' | 'cyan' | 'rose' | 'emerald' | 'amber' | 'purple';
  expanded: boolean;
  onToggle: () => void;
  children: ComponentChildren;
  testId: string;
  badge?: string | number;
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-100 dark:border-cyan-800/50',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 border-rose-100 dark:border-rose-800/50',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-800/50',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 border-purple-100 dark:border-purple-800/50',
  };

  const accentColors = {
    indigo: 'bg-indigo-500',
    cyan: 'bg-cyan-500',
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className={`cyber-lab-section rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 overflow-hidden transition-all duration-300 ${expanded ? 'ring-1 ring-slate-200 dark:ring-slate-700 shadow-lg' : 'shadow-sm'}`} data-testid={testId}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-4 transition-colors ${expanded ? 'bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-4 text-left">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colors[color]}`}>
            <i className={`fas ${icon} text-sm`}></i>
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5 line-clamp-1">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {badge && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${colors[color]} border-none`}>
              {badge}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="p-6 relative">
          <div className={`absolute top-0 left-0 w-1 h-full ${accentColors[color]} opacity-20`}></div>
          {children}
        </div>
      )}
    </div>
  );
}

export default function AIProviderIsland(props: AIProviderProps) {
  // GöÇGöÇ CORE STATE GöÇGöÇ
  const [isLoading, setIsLoading] = useState(!props.provider);
  const [configData, setConfigData] = useState<any>(null);
  
  type ProviderTab = 'general' | 'openai' | 'ollama' | 'custom' | 'azure';
  const [activeTab, setActiveTab] = useState('general' as ProviderTab);

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null as string | null);
  const markDirty = () => setIsDirty(true);

  const [provider, setProvider] = useState('openai' as string);
  const [developerMode, setDeveloperMode] = useState(false);

  // GöÇGöÇ GLOBAL SETTINGS GöÇGöÇ
  const [textQualityThreshold, setTextQualityThreshold] = useState(60);
  const [maxVisionPages, setMaxVisionPages] = useState(4);

  // GöÇGöÇ OPENAI GöÇGöÇ
  const [openaiModel, setOpenaiModel] = useState({
    name: 'gpt-4o',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });

  // GöÇGöÇ OLLAMA CORE GöÇGöÇ
  const [ollamaText, setOllamaText] = useState({
    name: 'sauerkraut-llama3.1:8b',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [ollamaVision, setOllamaVision] = useState({
    name: 'qwen3-vl:8b',
    limits: { contextWindow: 32768, maxResponseTokens: 2048 }
  });

  // GöÇGöÇ OLLAMA PIPELINE GöÇGöÇ
  const [ollamaRouter, setOllamaRouter] = useState({
    name: '',
    limits: { contextWindow: 32768, maxResponseTokens: 2048 }
  });
  const [ollamaPlanner, setOllamaPlanner] = useState({
    name: '',
    limits: { contextWindow: 32768, maxResponseTokens: 2048 }
  });
  const [ollamaOrchestrator, setOllamaOrchestrator] = useState({
    name: '',
    limits: { contextWindow: 32768, maxResponseTokens: 2048 }
  });
  const [ollamaGuidance, setOllamaGuidance] = useState({
    name: '',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });

  // GöÇGöÇ OLLAMA SPECIALIZED GöÇGöÇ
  const [ollamaTranslation, setOllamaTranslation] = useState({
    name: '',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [ollamaImageTokenOverhead, setOllamaImageTokenOverhead] = useState(1024);

  // GöÇGöÇ EXPERT: MEDICAL GöÇGöÇ
  const [medVision, setMedVision] = useState({
    name: 'llava-med-v1.6',
    limits: { contextWindow: 32768, maxResponseTokens: 4096 }
  });
  const [medAnalysis, setMedAnalysis] = useState({
    name: 'medtext-llama3',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [medRadiology, setMedRadiology] = useState({
    name: 'llava-med-v1.6',
    limits: { contextWindow: 32768, maxResponseTokens: 4096 }
  });
  const [medIntegrator, setMedIntegrator] = useState({
    name: 'medtext-llama3',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });

  // GöÇGöÇ EXPERT: FINANCIAL GöÇGöÇ
  const [finVision, setFinVision] = useState({
    name: 'llm-pro-finance-8b',
    limits: { contextWindow: 32768, maxResponseTokens: 4096 }
  });
  const [finAnalysis, setFinAnalysis] = useState({
    name: 'fino1-8b',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [finReasoner, setFinReasoner] = useState({
    name: 'fino1-8b',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [finVatExpert, setFinVatExpert] = useState({
    name: 'llm-pro-finance-8b',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });

  // GöÇGöÇ EXPERT: LEGAL GöÇGöÇ
  const [legalVision, setLegalVision] = useState({
    name: 'qwen3-vl:8b',
    limits: { contextWindow: 32768, maxResponseTokens: 4096 }
  });
  const [legalAnalysis, setLegalAnalysis] = useState({
    name: 'gpt-oss',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [legalOrchestrator, setLegalOrchestrator] = useState({
    name: '',
    limits: { contextWindow: 32768, maxResponseTokens: 2048 }
  });

  // GöÇGöÇ CUSTOM & AZURE GöÇGöÇ
  const [customModel, setCustomModel] = useState({
    name: '',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [azureModel, setAzureModel] = useState({
    name: '',
    limits: { contextWindow: 128000, maxResponseTokens: 4096 }
  });
  const [azureApiVersion, setAzureApiVersion] = useState('2023-05-15');

  // GöÇGöÇ UI INTERACTION STATE GöÇGöÇ
  const expertRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const hasPendingAutoSave = useRef(false);
  const [expertAnnouncement, setExpertAnnouncement] = useState<string | null>(null);

  // Group expansion state (Accordion style)
  const [expandedSection, setExpandedSection] = useState<string | null>('core');

  // GöÇGöÇ HYDRATION EFFECTS GöÇGöÇ

  useEffect(() => {
    if (configData) return;
    fetch('/api/settings/config')
      .then(res => res.json())
      .then(data => {
        if (data && data.aiProvider) setConfigData(data.aiProvider);
        else setConfigData({});
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch AI provider config', err);
        setConfigData({});
        setIsLoading(false);
      });
  }, [configData]);

  useEffect(() => {
    if (!configData) return;
    const v = configData;
    setProvider(v.provider || 'openai');
    setTextQualityThreshold(v.qualitySettings?.textQualityThreshold ?? 60);
    setMaxVisionPages(v.qualitySettings?.maxVisionPages ?? 4);

    if (v.openai?.model) {
      setOpenaiModel({
        name: v.openai.model.name || 'gpt-4o',
        limits: v.openai.model.limits || { contextWindow: 128000, maxResponseTokens: 4096 }
      });
    }

    if (v.ollama) {
      setOllamaText({
        name: v.ollama.text?.name || v.ollama.model || 'sauerkraut-llama3.1:8b',
        limits: v.ollama.text?.limits || { contextWindow: 128000, maxResponseTokens: 4096 }
      });
      setOllamaVision({
        name: v.ollama.vision?.name || v.ollama.visionModel || 'qwen3-vl:8b',
        limits: v.ollama.vision?.limits || { contextWindow: 32768, maxResponseTokens: 2048 }
      });
      setOllamaRouter({
        name: v.ollama.router?.name || '',
        limits: v.ollama.router?.limits || { contextWindow: 32768, maxResponseTokens: 2048 }
      });
      setOllamaPlanner({
        name: v.ollama.planner?.name || '',
        limits: v.ollama.planner?.limits || { contextWindow: 32768, maxResponseTokens: 2048 }
      });
      setOllamaOrchestrator({
        name: v.ollama.orchestrator?.name || '',
        limits: v.ollama.orchestrator?.limits || { contextWindow: 32768, maxResponseTokens: 2048 }
      });
      setOllamaGuidance({
        name: v.ollama.guidance?.name || '',
        limits: v.ollama.guidance?.limits || { contextWindow: 128000, maxResponseTokens: 4096 }
      });
      setOllamaTranslation({
        name: v.ollama.translation?.name || '',
        limits: v.ollama.translation?.limits || { contextWindow: 128000, maxResponseTokens: 4096 }
      });
      setOllamaImageTokenOverhead(v.ollama.limits?.imageTokenOverhead || 1024);
    }

    if (v.expertModels) {
      const e = v.expertModels;
      if (e.medical) {
        setMedVision({ name: e.medical.vision?.name || 'llava-med-v1.6', limits: e.medical.vision?.limits || { contextWindow: 32768, maxResponseTokens: 4096 } });
        setMedAnalysis({ name: e.medical.analysis?.name || 'medtext-llama3', limits: e.medical.analysis?.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
        setMedRadiology({ name: e.medical.radiology?.name || 'llava-med-v1.6', limits: e.medical.radiology?.limits || { contextWindow: 32768, maxResponseTokens: 4096 } });
        setMedIntegrator({ name: e.medical.integrator?.name || 'medtext-llama3', limits: e.medical.integrator?.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
      }
      if (e.financial) {
        setFinVision({ name: e.financial.vision?.name || 'llm-pro-finance-8b', limits: e.financial.vision?.limits || { contextWindow: 32768, maxResponseTokens: 4096 } });
        setFinAnalysis({ name: e.financial.analysis?.name || 'fino1-8b', limits: e.financial.analysis?.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
        setFinReasoner({ name: e.financial.reasoning?.name || 'fino1-8b', limits: e.financial.reasoning?.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
        setFinVatExpert({ name: e.financial.vatExpert?.name || 'llm-pro-finance-8b', limits: e.financial.vatExpert?.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
      }
      if (e.legal) {
        setLegalVision({ name: e.legal.vision?.name || 'qwen3-vl:8b', limits: e.legal.vision?.limits || { contextWindow: 32768, maxResponseTokens: 4096 } });
        setLegalAnalysis({ name: e.legal.analysis?.name || 'gpt-oss', limits: e.legal.analysis?.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
        setLegalOrchestrator({ name: e.legal.orchestrator?.name || '', limits: e.legal.orchestrator?.limits || { contextWindow: 32768, maxResponseTokens: 2048 } });
      }
    }

    if (v.custom?.model) setCustomModel({ name: v.custom.model.name || '', limits: v.custom.model.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
    if (v.azure) {
      setAzureModel({ name: v.azure.deploymentName || '', limits: v.azure.model?.limits || { contextWindow: 128000, maxResponseTokens: 4096 } });
      setAzureApiVersion(v.azure.apiVersion || '2023-05-15');
    }
  }, [configData]);

  // GöÇGöÇ INFRASTRUCTURE HANDLERS GöÇGöÇ

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      const settings: Record<string, string> = {
        AI_PROVIDER: provider,
        TEXT_QUALITY_THRESHOLD: textQualityThreshold.toString(),
        MAX_VISION_PAGES: maxVisionPages.toString(),
      };
      if (provider === 'ollama') {
        settings.OLLAMA_MODEL = ollamaText.name;
        settings.OLLAMA_VISION_MODEL = ollamaVision.name;
        settings.ROUTER_MODEL = ollamaRouter.name;
        settings.PLANNER_MODEL = ollamaPlanner.name;
        settings.ORCHESTRATOR_MODEL = ollamaOrchestrator.name;
        settings.GUIDANCE_MODEL = ollamaGuidance.name;
        settings.TRANSLATION_MODEL = ollamaTranslation.name;
        settings.MEDICAL_VISION_MODEL = medVision.name;
        settings.MEDICAL_ANALYSIS_MODEL = medAnalysis.name;
        settings.MEDICAL_RADIOLOGY_MODEL = medRadiology.name;
        settings.MEDICAL_INTEGRATOR_MODEL = medIntegrator.name;
        settings.FINANCIAL_VISION_MODEL = finVision.name;
        settings.FINANCIAL_ANALYSIS_MODEL = finAnalysis.name;
        settings.FINANCIAL_REASONING_MODEL = finReasoner.name;
        settings.FINANCIAL_VAT_EXPERT = finVatExpert.name;
        settings.LEGAL_VISION_MODEL = legalVision.name;
        settings.LEGAL_ANALYSIS_MODEL = legalAnalysis.name;
        settings.LEGAL_ORCHESTRATOR_MODEL = legalOrchestrator.name;
        settings.OLLAMA_CONTEXT_WINDOW = ollamaText.limits.contextWindow.toString();
        settings.OLLAMA_MAX_RESPONSE_TOKENS = ollamaText.limits.maxResponseTokens.toString();
        settings.OLLAMA_VISION_CONTEXT_WINDOW = ollamaVision.limits.contextWindow.toString();
        settings.OLLAMA_VISION_MAX_RESPONSE_TOKENS = ollamaVision.limits.maxResponseTokens.toString();
        settings.OLLAMA_VISION_IMAGE_TOKENS = ollamaImageTokenOverhead.toString();
      } else if (provider === 'openai') {
        settings.PAPERLESS_OPENAI_MODEL = openaiModel.name;
        settings.OPENAI_CONTEXT_WINDOW = openaiModel.limits.contextWindow.toString();
        settings.OPENAI_MAX_RESPONSE_TOKENS = openaiModel.limits.maxResponseTokens.toString();
      } else if (provider === 'custom') {
        settings.CUSTOM_MODEL = customModel.name;
        settings.CUSTOM_CONTEXT_WINDOW = customModel.limits.contextWindow.toString();
        settings.CUSTOM_MAX_RESPONSE_TOKENS = customModel.limits.maxResponseTokens.toString();
      } else if (provider === 'azure') {
        settings.AZURE_DEPLOYMENT_NAME = azureModel.name;
        settings.AZURE_API_VERSION = azureApiVersion;
        settings.AZURE_CONTEXT_WINDOW = azureModel.limits.contextWindow.toString();
        settings.AZURE_MAX_RESPONSE_TOKENS = azureModel.limits.maxResponseTokens.toString();
      }
      const response = await fetch('/api/settings/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      const result = await response.json();
      if (response.ok && result.success) {
        setSaveMessage('Infrastructure configuration synchronized successfully.');
        setIsDirty(false);
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:changed', { detail: { category: 'ai-provider', settings, requiresRestart: true } }));
          document.dispatchEvent(new CustomEvent('settings:saved', { detail: { category: 'ai-provider', success: true } }));
        }
      } else {
        setSaveMessage(`Synchronization failure: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setSaveMessage(`Synchronization failure: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  /** Reset expert domain model specifically */
  const handleResetExpert = (domain: 'medical' | 'financial' | 'legal', role: string, setter: (v: any) => void) => {
    const defaultData = (configData?.defaults?.expert as any)?.[domain]?.[role];
    if (defaultData) {
      setter({ name: defaultData.name || '', limits: { contextWindow: defaultData.limits?.contextWindow || 128000, maxResponseTokens: defaultData.limits?.maxResponseTokens || 4096 } });
      markDirty();
    }
  };

  const handleResetModel = (modelKey: string, setter: (v: any) => void, defaultsSource: any = configData?.defaults?.ollama) => {
    // Handle different nesting structures in defaults
    const defaultData = defaultsSource?.[modelKey] || defaultsSource;
    if (defaultData && typeof defaultData === 'object' && ('name' in defaultData || 'model' in defaultData)) {
      setter({ 
        name: defaultData.name || defaultData.model || '', 
        limits: { 
          contextWindow: defaultData.limits?.contextWindow || 128000, 
          maxResponseTokens: defaultData.limits?.maxResponseTokens || 4096 
        } 
      });
      markDirty();
    }
  };

  // GöÇGöÇ RENDER HELPERS GöÇGöÇ

  if (isLoading || !configData) {
    return (
      <div className="p-12 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold tracking-widest uppercase text-slate-400">Initializing Laboratory Interface...</p>
      </div>
    );
  }

  return (
    <div className="ai-provider-settings space-y-8 p-6 max-w-6xl mx-auto" data-testid="ai-provider-root">
      {/* Precision Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-6 bg-cyan-500 rounded-full shadow-[0_0_8px_rgba(6,182,212,0.5)]"></div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">AI Infrastructure</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Define expert model topology and performance constraints.
          </p>
        </div>
      </div>

      {/* Tab Interface */}
      <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl w-fit border border-slate-200 dark:border-slate-800">
        {(['general', 'openai', 'ollama', 'custom', 'azure'] as ProviderTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${
              activeTab === tab
                ? 'bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            data-testid={`tab-${tab}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="mt-2 min-h-[400px]">
        {/* GöüGöü GENERAL GöüGöü */}
        {activeTab === 'general' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300" data-testid="tab-content-general">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-microchip text-indigo-500 text-xs"></i>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Primary Provider</h3>
                </div>
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 shadow-sm">
                  <label htmlFor="provider" className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Active Protocol</label>
                  <select
                    id="provider"
                    value={provider}
                    onChange={(e: Event) => {
                      const val = (e.target as HTMLSelectElement).value;
                      setProvider(val);
                      markDirty();
                      if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent('settings:provider-changed', { detail: { provider: val } }));
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-bold focus:ring-2 focus:ring-cyan-500/20 outline-none appearance-none"
                    data-testid="provider-select"
                  >
                    <option value="openai">OpenAI (Cloud)</option>
                    <option value="ollama">Ollama (Local Infrastructure)</option>
                    <option value="custom">Custom Proxy Protocol</option>
                    <option value="azure">Azure Enterprise OpenAI</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <i className="fas fa-gauge-high text-emerald-500 text-xs"></i>
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Quality Gates</h3>
                </div>
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase flex justify-between">
                      <span>OCR Quality Threshold</span>
                      <span className="text-cyan-500 font-mono">{textQualityThreshold}%</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <input type="range" min={0} max={100} value={textQualityThreshold} onInput={(e: Event) => { setTextQualityThreshold(parseInt((e.target as HTMLInputElement).value)); markDirty(); }} className="flex-1 accent-cyan-500 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                      <input type="number" min={0} max={100} value={textQualityThreshold} onInput={(e: Event) => { setTextQualityThreshold(parseInt((e.target as HTMLInputElement).value)); markDirty(); }} className="w-16 px-2 py-1 rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono text-center outline-none" data-testid="text-quality-threshold-input" />
                    </div>
                  </div>
                  <RangeNumberInput
                    id="max-vision-pages"
                    label="Vision Page Budget"
                    description="Maximum pages for multimodal visual analysis."
                    value={maxVisionPages}
                    min={1} max={20} step={1} unit="pages"
                    onChange={(v) => { setMaxVisionPages(v); markDirty(); }}
                    testId="max-vision-pages-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GöüGöü OPENAI GöüGöü */}
        {activeTab === 'openai' && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300 space-y-6" data-testid="tab-content-openai">
            <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10 flex items-center gap-3" data-testid="connection-center-note">
              <i className="fas fa-info-circle text-indigo-500"></i>
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Credentials migrated to Connection Center</p>
            </div>
            
            <CyberLabSection
              id="openai-core"
              title="Cloud Backbone"
              description="Primary enterprise models for cloud-based reasoning."
              icon="fa-cloud"
              color="indigo"
              expanded={true}
              onToggle={() => {}}
              testId="section-openai-core"
            >
              <div className="max-w-md">
                <ModelCard
                  id="openai-main"
                  title="GPT Architecture"
                  description="Primary GPT model for cloud-based reasoning and synthesis."
                  name={openaiModel.name}
                  limits={openaiModel.limits}
                  onNameChange={(name) => { setOpenaiModel({ ...openaiModel, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setOpenaiModel({ ...openaiModel, limits }); markDirty(); }}
                  onReset={() => handleResetModel('model', setOpenaiModel, configData?.defaults?.openai)}
                  testId="openai-model-card"
                />
              </div>
            </CyberLabSection>
          </div>
        )}

        {/* GöüGöü OLLAMA: THE CYBER LAB GöüGöü */}
        {activeTab === 'ollama' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300" data-testid="tab-content-ollama">
            <div className="p-4 rounded-xl border border-cyan-100 dark:border-cyan-900/30 bg-cyan-50/30 dark:bg-cyan-900/10 flex items-center gap-3 mb-4" data-testid="connection-center-note">
              <i className="fas fa-network-wired text-cyan-500"></i>
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">Local Infrastructure Mode Active</p>
            </div>

            {/* 1. Core Vision & Text */}
            <CyberLabSection
              id="ollama-core"
              title="Core Foundation"
              description="Backbone models for multimodal and textual grounding."
              icon="fa-layer-group"
              color="cyan"
              expanded={expandedSection === 'core'}
              onToggle={() => setExpandedSection(expandedSection === 'core' ? null : 'core')}
              testId="section-core"
              badge="Active"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ModelCard
                  id="ollama-text"
                  title="Text Oracle"
                  description="General-purpose grounding and fallback text extraction."
                  name={ollamaText.name}
                  limits={ollamaText.limits}
                  onNameChange={(name) => { setOllamaText({ ...ollamaText, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setOllamaText({ ...ollamaText, limits }); markDirty(); }}
                  onReset={() => handleResetModel('text', setOllamaText)}
                  testId="ollama-text-card"
                  showPromptLink={developerMode}
                />
                <ModelCard
                  id="ollama-vision"
                  title="Vision Sensor"
                  description="High-precision multimodal analysis for layout and images."
                  name={ollamaVision.name}
                  limits={ollamaVision.limits}
                  onNameChange={(name) => { setOllamaVision({ ...ollamaVision, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setOllamaVision({ ...ollamaVision, limits }); markDirty(); }}
                  onReset={() => handleResetModel('vision', setOllamaVision)}
                  testId="ollama-vision-card"
                  showPromptLink={developerMode}
                />
              </div>
            </CyberLabSection>

            {/* 2. System Pipeline */}
            <CyberLabSection
              id="ollama-pipeline"
              title="Pipeline Topology"
              description="Specialized routing and orchestration logic controllers."
              icon="fa-microchip"
              color="indigo"
              expanded={expandedSection === 'pipeline'}
              onToggle={() => setExpandedSection(expandedSection === 'pipeline' ? null : 'pipeline')}
              testId="section-pipeline"
              badge={4}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <ModelCard
                  id="ollama-router"
                  title="Traffic Router"
                  description="Classifies documents and selects experts."
                  name={ollamaRouter.name}
                  limits={ollamaRouter.limits}
                  onNameChange={(name) => { setOllamaRouter({ ...ollamaRouter, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setOllamaRouter({ ...ollamaRouter, limits }); markDirty(); }}
                  onReset={() => handleResetModel('router', setOllamaRouter)}
                  testId="ollama-router-card"
                />
                <ModelCard
                  id="ollama-planner"
                  title="Strategy Planner"
                  description="Generates execution plans for complex tasks."
                  name={ollamaPlanner.name}
                  limits={ollamaPlanner.limits}
                  onNameChange={(name) => { setOllamaPlanner({ ...ollamaPlanner, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setOllamaPlanner({ ...ollamaPlanner, limits }); markDirty(); }}
                  onReset={() => handleResetModel('planner', setOllamaPlanner)}
                  testId="ollama-planner-card"
                />
                <ModelCard
                  id="ollama-orchestrator"
                  title="Orchestrator"
                  description="Coordinates parallel expert execution."
                  name={ollamaOrchestrator.name}
                  limits={ollamaOrchestrator.limits}
                  onNameChange={(name) => { setOllamaOrchestrator({ ...ollamaOrchestrator, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setOllamaOrchestrator({ ...ollamaOrchestrator, limits }); markDirty(); }}
                  onReset={() => handleResetModel('orchestrator', setOllamaOrchestrator)}
                  testId="ollama-orchestrator-card"
                />
                <ModelCard
                  id="ollama-guidance"
                  title="Guidance Controller"
                  description="Ensures deterministic structured JSON output."
                  name={ollamaGuidance.name}
                  limits={ollamaGuidance.limits}
                  onNameChange={(name) => { setOllamaGuidance({ ...ollamaGuidance, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setOllamaGuidance({ ...ollamaGuidance, limits }); markDirty(); }}
                  onReset={() => handleResetModel('guidance', setOllamaGuidance)}
                  testId="ollama-guidance-card"
                />
              </div>
            </CyberLabSection>

            {/* 3. Expert Domains (The Labs) */}
            <CyberLabSection
              id="ollama-experts"
              title="Expert Laboratories"
              description="Domain-specific reasoning for Medical, Financial, and Legal workflows."
              icon="fa-user-md"
              color="rose"
              expanded={expandedSection === 'experts'}
              onToggle={() => setExpandedSection(expandedSection === 'experts' ? null : 'experts')}
              testId="section-experts"
              badge="Domain-Gated"
            >
              {provider === 'ollama' ? (
                <div className="space-y-10">
                  {/* Medical Lab */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[9px] font-black uppercase tracking-widest">Medical Lab</div>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <ModelCard id="med-vision" title="VLM Radiology" description="Medical image grounding." name={medVision.name} limits={medVision.limits} onNameChange={(name) => { setMedVision({ ...medVision, name }); markDirty(); }} onLimitsChange={(limits) => { setMedVision({ ...medVision, limits }); markDirty(); }} onReset={() => handleResetExpert('medical', 'vision', setMedVision)} testId="med-vision-card" />
                      <ModelCard id="med-analysis" title="Clinical Analysis" description="Note & report reasoning." name={medAnalysis.name} limits={medAnalysis.limits} onNameChange={(name) => { setMedAnalysis({ ...medAnalysis, name }); markDirty(); }} onLimitsChange={(limits) => { setMedAnalysis({ ...medAnalysis, limits }); markDirty(); }} onReset={() => handleResetExpert('medical', 'analysis', setMedAnalysis)} testId="med-analysis-card" />
                      <ModelCard id="med-radiology" title="Imaging Expert" description="Specialized radiology." name={medRadiology.name} limits={medRadiology.limits} onNameChange={(name) => { setMedRadiology({ ...medRadiology, name }); markDirty(); }} onLimitsChange={(limits) => { setMedRadiology({ ...medRadiology, limits }); markDirty(); }} onReset={() => handleResetExpert('medical', 'radiology', setMedRadiology)} testId="med-radiology-card" />
                      <ModelCard id="med-integrator" title="Reconciliator" description="Record synchronization." name={medIntegrator.name} limits={medIntegrator.limits} onNameChange={(name) => { setMedIntegrator({ ...medIntegrator, name }); markDirty(); }} onLimitsChange={(limits) => { setMedIntegrator({ ...medIntegrator, limits }); markDirty(); }} onReset={() => handleResetExpert('medical', 'integrator', setMedIntegrator)} testId="med-integrator-card" />
                    </div>
                  </div>

                  {/* Financial Lab */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-widest">Financial Lab</div>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <ModelCard id="fin-vision" title="VLM Invoicing" description="Financial form grounding." name={finVision.name} limits={finVision.limits} onNameChange={(name) => { setFinVision({ ...finVision, name }); markDirty(); }} onLimitsChange={(limits) => { setFinVision({ ...finVision, limits }); markDirty(); }} onReset={() => handleResetExpert('financial', 'vision', setFinVision)} testId="fin-vision-card" />
                      <ModelCard id="fin-analysis" title="Audit Expert" description="Invoice & ledger analysis." name={finAnalysis.name} limits={finAnalysis.limits} onNameChange={(name) => { setFinAnalysis({ ...finAnalysis, name }); markDirty(); }} onLimitsChange={(limits) => { setFinAnalysis({ ...finAnalysis, limits }); markDirty(); }} onReset={() => handleResetExpert('financial', 'analysis', setFinAnalysis)} testId="fin-analysis-card" />
                      <ModelCard id="fin-reasoner" title="Logic Expert" description="Math & consistency QA." name={finReasoner.name} limits={finReasoner.limits} onNameChange={(name) => { setFinReasoner({ ...finReasoner, name }); markDirty(); }} onLimitsChange={(limits) => { setFinReasoner({ ...finReasoner, limits }); markDirty(); }} onReset={() => handleResetExpert('financial', 'reasoning', setFinReasoner)} testId="fin-reasoner-card" />
                      <ModelCard id="fin-vat" title="VAT Compliance" description="Tax rule validation." name={finVatExpert.name} limits={finVatExpert.limits} onNameChange={(name) => { setFinVatExpert({ ...finVatExpert, name }); markDirty(); }} onLimitsChange={(limits) => { setFinVatExpert({ ...finVatExpert, limits }); markDirty(); }} onReset={() => handleResetExpert('financial', 'vatExpert', setFinVatExpert)} testId="fin-vat-card" />
                    </div>
                  </div>

                  {/* Legal Lab */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-black uppercase tracking-widest">Legal Lab</div>
                      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <ModelCard id="legal-vision" title="VLM Legal" description="Layout & clause grounding." name={legalVision.name} limits={legalVision.limits} onNameChange={(name) => { setLegalVision({ ...legalVision, name }); markDirty(); }} onLimitsChange={(limits) => { setLegalVision({ ...legalVision, limits }); markDirty(); }} onReset={() => handleResetExpert('legal', 'vision', setLegalVision)} testId="legal-vision-card" />
                      <ModelCard id="legal-analysis" title="Contract Expert" description="Clause risk assessment." name={legalAnalysis.name} limits={legalAnalysis.limits} onNameChange={(name) => { setLegalAnalysis({ ...legalAnalysis, name }); markDirty(); }} onLimitsChange={(limits) => { setLegalAnalysis({ ...legalAnalysis, limits }); markDirty(); }} onReset={() => handleResetExpert('legal', 'analysis', setLegalAnalysis)} testId="legal-analysis-card" />
                      <ModelCard id="legal-orchestrator" title="Legal Workflow" description="Workflow-specific routing." name={legalOrchestrator.name} limits={legalOrchestrator.limits} onNameChange={(name) => { setLegalOrchestrator({ ...legalOrchestrator, name }); markDirty(); }} onLimitsChange={(limits) => { setLegalOrchestrator({ ...legalOrchestrator, limits }); markDirty(); }} onReset={() => handleResetExpert('legal', 'orchestrator', setLegalOrchestrator)} testId="legal-orchestrator-card" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto">
                    <i className="fas fa-lock text-slate-400"></i>
                  </div>
                  <div className="max-w-xs mx-auto">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">Expert Laboratories Locked</p>
                    <p className="text-xs text-slate-500 mt-1">Select <strong>Ollama</strong> as the primary provider to activate expert reasoning infrastructure.</p>
                  </div>
                </div>
              )}
            </CyberLabSection>

            {/* 4. Infrastructure Services */}
            <CyberLabSection
              id="ollama-specialized"
              title="Infrastructure Services"
              description="Auxiliary services for multilingual support and hardware optimization."
              icon="fa-magic"
              color="purple"
              expanded={expandedSection === 'specialized'}
              onToggle={() => setExpandedSection(expandedSection === 'specialized' ? null : 'specialized')}
              testId="section-specialized"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <ModelCard
                    id="ollama-translation"
                    title="Translation Expert"
                    description="Multilingual translation fallback service."
                    name={ollamaTranslation.name}
                    limits={ollamaTranslation.limits}
                    onNameChange={(name) => { setOllamaTranslation({ ...ollamaTranslation, name }); markDirty(); }}
                    onLimitsChange={(limits) => { setOllamaTranslation({ ...ollamaTranslation, limits }); markDirty(); }}
                    onReset={() => handleResetModel('translation', setOllamaTranslation)}
                    testId="ollama-translation-card"
                  />
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 self-start">
                  <RangeNumberInput
                    id="ollama-vision-image"
                    label="Image Token Overhead"
                    description="Fixed VRAM/Token budget per image patch."
                    value={ollamaImageTokenOverhead}
                    min={128} max={4096} step={128} unit="tokens"
                    onChange={(v) => { setOllamaImageTokenOverhead(v); markDirty(); }}
                    testId="tier-vision-image-tokens"
                  />
                </div>
              </div>
            </CyberLabSection>
          </div>
        )}

        {/* GöüGöü CUSTOM GöüGöü */}
        {activeTab === 'custom' && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 space-y-6" data-testid="tab-content-custom">
            <div className="p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 bg-purple-50/30 dark:bg-purple-900/10 flex items-center gap-3" data-testid="connection-center-note">
              <i className="fas fa-info-circle text-purple-500"></i>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">Endpoint configuration moved to Connection Center</p>
            </div>
            
            <CyberLabSection
              id="custom-core"
              title="Proxy Infrastructure"
              description="Custom OpenAI-compatible API targets and local proxies."
              icon="fa-server"
              color="purple"
              expanded={true}
              onToggle={() => {}}
              testId="section-custom-core"
            >
              <div className="max-w-md">
                <ModelCard
                  id="custom-main"
                  title="Proxy Target"
                  description="Custom OpenAI-compatible API target model identifier."
                  name={customModel.name}
                  limits={customModel.limits}
                  onNameChange={(name) => { setCustomModel({ ...customModel, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setCustomModel({ ...customModel, limits }); markDirty(); }}
                  onReset={() => handleResetModel('model', setCustomModel, configData?.defaults?.custom)}
                  testId="custom-model-card"
                />
              </div>
            </CyberLabSection>
          </div>
        )}

        {/* GöüGöü AZURE GöüGöü */}
        {activeTab === 'azure' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-8" data-testid="tab-content-azure">
            <div className="p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/30 dark:bg-blue-900/10 flex items-center gap-3" data-testid="connection-center-note">
              <i className="fas fa-info-circle text-blue-500"></i>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Resource parameters moved to Connection Center</p>
            </div>
            
            <CyberLabSection
              id="azure-core"
              title="Enterprise Infrastructure"
              description="Microsoft Azure OpenAI service deployments."
              icon="fa-building-shield"
              color="indigo"
              expanded={true}
              onToggle={() => {}}
              testId="section-azure-core"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/20 shadow-sm h-fit">
                  <div className="flex items-center gap-2 mb-4">
                    <i className="fas fa-code-version text-[10px] text-slate-400"></i>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Resource API Version</label>
                  </div>
                  <input type="text" value={azureApiVersion} onInput={(e: Event) => { setAzureApiVersion((e.target as HTMLInputElement).value); markDirty(); }} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-mono outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 dark:text-slate-100" data-testid="azure-api-version-input" placeholder="e.g. 2023-05-15" />
                  <p className="text-[9px] text-slate-500 mt-2">Target the specific Azure resource API version for compatibility.</p>
                </div>
                <ModelCard
                  id="azure-main"
                  title="Deployment ID"
                  description="Azure OpenAI deployment name identifier."
                  name={azureModel.name}
                  limits={azureModel.limits}
                  onNameChange={(name) => { setAzureModel({ ...azureModel, name }); markDirty(); }}
                  onLimitsChange={(limits) => { setAzureModel({ ...azureModel, limits }); markDirty(); }}
                  onReset={() => handleResetModel('model', setAzureModel, configData?.defaults?.azure)}
                  testId="azure-model-card"
                />
              </div>
            </CyberLabSection>
          </div>
        )}
      </div>

      {/* Persistence Controls */}
      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="px-8 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50 disabled:grayscale"
            data-testid="ai-provider-save-button"
          >
            {isSaving ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Synchronizing...
              </span>
            ) : 'Commit Infrastructure Changes'}
          </button>
          {isDirty && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <i className="fas fa-triangle-exclamation text-[10px] text-amber-500 animate-pulse"></i>
              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Pending Mutations</span>
            </div>
          )}
        </div>
        {saveMessage && (
          <div className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${saveMessage.includes('failure') ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-cyan-50 text-cyan-700 border border-cyan-100'}`} data-testid="save-message">
            <i className={`fas ${saveMessage.includes('failure') ? 'fa-circle-xmark' : 'fa-circle-check'}`}></i>
            {saveMessage}
          </div>
        )}
      </div>
    </div>
  );
}
