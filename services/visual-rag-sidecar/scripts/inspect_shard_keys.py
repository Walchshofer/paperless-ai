#!/usr/bin/env python3
from colpali_engine.models import ColQwen2_5
import glob
import torch

try:
    import safetensors.torch as st
    safetensors = True
except Exception:
    st = None
    safetensors = False

MODEL_NAME = 'TomoroAI/tomoro-colqwen3-embed-8b'
print('Loading config and model (device=cpu) from pretrained...')
from transformers import AutoConfig
cfg = AutoConfig.from_pretrained(MODEL_NAME)
print('orig cfg.projection_dim =', getattr(cfg, 'projection_dim', None))
setattr(cfg, 'projection_dim', 320)
print('override cfg.projection_dim =', cfg.projection_dim)
model = ColQwen2_5.from_pretrained(MODEL_NAME, config=cfg, device_map='cpu')
# If the model has a hard-coded dim, adapt it so custom_text_proj matches Tomoro's 320-dim projection
proj = getattr(cfg, 'projection_dim', None)
if proj is not None and getattr(model, 'dim', None) != proj:
    print(f'Adjusting model.dim from {getattr(model, "dim", None)} to {proj} and rebuilding custom_text_proj')
    model.dim = proj
    import torch.nn as nn
    model.custom_text_proj = nn.Linear(model.config.hidden_size, model.dim)
ms = set(model.state_dict().keys())
print('model keys:', len(ms))

base = '/root/.cache/huggingface/hub/models--TomoroAI--tomoro-colqwen3-embed-8b/snapshots/*/'
shards = sorted(glob.glob(base + '*.safetensors') + glob.glob(base + '*.pt') + glob.glob(base + '*.bin'))
print('shards found:', len(shards))
if not shards:
    print('No shards found')
    raise SystemExit(0)

sh = shards[0]
print('Inspecting shard', sh)
if sh.endswith('.safetensors') and safetensors:
    ck = st.load_file(sh, device='cpu')
else:
    ck = torch.load(sh, map_location='cpu')

ckt = set((k.replace('vlm.model.', '').replace('vlm.', '')).replace('embedding_proj_layer', 'custom_text_proj') for k in ck.keys())
print('shard keys:', len(ckt))

common = ms & ckt
print('common keys:', len(common))

missing_in_shard = [k for k in ms if k not in ckt]
missing_in_model = [k for k in ckt if k not in ms]

print('\nEXAMPLES:')
print('examples missing in shard (model keys NOT found in checkpoint):')
for k in missing_in_shard[:30]:
    print('  -', k)

print('\nexamples extra in shard (checkpoint keys not in model):')
for k in list(ckt)[:30]:
    print('  -', k)

# Show language_model.* keys from checkpoint not found in model
lm_mismatch = [k for k in ckt if k.startswith('language_model.') and k not in ms]
print('\nlanguage_model.* keys in checkpoint but not in model (sample):')
for k in lm_mismatch[:30]:
    print('  -', k)

print('\nDone')
