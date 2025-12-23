'use strict';

const path = require('path');
const { DocumentProcessor } = require('../services/integration/DocumentProcessor');

const sampleDoc = {
  id: 'vat-rag-001',
  filename: 'vat_invoice.txt',
  source: 'paperless-ngx',
  ocr_text: 'Ein oesterreichisches Unternehmen liefert eine Maschine nach Kroatien. Umsatzsteuer Leistungsort Binnenmarkt.',
  content: 'Ein oesterreichisches Unternehmen liefert eine Maschine nach Kroatien. Umsatzsteuer Leistungsort Binnenmarkt.'
};

const calls = [];
const mockOllama = {
  async chat({ model, messages }) {
    const system = messages.find((msg) => msg.role === 'system')?.content || '';
    const user = messages.find((msg) => msg.role === 'user')?.content || '';
    calls.push({ model, system, user });

    const modelName = String(model || '').toLowerCase();
    if (modelName.includes('qwen3-vl')) {
      return {
        message: {
          content: JSON.stringify({
            classification: {
              primary_domain: 'Financial',
              document_type: 'invoice',
              confidence: 0.92
            },
            routing: {
              requires_visual_analysis: false,
              requires_expert_model: true
            },
            quality_assessment: {
              text_legibility: 'high'
            }
          })
        }
      };
    }

    if (system.includes('multilingual financial document extraction assistant')) {
      return {
        message: {
          content: JSON.stringify({
            document_type: 'invoice',
            language: 'de',
            parties: {
              issuer: { name: 'Sample GmbH', tax_id: 'ATU12345678', address: null },
              recipient: { name: 'Demo AG', tax_id: null, address: null }
            },
            dates: {
              document_date: '2025-01-01',
              due_date: null,
              period_start: null,
              period_end: null
            },
            amounts: {
              subtotal: 100,
              tax: 20,
              total: 120,
              currency: 'EUR',
              tax_rate_percent: 20
            },
            line_items: [],
            payment_terms: null,
            reference_numbers: {
              invoice_number: 'INV-001',
              customer_number: null,
              iban: null
            },
            confidence: {
              overall: 0.9,
              extraction_quality: 'high'
            }
          })
        }
      };
    }

    if (system.includes('financial reasoning engine')) {
      return {
        message: {
          content: JSON.stringify({
            consistency: 'ok',
            issues: [],
            corrected_calculations: {
              subtotal: 100,
              tax: 20,
              total: 120
            },
            confidence: {
              overall: 0.88,
              reasoning_quality: 'high'
            }
          })
        }
      };
    }

    if (system.includes('VAT compliance expert')) {
      return {
        message: {
          content: JSON.stringify({
            vat_applicability: 'yes',
            vat_rate_percent: 20,
            reverse_charge: 'no',
            intra_eu_supply: 'no',
            evidence: ['VAT 20% applies'],
            flags: [],
            confidence: {
              overall: 0.9,
              assessment_quality: 'high'
            }
          })
        }
      };
    }

    return { message: { content: JSON.stringify({ ok: true }) } };
  }
};

const run = async () => {
  const processor = new DocumentProcessor(mockOllama, {
    features: {
      enableExpertPipeline: true,
      enableMedicalPipeline: false,
      enableMetricsLogging: false,
      enableFallbackToLegacy: false,
      enableVatRag: true
    }
  });

  const result = await processor.process(sampleDoc, { mode: 'expert_pipeline' });

  const vatCall = calls.find((call) => call.system.includes('VAT compliance expert'));
  const marker = 'INTERNAL VAT CONTEXT (DO NOT DISCLOSE):';
  const contextBlock = vatCall
    ? vatCall.user.split(marker)[1]?.split('DOCUMENT TEXT:')[0]?.trim()
    : '';
  const vatContextInjected = Boolean(contextBlock) &&
    contextBlock.includes('Umsatzsteuer');

  const output = {
    ok: result.success === true,
    ragDir: path.join(process.cwd(), 'data', 'austrian_vat'),
    vatRagTriggered: Boolean(vatCall),
    vatContextInjected,
    vatContextSnippet: contextBlock
      ? contextBlock.split('\n').slice(0, 4).join('\n')
      : null,
    pipelineId: result.result?.pipeline_id || null,
    status: result.result?.status || null
  };

  console.log(JSON.stringify(output, null, 2));
  process.exitCode = output.ok && output.vatRagTriggered && output.vatContextInjected ? 0 : 1;
};

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
  process.exitCode = 1;
});
