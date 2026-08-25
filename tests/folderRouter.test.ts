import { describe, it, expect } from 'vitest';
import { FolderRouter } from '../src/services/folderRouter';

describe('FolderRouter', () => {
  it('should map standard model types correctly', () => {
    const router = new FolderRouter({ rootPath: 'D:\\ComfyUI\\models' });

    expect(
      router.computePath({ fileName: 'sdxl.safetensors', modelType: 'Checkpoint' }).folderName
    ).toBe('checkpoints');

    expect(
      router.computePath({ fileName: 'my_lora.safetensors', modelType: 'LORA' }).folderName
    ).toBe('loras');

    expect(
      router.computePath({ fileName: 'esrgan.pth', modelType: 'Upscaler' }).folderName
    ).toBe('upscale_models');
  });

  it('should match regex pattern overrides', () => {
    const router = new FolderRouter({ rootPath: 'D:\\ComfyUI\\models' });

    expect(
      router.computePath({ fileName: 'ip-adapter_sdxl.safetensors', modelType: 'Other' }).folderName
    ).toBe('ipadapter');

    expect(
      router.computePath({ fileName: 'qwen_2.5_coder.gguf', modelType: 'Other' }).folderName
    ).toBe('gguf');
  });
});
