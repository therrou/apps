import gptModels from '@configs/gptModels';
import { AppInstallationParameters } from '@locations/ConfigScreen';

const generateRandomParameters = (): AppInstallationParameters => {
  const randomModelIndex = Math.floor(Math.random() * gptModels.length);
  const randomApiKey = window.btoa(Math.random().toString() + Math.random().toString).slice(0, 48);
  const randomProfile = Math.random().toString(36).substring(7);

  return {
    model: gptModels[randomModelIndex],
    apiKey: 'sk-' + randomApiKey,
    profile: randomProfile,
  };
};

export { generateRandomParameters };
