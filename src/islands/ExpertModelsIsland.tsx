import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import type { ExpertModelsSettings } from '../ui/contracts/Settings.ExpertModels.contract';
import { ExpertModelsSettingsSchema } from '../ui/contracts/Settings.ExpertModels.contract';

/**
 * ExpertModelsIsland - Expert domain model configuration
 *
 * Supports Medical, Financial, and Legal domain expert models.
 * Model selection is manual save (requires restart), with auto-save planned for future token limits.
 */
export default function ExpertModelsIsland(props: Partial<ExpertModelsSettings>) {
  const validated = ExpertModelsSettingsSchema.parse(props);

  const [activeTab, setActiveTab] = useState<'medical' | 'financial' | 'legal'>('medical');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Expert pipeline toggle
  const [expertPipelineEnabled, setExpertPipelineEnabled] = useState(validated.expertPipelineEnabled || true);

  // Medical models
  const [medicalVision, setMedicalVision] = useState(validated.medical?.vision || 'llava-med-v1.6');
  const [medicalAnalysis, setMedicalAnalysis] = useState(validated.medical?.analysis || 'medtext-llama3');
  const [medicalRadiology, setMedicalRadiology] = useState(validated.medical?.radiology || 'llava-med-v1.6');

  // Financial models
  const [financialAnalysis, setFinancialAnalysis] = useState(validated.financial?.analysis || 'fino1-8b');
  const [financialReasoning, setFinancialReasoning] = useState(validated.financial?.reasoning || 'llm-pro-finance-8b');
  const [financialVision, setFinancialVision] = useState(validated.financial?.vision || 'llm-pro-finance-8b');
  const [financialVatExpert, setFinancialVatExpert] = useState(validated.financial?.vatExpert || 'llm-pro-finance-8b');

  // Legal models
  const [legalVision, setLegalVision] = useState(validated.legal?.vision || 'qwen3-vl:8b');
  const [legalAnalysis, setLegalAnalysis] = useState(validated.legal?.analysis || 'gpt-oss');
  const [legalOrchestrator, setLegalOrchestrator] = useState(validated.legal?.orchestrator || '');

  // Auto-clear save message
  useEffect(() => {
    if (saveMessage) {
      const timer = setTimeout(() => setSaveMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveMessage]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const settings: Record<string, any> = {
        EXPERT_PIPELINE_ENABLED: expertPipelineEnabled ? 'yes' : 'no',
        // Medical models
        MEDICAL_VISION_MODEL: medicalVision,
        MEDICAL_ANALYSIS_MODEL: medicalAnalysis,
        MEDICAL_RADIOLOGY_MODEL: medicalRadiology,
        // Financial models
        FINANCIAL_ANALYSIS_MODEL: financialAnalysis,
        FINANCIAL_REASONING_MODEL: financialReasoning,
        FINANCIAL_VISION_MODEL: financialVision,
        FINANCIAL_VAT_EXPERT: financialVatExpert,
        // Legal models
        LEGAL_VISION_MODEL: legalVision,
        LEGAL_ANALYSIS_MODEL: legalAnalysis,
      };

      // Add orchestrator if set
      if (legalOrchestrator) {
        settings.LEGAL_ORCHESTRATOR_MODEL = legalOrchestrator;
      }

      const response = await fetch('/settings/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'expert-models',
          settings,
          requiresRestart: true // Expert model changes require restart
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSaveMessage('Expert models settings saved successfully');
        setIsDirty(false);

        // Dispatch events
        if (typeof document !== 'undefined') {
          document.dispatchEvent(new CustomEvent('settings:changed', {
            detail: {
              type: 'settings:changed',
              category: 'expert-models',
              settings,
              requiresRestart: true
            }
          }));

          document.dispatchEvent(new CustomEvent('settings:restart-required', {
            detail: {
              type: 'settings:restart-required',
              reason: 'Expert models settings changed',
              settings: ['Expert Models']
            }
          }));

          document.dispatchEvent(new CustomEvent('settings:saved', {
            detail: {
              type: 'settings:saved',
              category: 'expert-models',
              success: true,
              message: 'Expert models settings saved successfully'
            }
          }));
        }
      } else {
        setSaveMessage(`Save failed: ${result.message || result.error || 'Unknown error'}`);
      }
    } catch (error) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const markDirty = () => setIsDirty(true);

  return (
    <div className="expert-models-settings space-y-6 p-6 max-w-4xl" data-testid="expert-models-root">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Expert Models Settings</h2>
        <p className="text-gray-600">Configure domain-specific expert models for Medical, Financial, and Legal documents</p>
      </div>

      {/* Expert Pipeline Toggle */}
      <div className="space-y-4 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <label htmlFor="expert-pipeline-toggle" className="block text-sm font-medium text-gray-700">
              Expert Pipeline Enabled
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Enable domain-specific expert models for enhanced document processing
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              id="expert-pipeline-toggle"
              type="checkbox"
              checked={expertPipelineEnabled}
              onChange={(e) => {
                setExpertPipelineEnabled((e.target as HTMLInputElement).checked);
                markDirty();
              }}
              className="sr-only peer"
              data-testid="expert-pipeline-toggle"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" data-testid="expert-models-tabs">
          <button
            onClick={() => setActiveTab('medical')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'medical'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-medical"
          >
            Medical
          </button>
          <button
            onClick={() => setActiveTab('financial')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'financial'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-financial"
          >
            Financial
          </button>
          <button
            onClick={() => setActiveTab('legal')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'legal'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            data-testid="tab-legal"
          >
            Legal
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Medical Tab */}
        {activeTab === 'medical' && (
          <div className="space-y-4" data-testid="tab-content-medical">
            <h3 className="text-lg font-semibold">Medical Domain Models</h3>
            <p className="text-sm text-gray-600">Configure models for medical document analysis, including radiology and clinical text processing</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="medical-vision" className="block text-sm font-medium text-gray-700">
                  Vision Model
                </label>
                <input
                  id="medical-vision"
                  type="text"
                  value={medicalVision}
                  onChange={(e) => {
                    setMedicalVision((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="llava-med-v1.6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="medical-vision-input"
                />
                <p className="text-xs text-gray-500">Model for medical image analysis</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="medical-analysis" className="block text-sm font-medium text-gray-700">
                  Analysis Model
                </label>
                <input
                  id="medical-analysis"
                  type="text"
                  value={medicalAnalysis}
                  onChange={(e) => {
                    setMedicalAnalysis((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="medtext-llama3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="medical-analysis-input"
                />
                <p className="text-xs text-gray-500">Model for medical text analysis</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="medical-radiology" className="block text-sm font-medium text-gray-700">
                  Radiology Model
                </label>
                <input
                  id="medical-radiology"
                  type="text"
                  value={medicalRadiology}
                  onChange={(e) => {
                    setMedicalRadiology((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="llava-med-v1.6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="medical-radiology-input"
                />
                <p className="text-xs text-gray-500">Specialized model for radiology images</p>
              </div>
            </div>
          </div>
        )}

        {/* Financial Tab */}
        {activeTab === 'financial' && (
          <div className="space-y-4" data-testid="tab-content-financial">
            <h3 className="text-lg font-semibold">Financial Domain Models</h3>
            <p className="text-sm text-gray-600">Configure models for financial document analysis, including invoices, receipts, and tax documents</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="financial-analysis" className="block text-sm font-medium text-gray-700">
                  Analysis Model
                </label>
                <input
                  id="financial-analysis"
                  type="text"
                  value={financialAnalysis}
                  onChange={(e) => {
                    setFinancialAnalysis((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="fino1-8b"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="financial-analysis-input"
                />
                <p className="text-xs text-gray-500">Model for financial document analysis</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="financial-reasoning" className="block text-sm font-medium text-gray-700">
                  Reasoning Model
                </label>
                <input
                  id="financial-reasoning"
                  type="text"
                  value={financialReasoning}
                  onChange={(e) => {
                    setFinancialReasoning((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="llm-pro-finance-8b"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="financial-reasoning-input"
                />
                <p className="text-xs text-gray-500">Model for financial reasoning tasks</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="financial-vision" className="block text-sm font-medium text-gray-700">
                  Vision Model
                </label>
                <input
                  id="financial-vision"
                  type="text"
                  value={financialVision}
                  onChange={(e) => {
                    setFinancialVision((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="llm-pro-finance-8b"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="financial-vision-input"
                />
                <p className="text-xs text-gray-500">Model for financial document images</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="financial-vat" className="block text-sm font-medium text-gray-700">
                  VAT Expert Model
                </label>
                <input
                  id="financial-vat"
                  type="text"
                  value={financialVatExpert}
                  onChange={(e) => {
                    setFinancialVatExpert((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="llm-pro-finance-8b"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="financial-vat-input"
                />
                <p className="text-xs text-gray-500">Specialized model for VAT/tax analysis</p>
              </div>
            </div>
          </div>
        )}

        {/* Legal Tab */}
        {activeTab === 'legal' && (
          <div className="space-y-4" data-testid="tab-content-legal">
            <h3 className="text-lg font-semibold">Legal Domain Models</h3>
            <p className="text-sm text-gray-600">Configure models for legal document analysis, including contracts and compliance documents</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-2">
                <label htmlFor="legal-vision" className="block text-sm font-medium text-gray-700">
                  Vision Model
                </label>
                <input
                  id="legal-vision"
                  type="text"
                  value={legalVision}
                  onChange={(e) => {
                    setLegalVision((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="qwen3-vl:8b"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="legal-vision-input"
                />
                <p className="text-xs text-gray-500">Model for legal document images</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="legal-analysis" className="block text-sm font-medium text-gray-700">
                  Analysis Model
                </label>
                <input
                  id="legal-analysis"
                  type="text"
                  value={legalAnalysis}
                  onChange={(e) => {
                    setLegalAnalysis((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="gpt-oss"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="legal-analysis-input"
                />
                <p className="text-xs text-gray-500">Model for legal text analysis</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="legal-orchestrator" className="block text-sm font-medium text-gray-700">
                  Orchestrator Model <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="legal-orchestrator"
                  type="text"
                  value={legalOrchestrator}
                  onChange={(e) => {
                    setLegalOrchestrator((e.target as HTMLInputElement).value);
                    markDirty();
                  }}
                  placeholder="Leave empty to use default"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  data-testid="legal-orchestrator-input"
                />
                <p className="text-xs text-gray-500">Optional orchestrator for complex legal workflows</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Section */}
      <div className="border-t pt-4">
        <button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          data-testid="save-button"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>

        {saveMessage && (
          <div
            className="mt-3 p-3 rounded bg-blue-50 border border-blue-200 text-blue-800"
            data-testid="save-message"
          >
            {saveMessage}
          </div>
        )}

        <p className="mt-2 text-sm text-gray-500">
          ⚠️ Changing expert models requires a restart to take effect
        </p>
      </div>
    </div>
  );
}
