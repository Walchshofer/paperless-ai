import time, traceback

try:
    import torch
    from byaldi import RAGMultiModalModel
    from PIL import Image
    print('--- START INTEGRATION CHECK ---')
    print('Loading Model: TomoroAI/tomoro-colqwen3-embed-4b-awq...')
    try:
        model = RAGMultiModalModel.from_pretrained('TomoroAI/tomoro-colqwen3-embed-4b-awq', device='cuda')
    except Exception as e:
        print('MODEL_LOAD_ERROR', repr(e))
        raise
    torch.cuda.synchronize()
    static_mem = torch.cuda.memory_allocated() / 1024**3
    print(f'Static VRAM: {static_mem:.2f} GB')
    img = Image.new('RGB', (448,448), color='red')
    torch.cuda.reset_peak_memory_stats()
    start_time = time.time()
    try:
        model.index(input_path=[img], index_name='paperless_visual', store_collection_with_index=True, overwrite=True)
    except Exception as e:
        print('INDEX_ERROR', repr(e))
        traceback.print_exc()
        raise
    torch.cuda.synchronize()
    end_time = time.time()
    latency_ms = (end_time - start_time) * 1000
    peak_mem = torch.cuda.max_memory_allocated() / 1024**3
    print('--- RESULTS ---')
    print('Integration Status: SUCCESS')
    print(f'Inference Latency: {latency_ms:.2f} ms')
    print(f'Peak VRAM Usage: {peak_mem:.2f} GB')
    print('--- END INTEGRATION CHECK ---')
except Exception as exc:
    print('--- INTEGRATION CHECK FAILED ---')
    traceback.print_exc()
