#!/usr/bin/env python3
from transformers import AutoConfig
from colpali_engine.models import ColQwen2_5
MODEL_NAME='TomoroAI/tomoro-colqwen3-embed-8b'
print('Loading config...')
cfg = AutoConfig.from_pretrained(MODEL_NAME)
print('Got config; projection_dim=', getattr(cfg, 'projection_dim', None))
setattr(cfg, 'projection_dim', 320)
print('Set projection_dim ->', cfg.projection_dim)
print('Instantiating model with overridden config on CPU...')
model = ColQwen2_5.from_pretrained(MODEL_NAME, config=cfg, device_map='cpu')
# If the model has a hard-coded dim, adapt it so custom_text_proj matches Tomoro's 320-dim projection
proj = getattr(cfg, 'projection_dim', None)
if proj is not None and getattr(model, 'dim', None) != proj:
    print(f"Adjusting model.dim from {getattr(model, 'dim', None)} to {proj} and rebuilding custom_text_proj")
    model.dim = proj
    import torch.nn as nn
    model.custom_text_proj = nn.Linear(model.config.hidden_size, model.dim)
print('Model instantiated. state_keys=', len(model.state_dict()))
# Print some diagnostic info about custom_text_proj
if hasattr(model, 'custom_text_proj'):
    print('custom_text_proj.shape =', tuple(model.custom_text_proj.weight.shape))
    print('custom_text_proj keys present in state_dict:', 'custom_text_proj.weight' in model.state_dict(), 'custom_text_proj.bias' in model.state_dict())
