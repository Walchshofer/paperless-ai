#!/usr/bin/env python3
import json, glob, shutil, sys
paths = glob.glob('/root/.cache/huggingface/hub/models--TomoroAI--tomoro-colqwen3-embed-8b/snapshots/*/config.json')
if not paths:
    print('❌ config.json not found')
    sys.exit(1)
config_path = paths[0]
shutil.copy2(config_path, config_path + '.bak')
print('🔧 Backed up to', config_path + '.bak')
with open(config_path, 'r') as f:
    cfg = json.load(f)
print('Before model_type:', cfg.get('model_type'))
cfg['model_type'] = 'qwen2_5_vl'
if 'architectures' in cfg:
    cfg['architectures'] = ['Qwen2_5_VLForConditionalGeneration']
with open(config_path, 'w') as f:
    json.dump(cfg, f, indent=2)
print('✅ Patched', config_path)
print('After model_type:', cfg.get('model_type'))
